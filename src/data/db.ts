import * as SQLite from 'expo-sqlite';

/*
 * The app's private SQLite database. Everything the listener keeps (catalog, likes, playlists, radios, progress, queue, settings) lives
 * here, scoped to a local profile id. Nothing in this file talks to a server.
 */

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE app_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE profile_kv (profile_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (profile_id, key));
  CREATE TABLE media (
    profile_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, uri TEXT NOT NULL, name TEXT NOT NULL, folder TEXT NOT NULL,
    size INTEGER NOT NULL, modified INTEGER NOT NULL, added INTEGER NOT NULL, seen_at INTEGER NOT NULL, duration REAL NOT NULL,
    width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0, mime TEXT NOT NULL DEFAULT '',
    tags TEXT, cover INTEGER NOT NULL DEFAULT 0, lyrics INTEGER NOT NULL DEFAULT 0, read_at INTEGER NOT NULL DEFAULT 0,
    missing INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (profile_id, id)
  );
  CREATE INDEX media_kind ON media (profile_id, kind, missing);
  CREATE TABLE likes (profile_id TEXT NOT NULL, track_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (profile_id, track_id));
  CREATE TABLE plays (profile_id TEXT NOT NULL, track_id TEXT NOT NULL, count INTEGER NOT NULL, last_at TEXT NOT NULL, PRIMARY KEY (profile_id, track_id));
  CREATE TABLE recent (profile_id TEXT NOT NULL, track_id TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (profile_id, track_id));
  CREATE TABLE playlists (profile_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (profile_id, id));
  CREATE TABLE playlist_tracks (profile_id TEXT NOT NULL, playlist_id TEXT NOT NULL, position INTEGER NOT NULL, track_id TEXT NOT NULL, PRIMARY KEY (profile_id, playlist_id, position));
  CREATE TABLE radios (profile_id TEXT NOT NULL, id TEXT NOT NULL, seed_kind TEXT NOT NULL, seed_value TEXT NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (profile_id, id));
  CREATE TABLE watch_progress (profile_id TEXT NOT NULL, file_id TEXT NOT NULL, title_id TEXT NOT NULL, position REAL NOT NULL, duration REAL NOT NULL, completed INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (profile_id, file_id));
  CREATE TABLE watch_list (profile_id TEXT NOT NULL, title_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (profile_id, title_id));
  `,
];

let opened: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('cine-music-wave.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
  return db;
}

/** The one shared connection, opened (and migrated) on first use. */
export function database(): Promise<SQLite.SQLiteDatabase> {
  opened ??= open();
  return opened;
}

/** Splits a list into SQLite-friendly chunks (the default bound-variable limit is lower than a large library). */
export function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
