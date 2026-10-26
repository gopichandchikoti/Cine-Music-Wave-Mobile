import type { SQLiteDatabase } from 'expo-sqlite';
import type { MusicState, PlayCount, PlaylistSummary, RadioSeedKind, RecentPlay, SavedRadio } from '../core/musicTypes';
import type { ProgressEntry } from '../core/watchTypes';
import { chunks, database } from './db';
import type { LocalProfile, MediaRecord, StoredTags } from './types';

type MediaRow = {
  id: string; kind: 'audio' | 'video'; uri: string; name: string; folder: string; size: number; modified: number; added: number; seen_at: number;
  duration: number; width: number; height: number; mime: string; tags: string | null; cover: number; lyrics: number; read_at: number; missing: number;
};

const parseTags = (text: string | null): StoredTags | null => {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' ? value as StoredTags : null;
  } catch { return null; }
};

const toRecord = (row: MediaRow): MediaRecord => ({
  id: row.id, kind: row.kind, uri: row.uri, name: row.name, folder: row.folder, size: row.size, modified: row.modified, added: row.added, seenAt: row.seen_at,
  duration: row.duration, width: row.width, height: row.height, mime: row.mime, tags: parseTags(row.tags), cover: row.cover === 1, lyrics: row.lyrics === 1,
  readAt: row.read_at, missing: row.missing === 1,
});

/** The values the app keeps outside any profile (which profile is selected). */
export async function appValue(key: string): Promise<string | null> {
  const db = await database();
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM app_kv WHERE key = ?', [key]))?.value ?? null;
}

export async function setAppValue(key: string, value: string | null): Promise<void> {
  const db = await database();
  if (value === null) await db.runAsync('DELETE FROM app_kv WHERE key = ?', [key]);
  else await db.runAsync('INSERT INTO app_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function loadProfile(id: string): Promise<LocalProfile | null> {
  const value = await appValue(`profile:${id}`);
  if (!value) return null;
  try { return JSON.parse(value) as LocalProfile; } catch { return null; }
}

export async function saveProfile(profile: LocalProfile): Promise<void> {
  await setAppValue(`profile:${profile.id}`, JSON.stringify(profile));
}

/** Everything one local profile keeps. Every statement is scoped to the profile id and uses bound parameters. */
export class Repository {
  private constructor(private readonly db: SQLiteDatabase, readonly profileId: string) {}

  static async open(profileId: string): Promise<Repository> {
    return new Repository(await database(), profileId);
  }

  // --- small values ---------------------------------------------------------------------------------------------------------------

  async value(key: string): Promise<string | null> {
    return (await this.db.getFirstAsync<{ value: string }>('SELECT value FROM profile_kv WHERE profile_id = ? AND key = ?', [this.profileId, key]))?.value ?? null;
  }

  async setValue(key: string, value: string | null): Promise<void> {
    if (value === null) await this.db.runAsync('DELETE FROM profile_kv WHERE profile_id = ? AND key = ?', [this.profileId, key]);
    else await this.db.runAsync('INSERT INTO profile_kv (profile_id, key, value) VALUES (?, ?, ?) ON CONFLICT(profile_id, key) DO UPDATE SET value = excluded.value', [this.profileId, key, value]);
  }

  // --- the catalog ------------------------------------------------------------------------------------------------------------------

  async media(): Promise<MediaRecord[]> {
    const rows = await this.db.getAllAsync<MediaRow>('SELECT id, kind, uri, name, folder, size, modified, added, seen_at, duration, width, height, mime, tags, cover, lyrics, read_at, missing FROM media WHERE profile_id = ?', [this.profileId]);
    return rows.map(toRecord);
  }

  async upsertMedia(records: readonly MediaRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.db.withTransactionAsync(async () => {
      for (const record of records) {
        await this.db.runAsync(
          `INSERT INTO media (profile_id, id, kind, uri, name, folder, size, modified, added, seen_at, duration, width, height, mime, tags, cover, lyrics, read_at, missing)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(profile_id, id) DO UPDATE SET kind = excluded.kind, uri = excluded.uri, name = excluded.name, folder = excluded.folder, size = excluded.size,
             modified = excluded.modified, added = excluded.added, duration = excluded.duration, width = excluded.width, height = excluded.height, mime = excluded.mime,
             tags = excluded.tags, cover = excluded.cover, lyrics = excluded.lyrics, read_at = excluded.read_at, missing = excluded.missing`,
          [this.profileId, record.id, record.kind, record.uri, record.name, record.folder, record.size, record.modified, record.added, record.seenAt, record.duration, record.width, record.height, record.mime,
            record.tags ? JSON.stringify(record.tags) : null, record.cover ? 1 : 0, record.lyrics ? 1 : 0, record.readAt, record.missing ? 1 : 0],
        );
      }
    });
  }

  /** Marks files that were not seen by the latest scan as unavailable (they stay catalogued so a returning file keeps its history). */
  async setMissing(ids: readonly string[], missing: boolean): Promise<void> {
    for (const group of chunks(ids, 400)) {
      await this.db.runAsync(`UPDATE media SET missing = ? WHERE profile_id = ? AND id IN (${group.map(() => '?').join(', ')})`, [missing ? 1 : 0, this.profileId, ...group]);
    }
  }

  async setTags(id: string, tags: StoredTags | null, cover: boolean, lyrics: boolean, duration: number, width: number, height: number, readAt: number): Promise<void> {
    await this.db.runAsync('UPDATE media SET tags = ?, cover = ?, lyrics = ?, duration = ?, width = ?, height = ?, read_at = ? WHERE profile_id = ? AND id = ?',
      [tags ? JSON.stringify(tags) : null, cover ? 1 : 0, lyrics ? 1 : 0, duration, width, height, readAt, this.profileId, id]);
  }

  async setContentRect(id: string, tags: StoredTags): Promise<void> {
    await this.db.runAsync('UPDATE media SET tags = ? WHERE profile_id = ? AND id = ?', [JSON.stringify(tags), this.profileId, id]);
  }

  // --- music: what the listener keeps -------------------------------------------------------------------------------------------------

  async musicState(): Promise<MusicState> {
    const [likes, plays, recent, playlists, radios] = await Promise.all([
      this.db.getAllAsync<{ track_id: string }>('SELECT track_id FROM likes WHERE profile_id = ? ORDER BY at DESC', [this.profileId]),
      this.db.getAllAsync<{ track_id: string; count: number; last_at: string }>('SELECT track_id, count, last_at FROM plays WHERE profile_id = ?', [this.profileId]),
      this.db.getAllAsync<{ track_id: string; at: string }>('SELECT track_id, at FROM recent WHERE profile_id = ? ORDER BY at DESC LIMIT 60', [this.profileId]),
      this.playlists(),
      this.db.getAllAsync<{ id: string; seed_kind: RadioSeedKind; seed_value: string; label: string; created_at: string }>('SELECT id, seed_kind, seed_value, label, created_at FROM radios WHERE profile_id = ? ORDER BY created_at DESC', [this.profileId]),
    ]);
    return {
      likes: likes.map((row) => row.track_id),
      plays: plays.map((row): PlayCount => ({ trackId: row.track_id, count: row.count, lastAt: row.last_at })),
      recent: recent.map((row): RecentPlay => ({ trackId: row.track_id, at: row.at })),
      playlists,
      radios: radios.map((row): SavedRadio => ({ id: row.id, seedKind: row.seed_kind, seedValue: row.seed_value, label: row.label, createdAt: row.created_at })),
      community: [],
    };
  }

  async setLike(trackId: string, liked: boolean): Promise<void> {
    if (liked) await this.db.runAsync('INSERT INTO likes (profile_id, track_id, at) VALUES (?, ?, ?) ON CONFLICT(profile_id, track_id) DO NOTHING', [this.profileId, trackId, Date.now()]);
    else await this.db.runAsync('DELETE FROM likes WHERE profile_id = ? AND track_id = ?', [this.profileId, trackId]);
  }

  async recordPlay(trackId: string, at: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('INSERT INTO plays (profile_id, track_id, count, last_at) VALUES (?, ?, 1, ?) ON CONFLICT(profile_id, track_id) DO UPDATE SET count = count + 1, last_at = excluded.last_at', [this.profileId, trackId, at]);
      await this.db.runAsync('INSERT INTO recent (profile_id, track_id, at) VALUES (?, ?, ?) ON CONFLICT(profile_id, track_id) DO UPDATE SET at = excluded.at', [this.profileId, trackId, at]);
      await this.db.runAsync('DELETE FROM recent WHERE profile_id = ? AND track_id NOT IN (SELECT track_id FROM recent WHERE profile_id = ? ORDER BY at DESC LIMIT 60)', [this.profileId, this.profileId]);
    });
  }

  async playlists(): Promise<PlaylistSummary[]> {
    const lists = await this.db.getAllAsync<{ id: string; name: string; description: string; updated_at: string }>('SELECT id, name, description, updated_at FROM playlists WHERE profile_id = ? ORDER BY updated_at DESC', [this.profileId]);
    const tracks = await this.db.getAllAsync<{ playlist_id: string; track_id: string }>('SELECT playlist_id, track_id FROM playlist_tracks WHERE profile_id = ? ORDER BY playlist_id, position', [this.profileId]);
    const byList = new Map<string, string[]>();
    for (const row of tracks) byList.set(row.playlist_id, [...(byList.get(row.playlist_id) ?? []), row.track_id]);
    return lists.map((list) => { const ids = byList.get(list.id) ?? []; return { id: list.id, name: list.name, description: list.description, trackCount: ids.length, updatedAt: list.updated_at, trackIds: ids }; });
  }

  async createPlaylist(id: string, name: string, trackIds: readonly string[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('INSERT INTO playlists (profile_id, id, name, description, updated_at) VALUES (?, ?, ?, \'\', ?)', [this.profileId, id, name, new Date().toISOString()]);
      await this.writeTracks(id, trackIds);
    });
  }

  async renamePlaylist(id: string, name: string): Promise<void> {
    await this.db.runAsync('UPDATE playlists SET name = ?, updated_at = ? WHERE profile_id = ? AND id = ?', [name, new Date().toISOString(), this.profileId, id]);
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM playlist_tracks WHERE profile_id = ? AND playlist_id = ?', [this.profileId, id]);
      await this.db.runAsync('DELETE FROM playlists WHERE profile_id = ? AND id = ?', [this.profileId, id]);
    });
  }

  async setPlaylistTracks(id: string, trackIds: readonly string[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM playlist_tracks WHERE profile_id = ? AND playlist_id = ?', [this.profileId, id]);
      await this.writeTracks(id, trackIds);
      await this.db.runAsync('UPDATE playlists SET updated_at = ? WHERE profile_id = ? AND id = ?', [new Date().toISOString(), this.profileId, id]);
    });
  }

  private async writeTracks(playlistId: string, trackIds: readonly string[]): Promise<void> {
    for (let position = 0; position < trackIds.length; position += 1) {
      await this.db.runAsync('INSERT INTO playlist_tracks (profile_id, playlist_id, position, track_id) VALUES (?, ?, ?, ?)', [this.profileId, playlistId, position, trackIds[position]]);
    }
  }

  async saveRadio(radio: SavedRadio): Promise<void> {
    await this.db.runAsync('INSERT INTO radios (profile_id, id, seed_kind, seed_value, label, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, id) DO UPDATE SET label = excluded.label', [this.profileId, radio.id, radio.seedKind, radio.seedValue, radio.label, radio.createdAt]);
  }

  async deleteRadio(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM radios WHERE profile_id = ? AND id = ?', [this.profileId, id]);
  }

  // --- watch: progress and My List ----------------------------------------------------------------------------------------------------

  async watchProgress(): Promise<ProgressEntry[]> {
    const rows = await this.db.getAllAsync<{ file_id: string; title_id: string; position: number; duration: number; completed: number; updated_at: string }>('SELECT file_id, title_id, position, duration, completed, updated_at FROM watch_progress WHERE profile_id = ? ORDER BY updated_at DESC', [this.profileId]);
    return rows.map((row) => ({ fileId: row.file_id, titleId: row.title_id, position: row.position, duration: row.duration, completed: row.completed === 1, updatedAt: row.updated_at }));
  }

  async saveProgress(entry: ProgressEntry): Promise<void> {
    await this.db.runAsync('INSERT INTO watch_progress (profile_id, file_id, title_id, position, duration, completed, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, file_id) DO UPDATE SET position = excluded.position, duration = excluded.duration, completed = excluded.completed, updated_at = excluded.updated_at, title_id = excluded.title_id',
      [this.profileId, entry.fileId, entry.titleId, entry.position, entry.duration, entry.completed ? 1 : 0, entry.updatedAt]);
  }

  async watchList(): Promise<string[]> {
    return (await this.db.getAllAsync<{ title_id: string }>('SELECT title_id FROM watch_list WHERE profile_id = ? ORDER BY at DESC', [this.profileId])).map((row) => row.title_id);
  }

  async setListed(titleId: string, listed: boolean): Promise<void> {
    if (listed) await this.db.runAsync('INSERT INTO watch_list (profile_id, title_id, at) VALUES (?, ?, ?) ON CONFLICT(profile_id, title_id) DO NOTHING', [this.profileId, titleId, Date.now()]);
    else await this.db.runAsync('DELETE FROM watch_list WHERE profile_id = ? AND title_id = ?', [this.profileId, titleId]);
  }
}
