import Wave, { type NativeRow, type NativeTags } from '../../modules/wave-media';
import type { Repository } from '../data/repository';
import type { MediaRecord, ScanProgress, StoredTags } from '../data/types';

/*
 * Brings the catalog in step with what Android has indexed (and any folders or files the user picked by hand):
 *   1. list the files Android shows this app (only what the permission allows - nothing else can be seen),
 *   2. read tags, covers and track lists only for files that are new or changed,
 *   3. mark files that have gone as unavailable. Originals are never changed.
 */

/** Bump when what is read from files changes, so every file is read again once. */
const SCAN_VERSION = 2;
const PAGE = 500;
const READ_CHUNK = 24;

/** Android reports a missing tag as "<unknown>"; that is not a name, so it is dropped like an empty value. */
const present = (value: string | null | undefined): string | undefined => (value && value.trim() && value.trim().toLowerCase() !== '<unknown>' ? value : undefined);

const tagsFromRow = (row: NativeRow): StoredTags => ({
  title: present(row.title), artist: present(row.artist), albumArtist: present(row.albumArtist), album: present(row.album), genre: present(row.genre),
  composer: present(row.composer), year: present(row.year), track: present(row.track), disc: present(row.disc),
});

/** Tags read from the file win; MediaStore's copy fills any gap. Empty values are dropped. */
const mergeTags = (row: NativeRow, read: NativeTags): StoredTags => {
  const fallback = tagsFromRow(row);
  const merged: StoredTags = {
    title: present(read.title) ?? fallback.title, artist: present(read.artist) ?? fallback.artist, albumArtist: present(read.albumArtist) ?? fallback.albumArtist,
    album: present(read.album) ?? fallback.album, genre: present(read.genre) ?? fallback.genre, composer: present(read.composer) ?? fallback.composer,
    date: present(read.date), year: present(read.year) ?? fallback.year, track: present(read.track) ?? fallback.track, disc: present(read.disc) ?? fallback.disc,
  };
  if (read.audioTracks && read.audioTracks.length > 0) merged.audioTracks = read.audioTracks;
  if (read.subtitleTracks && read.subtitleTracks.length > 0) merged.subtitleTracks = read.subtitleTracks;
  return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined)) as StoredTags;
};

async function listAll(kind: 'audio' | 'video'): Promise<NativeRow[]> {
  const rows: NativeRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await Wave.list(kind, offset, PAGE);
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const sameFile = (row: NativeRow, record: MediaRecord): boolean => record.size === row.size && record.modified === row.modified && record.uri === row.uri;

export type ScanResult = { found: number; added: number; changed: number; gone: number };

/** Reads the device and updates the catalog. `report` receives progress; `cancelled` is polled between steps. */
export async function scanDevice(repo: Repository, options: { audio: boolean; video: boolean; report: (progress: ScanProgress) => void; cancelled: () => boolean }): Promise<ScanResult> {
  const { report, cancelled } = options;
  report({ phase: 'listing', done: 0, total: 0, message: null });
  const rows: NativeRow[] = [];
  if (options.audio) rows.push(...await listAll('audio'));
  if (options.video) rows.push(...await listAll('video'));
  const picked = await Wave.pickedFolders().catch(() => [] as NativeRow[]);
  const reread = (await repo.value('scan-version')) !== String(SCAN_VERSION);
  const known = new Map((await repo.media()).map((record) => [record.id, record]));
  const seen = new Set<string>();
  const unread: { row: NativeRow; record: MediaRecord }[] = [];
  const fresh: MediaRecord[] = [];
  const now = Date.now();
  for (const row of [...rows, ...picked]) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    const existing = known.get(row.key);
    if (existing && !reread && sameFile(row, existing) && existing.readAt > 0) {
      if (existing.missing) { existing.missing = false; fresh.push(existing); }
      continue;
    }
    const record: MediaRecord = {
      id: row.key, kind: row.kind, uri: row.uri, name: row.name, folder: row.folder, size: row.size, modified: row.modified, added: row.added,
      seenAt: existing?.seenAt ?? now, duration: row.duration, width: row.width, height: row.height, mime: row.mime,
      tags: row.kind === 'audio' ? tagsFromRow(row) : null, cover: existing?.cover ?? false, lyrics: existing?.lyrics ?? false, readAt: 0, missing: false,
    };
    fresh.push(record);
    unread.push({ row, record });
  }
  await repo.upsertMedia(fresh);

  // Files that were catalogued earlier but are no longer visible: unavailable, not deleted. A single picked document is checked on its own.
  const gone: string[] = [];
  for (const record of known.values()) {
    if (seen.has(record.id) || record.missing) continue;
    if (record.id.startsWith('doc:') && await Wave.exists(record.uri).catch(() => false)) continue;
    gone.push(record.id);
  }
  await repo.setMissing(gone, true);

  let done = 0;
  for (let start = 0; start < unread.length; start += READ_CHUNK) {
    if (cancelled()) break;
    report({ phase: 'reading', done, total: unread.length, message: null });
    for (const kind of ['audio', 'video'] as const) {
      const group = unread.slice(start, start + READ_CHUNK).filter((item) => item.row.kind === kind);
      if (group.length === 0) continue;
      const reads = await Wave.readTags(group.map((item) => item.row.uri), kind).catch(() => group.map((item) => ({ uri: item.row.uri, readable: false }) as NativeTags));
      const finished: MediaRecord[] = group.map((item, index) => {
        const read = reads[index] ?? { uri: item.row.uri, readable: false };
        return {
          ...item.record,
          tags: kind === 'audio' ? mergeTags(item.row, read) : read.readable ? mergeTags(item.row, read) : null,
          cover: read.hasCover === true,
          lyrics: read.hasLyrics === true,
          duration: read.duration && read.duration > 0 ? read.duration : item.record.duration,
          width: read.width && read.width > 0 ? read.width : item.record.width,
          height: read.height && read.height > 0 ? read.height : item.record.height,
          readAt: Date.now(),
        };
      });
      await repo.upsertMedia(finished);
    }
    done = Math.min(unread.length, start + READ_CHUNK);
  }
  if (!cancelled()) await repo.setValue('scan-version', String(SCAN_VERSION));
  report({ phase: 'done', done: unread.length, total: unread.length, message: null });
  return { found: seen.size, added: unread.filter((item) => !known.has(item.record.id)).length, changed: unread.filter((item) => known.has(item.record.id)).length, gone: gone.length };
}
