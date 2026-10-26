import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import Wave, { type NativeRow } from '../../modules/wave-media';
import { buildMusic, buildTitles, type BuiltMusic, type CoverSource } from '../core/library';
import type { WatchTitle } from '../core/watchTypes';
import { checkAccess, requestAccess, type AccessDetail } from '../platform/permissions';
import { scanDevice } from '../platform/scanner';
import { Repository } from './repository';
import type { MediaRecord, ScanProgress } from './types';

/*
 * The on-device catalog: what Android lets this app see (plus anything the user picked by hand), read into the profile's own SQLite
 * tables. Songs and videos shown anywhere in the app come from here - there is no demo catalog and no server.
 */

export type LibraryValue = {
  /** the profile's repository (null until the database has opened) */
  repo: Repository | null;
  /** false until the saved catalog has loaded from the database */
  loaded: boolean;
  records: readonly MediaRecord[];
  music: BuiltMusic;
  titles: readonly WatchTitle[];
  access: AccessDetail;
  scan: ScanProgress;
  /** true when a scan has completed at least once since this launch */
  scanned: boolean;
  rescan: () => Promise<void>;
  askAccess: () => Promise<void>;
  pick: (folder: boolean) => Promise<void>;
  coverSource: (albumId: string) => CoverSource | undefined;
  recordOf: (id: string) => MediaRecord | undefined;
};

const emptyMusic: BuiltMusic = { tracks: [], coverSources: new Map(), pending: 0 };
const idle: ScanProgress = { phase: 'idle', done: 0, total: 0, message: null };
const STALE_MS = 30_000;

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ profileId, children }: { profileId: string; children: ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [records, setRecords] = useState<readonly MediaRecord[]>([]);
  const [access, setAccess] = useState<AccessDetail>({ state: 'unknown', audio: false, video: false, selectedVideo: false });
  const [scan, setScan] = useState<ScanProgress>(idle);
  const [scanned, setScanned] = useState(false);
  const scanning = useRef(false);
  const lastScan = useRef(0);
  const accessRef = useRef(access);
  const repoRef = useRef<Repository | null>(null);
  const alive = useRef(true);

  useEffect(() => { accessRef.current = access; });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const reload = useCallback(async (repository: Repository): Promise<void> => {
    const next = await repository.media();
    if (alive.current) setRecords(next);
  }, []);

  const runScan = useCallback(async (): Promise<void> => {
    const repository = repoRef.current;
    if (!repository || scanning.current) return;
    scanning.current = true;
    try {
      const detail = await checkAccess();
      if (alive.current) setAccess(detail);
      // Android can only list what it is allowed to show this app; with nothing allowed the catalog keeps what it had, marked unavailable.
      const audio = detail.audio;
      const video = detail.video || detail.selectedVideo;
      let lastReload = 0;
      await scanDevice(repository, {
        audio, video,
        report: (progress) => {
          if (alive.current) setScan(progress);
          if (progress.phase === 'reading' && Date.now() - lastReload > 1500) { lastReload = Date.now(); void reload(repository); }
        },
        cancelled: () => !alive.current,
      });
      await reload(repository);
      lastScan.current = Date.now();
      if (alive.current) { setScan({ phase: 'done', done: 0, total: 0, message: null }); setScanned(true); }
    } catch (reason) {
      if (alive.current) setScan({ phase: 'error', done: 0, total: 0, message: reason instanceof Error ? reason.message : 'The device library could not be read.' });
    } finally {
      scanning.current = false;
    }
  }, [reload]);

  useEffect(() => {
    void (async () => {
      const repository = await Repository.open(profileId);
      repoRef.current = repository;
      if (!alive.current) return;
      setRepo(repository);
      await reload(repository);
      const detail = await checkAccess();
      if (!alive.current) return;
      setAccess(detail);
      setLoaded(true);
      void runScan();
    })();
  }, [profileId, reload, runScan]);

  // Coming back to the app: permission may have been granted or revoked in Settings, and files may have been added.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !repoRef.current) return;
      void checkAccess().then((detail) => {
        const before = accessRef.current;
        if (alive.current) setAccess(detail);
        const changed = before.state !== detail.state || before.audio !== detail.audio || before.video !== detail.video;
        if (changed || Date.now() - lastScan.current > STALE_MS) void runScan();
      });
    });
    return () => subscription.remove();
  }, [runScan]);

  const askAccess = useCallback(async (): Promise<void> => {
    const detail = await requestAccess();
    if (alive.current) setAccess(detail);
    await runScan();
  }, [runScan]);

  const pick = useCallback(async (folder: boolean): Promise<void> => {
    const repository = repoRef.current;
    if (!repository) return;
    const rows: NativeRow[] = await Wave.pick(folder);
    if (rows.length > 0) await runScan();
  }, [runScan]);

  const music = useMemo(() => (records.length === 0 ? emptyMusic : buildMusic(records)), [records]);
  const titles = useMemo(() => buildTitles(records), [records]);
  const byId = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const coverSource = useCallback((albumId: string) => music.coverSources.get(albumId), [music]);
  const recordOf = useCallback((id: string) => byId.get(id), [byId]);

  const value = useMemo<LibraryValue>(() => ({ repo, loaded, records, music, titles, access, scan, scanned, rescan: runScan, askAccess, pick, coverSource, recordOf }),
    [repo, loaded, records, music, titles, access, scan, scanned, runScan, askAccess, pick, coverSource, recordOf]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside LibraryProvider.');
  return value;
}
