import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { hex12 } from '../../core/hash';
import { buildIndex, radioLabel, radioTracks, seededRandom, type RadioSeed } from '../../core/musicModel';
import type { MusicState, MusicTrack, PlayContext, PlaylistSummary, SavedRadio } from '../../core/musicTypes';
import { append, clearUpcoming as clearQueueUpcoming, currentItem, emptyQueue, insertNext, jump, makeQueue, move, nextIndex, previousIndex, removeAt, restoreOrder, shuffleUpcoming, type Queue, type RepeatMode } from '../../core/queue';
import { useLibrary } from '../../data/LibraryProvider';
import { art } from '../../platform/artwork';
import { MusicEngine, type TrackSource } from '../../platform/musicEngine';
import { MusicContext, PlaybackClock, type MusicContextValue, type Sheet, type SleepTimer } from './musicContext';

const emptyUser: MusicState = { likes: [], plays: [], recent: [], playlists: [], radios: [], community: [] };
const emptyIndex = buildIndex([]);
const SESSION_KEY = 'music-session';
const REPORT_AFTER_SECONDS = 30;
const MAX_FAILURES_IN_A_ROW = 3;

type Session = {
  ids: string[]; index: number; position: number; context: PlayContext | null;
  volume: number; repeat: RepeatMode; shuffle: boolean; autoplay: boolean; crossfade: number;
};

const errorText = (reason: unknown, fallback: string): string => (reason instanceof Error && reason.message ? reason.message : fallback);
const newId = (prefix: string): string => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Owns the audio engine and everything about listening: the queue, likes and playlists, radio and autoplay, the sleep timer and the
 * remembered place. It sits above the Watch and Music screens, so music keeps playing when you move between them. (Port of the web
 * app's MusicProvider; the server is replaced by this phone's SQLite tables.)
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const library = useLibrary();
  const { repo } = library;
  const [saved, setSaved] = useState<Partial<Session> | null>(null);
  const [user, setUser] = useState<MusicState>(emptyUser);
  const [queue, setQueueState] = useState<Queue>(emptyQueue);
  const [context, setContext] = useState<PlayContext | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolumeState] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>('off');
  const [autoplay, setAutoplayState] = useState(true);
  const [crossfade, setCrossfadeState] = useState(0);
  const [rate, setRateState] = useState(1);
  const [sleep, setSleepState] = useState<SleepTimer>({ endsAt: null, endOfTrack: false });
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [clock] = useState(() => new PlaybackClock());

  const tracks = library.music.tracks;
  const index = useMemo(() => (tracks.length === 0 ? emptyIndex : buildIndex(tracks)), [tracks]);
  const likes = useMemo(() => new Set(user.likes), [user.likes]);
  const films = useMemo(() => library.titles.filter((title) => title.kind === 'movie').map((title) => ({ title: title.title, year: title.year })), [library.titles]);
  const status: MusicContextValue['status'] = !library.loaded ? 'loading' : library.scan.phase === 'error' && tracks.length === 0 ? 'error' : 'ready';

  // Refs hold the latest values for the audio engine's callbacks, which are created once.
  const queueRef = useRef<Queue>(emptyQueue);
  const indexRef = useRef(emptyIndex);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  const autoplayRef = useRef(autoplay);
  const sleepRef = useRef(sleep);
  const likesRef = useRef<ReadonlySet<string>>(new Set());
  const userRef = useRef(emptyUser);
  const radioRef = useRef<RadioSeed | null>(null);
  const engineRef = useRef<MusicEngine | null>(null);
  const failures = useRef(0);
  const listened = useRef({ trackId: '', seconds: 0, last: 0, reported: false });
  const restored = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<(manual: boolean) => void>(() => undefined);
  const repoRef = useRef(repo);
  const libraryRef = useRef(library);

  useEffect(() => {
    indexRef.current = index; repeatRef.current = repeat; shuffleRef.current = shuffle; autoplayRef.current = autoplay; sleepRef.current = sleep;
    likesRef.current = likes; userRef.current = user; repoRef.current = repo; libraryRef.current = library;
  });

  const toast = useCallback((message: string): void => {
    setToastText(message);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3200);
  }, []);

  const commitQueue = useCallback((next: Queue): void => { queueRef.current = next; setQueueState(next); }, []);

  // --- loading what the profile kept -----------------------------------------------------------------------------------------------------

  useEffect(() => {
    if (!repo) return;
    void repo.musicState().then(setUser);
    void repo.value(SESSION_KEY).then((text) => {
      let parsed: Partial<Session> = {};
      try { const value: unknown = text ? JSON.parse(text) : null; if (value && typeof value === 'object') parsed = value as Partial<Session>; } catch { /* nothing remembered */ }
      if (typeof parsed.volume === 'number') setVolumeState(parsed.volume);
      if (parsed.repeat === 'all' || parsed.repeat === 'one') setRepeatState(parsed.repeat);
      if (parsed.shuffle === true) setShuffleState(true);
      if (parsed.autoplay === false) setAutoplayState(false);
      if (typeof parsed.crossfade === 'number') setCrossfadeState(parsed.crossfade);
      if (parsed.context) setContext(parsed.context);
      setSaved(parsed);
    });
  }, [repo]);

  // --- the song that is current ------------------------------------------------------------------------------------------------------------

  const sourceOf = useCallback((trackId: string): TrackSource | null => {
    const track = indexRef.current.byId.get(trackId);
    const record = libraryRef.current.recordOf(trackId);
    if (!track || !record || record.missing) return null;
    const cover = art.get(`cover:${track.albumId}`);
    return { uri: record.uri, duration: track.duration, metadata: { title: track.title, artist: track.artists.join(', '), albumTitle: track.album, artworkUrl: cover ?? undefined } };
  }, []);

  const loadCurrent = useCallback(async (autoplayNow = true, startAt = 0): Promise<void> => {
    const engine = engineRef.current;
    const item = currentItem(queueRef.current);
    if (!engine || !item) return;
    listened.current = { trackId: item.trackId, seconds: 0, last: startAt, reported: false };
    try {
      await engine.load(item.trackId, startAt, autoplayNow);
      failures.current = 0;
    } catch {
      // Putting a remembered song back (paused) must never start playing something else on its own: say so and wait to be asked.
      if (!autoplayNow) { toast('That song could not be played.'); return; }
      failures.current += 1;
      if (failures.current >= MAX_FAILURES_IN_A_ROW) { toast('Those songs could not be played right now.'); failures.current = 0; return; }
      toast('That song could not be played. Skipping it.');
      setTimeout(() => { if (currentItem(queueRef.current)?.trackId === item.trackId) advanceRef.current(true); }, 700);
    }
  }, [toast]);

  // The first time songs are known, put the previous session back (paused, at the place it was left).
  useEffect(() => {
    if (restored.current || saved === null || tracks.length === 0) return;
    restored.current = true;
    const known = new Set(tracks.map((track) => track.id));
    const ids = (saved.ids ?? []).filter((id) => known.has(id)).slice(0, 500);
    if (ids.length === 0) return;
    commitQueue(makeQueue(ids, typeof saved.index === 'number' ? Math.min(Math.max(saved.index, 0), ids.length - 1) : 0));
    void loadCurrent(false, typeof saved.position === 'number' ? saved.position : 0);
  }, [saved, tracks, commitQueue, loadCurrent]);

  // --- reporting what was listened to ---------------------------------------------------------------------------------------------------

  const noteListening = useCallback((position: number, duration: number): void => {
    const current = currentItem(queueRef.current);
    if (!current) return;
    const entry = listened.current;
    if (entry.trackId !== current.trackId) { listened.current = { trackId: current.trackId, seconds: 0, last: position, reported: false }; return; }
    const delta = position - entry.last;
    entry.last = position;
    if (delta > 0 && delta < 2.5) entry.seconds += delta;
    const threshold = Math.min(REPORT_AFTER_SECONDS, duration > 0 ? duration * 0.5 : REPORT_AFTER_SECONDS);
    if (entry.reported || entry.seconds < threshold) return;
    entry.reported = true;
    const stamp = new Date().toISOString();
    setUser((state) => {
      const found = state.plays.find((play) => play.trackId === current.trackId);
      const plays = found ? state.plays.map((play) => (play.trackId === current.trackId ? { ...play, count: play.count + 1, lastAt: stamp } : play)) : [{ trackId: current.trackId, count: 1, lastAt: stamp }, ...state.plays];
      return { ...state, plays, recent: [{ trackId: current.trackId, at: stamp }, ...state.recent.filter((recent) => recent.trackId !== current.trackId)].slice(0, 60) };
    });
    void repoRef.current?.recordPlay(current.trackId, stamp).catch(() => undefined);
  }, []);

  // --- moving through the queue ------------------------------------------------------------------------------------------------------------

  /** More songs for a radio, or for autoplay once the queue has run out. Returns how many were added. */
  const extendQueue = useCallback((count: number): number => {
    const queueNow = queueRef.current;
    const seed: RadioSeed | null = radioRef.current ?? (autoplayRef.current && currentItem(queueNow) ? { kind: 'track', value: currentItem(queueNow)!.trackId } : null);
    if (!seed) return 0;
    const exclude = new Set(queueNow.items.map((item) => item.trackId));
    const more = radioTracks(indexRef.current, seed, { exclude, count, random: seededRandom(`${Date.now()}:${exclude.size}`), likes: likesRef.current });
    if (more.length === 0) return 0;
    commitQueue(append(queueNow, more.map((track) => track.id)));
    return more.length;
  }, [commitQueue]);

  const goTo = useCallback((position: number): void => {
    commitQueue(jump(queueRef.current, position));
    void loadCurrent();
  }, [commitQueue, loadCurrent]);

  /** Moves on to the next song. `manual` is true when someone pressed Next (so repeat-one does not replay the same song). */
  const advance = useCallback((manual: boolean): void => {
    const engine = engineRef.current;
    let target = nextIndex(queueRef.current, repeatRef.current, manual);
    if (target === null && extendQueue(12) > 0) target = queueRef.current.index + 1;
    if (target === null) { engine?.pause(); return; }
    if (target === queueRef.current.index) { engine?.seek(0); engine?.play(); return; }
    goTo(target);
    // A radio never runs dry: it adds more a few songs before the end.
    if (radioRef.current && queueRef.current.items.length - queueRef.current.index <= 4) extendQueue(10);
  }, [extendQueue, goTo]);

  useEffect(() => { advanceRef.current = advance; }, [advance]);

  const onEnded = useCallback((): void => {
    if (sleepRef.current.endOfTrack) {
      setSleepState({ endsAt: null, endOfTrack: false });
      const target = nextIndex(queueRef.current, repeatRef.current, true);
      toast('Sleep timer: music stopped at the end of the song');
      if (target !== null && target !== queueRef.current.index) { commitQueue(jump(queueRef.current, target)); void loadCurrent(false); }
      else engineRef.current?.pause();
      return;
    }
    advance(false);
  }, [advance, commitQueue, loadCurrent, toast]);

  const onAdvanced = useCallback((trackId: string): void => {
    const queueNow = queueRef.current;
    const target = nextIndex(queueNow, repeatRef.current, false);
    if (target !== null && queueNow.items[target]?.trackId === trackId) {
      commitQueue(jump(queueNow, target));
      listened.current = { trackId, seconds: 0, last: 0, reported: false };
      if (radioRef.current && queueRef.current.items.length - queueRef.current.index <= 4) extendQueue(10);
    } else { void loadCurrent(); }
  }, [commitQueue, extendQueue, loadCurrent]);

  // --- the audio engine -----------------------------------------------------------------------------------------------------------------------

  const live = useRef({ onEnded, onAdvanced, noteListening, toast });
  useEffect(() => { live.current = { onEnded, onAdvanced, noteListening, toast }; });

  useEffect(() => {
    const engine = new MusicEngine({
      time: (position, duration) => { clock.set(position, duration); live.current.noteListening(position, duration); },
      playing: setPlaying,
      buffering: setBuffering,
      ended: () => live.current.onEnded(),
      advanced: (trackId) => live.current.onAdvanced(trackId),
      error: () => { live.current.toast('That song could not be played.'); live.current.onEnded(); },
    }, sourceOf, () => {
      const queueNow = queueRef.current;
      if (repeatRef.current === 'one') return null;
      const target = nextIndex(queueNow, repeatRef.current, false);
      return target === null || target === queueNow.index ? null : queueNow.items[target]?.trackId ?? null;
    });
    engineRef.current = engine;
    return () => { engine.dispose(); engineRef.current = null; };
  }, [clock, sourceOf]);

  useEffect(() => { engineRef.current?.setVolume(volume); }, [volume]);
  useEffect(() => { engineRef.current?.setMuted(muted); }, [muted]);
  useEffect(() => { engineRef.current?.setCrossfade(crossfade); }, [crossfade]);
  useEffect(() => { engineRef.current?.setRate(rate); }, [rate]);

  // --- transport ------------------------------------------------------------------------------------------------------------------------------

  const startQueue = useCallback((trackIds: readonly string[], options: { start?: number; context?: PlayContext; shuffle?: boolean } = {}, radio: RadioSeed | null = null): void => {
    const valid = trackIds.filter((id) => indexRef.current.byId.has(id));
    if (valid.length === 0) return;
    const wantShuffle = options.shuffle ?? shuffleRef.current;
    if (options.shuffle !== undefined) setShuffleState(options.shuffle);
    const start = options.start ?? (wantShuffle ? Math.floor(Math.random() * valid.length) : 0);
    let next = makeQueue(valid, start);
    if (wantShuffle) next = shuffleUpcoming(next, Math.random);
    radioRef.current = radio;
    commitQueue(next);
    setContext(options.context ?? null);
    failures.current = 0;
    void loadCurrent();
  }, [commitQueue, loadCurrent]);

  const playTracks = useCallback((trackIds: readonly string[], options?: { start?: number; context?: PlayContext; shuffle?: boolean }): void => startQueue(trackIds, options, null), [startQueue]);

  const toggle = useCallback((): void => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.playing) { engine.pause(); return; }
    if (engine.trackId) { engine.play(); return; }
    void loadCurrent();
  }, [loadCurrent]);

  const pause = useCallback((): void => { engineRef.current?.pause(); }, []);

  const stopAll = useCallback((): void => {
    engineRef.current?.stop();
    commitQueue(emptyQueue);
    clock.set(0, 0);
    radioRef.current = null;
    setContext(null);
    setExpanded(false);
    setSheet(null);
    setPlaying(false);
  }, [clock, commitQueue]);

  const seek = useCallback((seconds: number): void => {
    engineRef.current?.seek(seconds);
    clock.set(seconds, engineRef.current?.duration() ?? 0);
  }, [clock]);
  const next = useCallback((): void => advance(true), [advance]);
  const previous = useCallback((): void => {
    const engine = engineRef.current;
    if (engine && engine.position() > 3) { engine.seek(0); return; }
    const target = previousIndex(queueRef.current, repeatRef.current);
    if (target === null) { engine?.seek(0); return; }
    goTo(target);
  }, [goTo]);

  const setVolume = useCallback((value: number): void => { setVolumeState(Math.min(1, Math.max(0, value))); setMuted(false); }, []);
  const toggleMute = useCallback((): void => setMuted((current) => !current), []);
  const toggleShuffle = useCallback((): void => {
    const turningOn = !shuffleRef.current;
    setShuffleState(turningOn);
    commitQueue(turningOn ? shuffleUpcoming(queueRef.current, Math.random) : restoreOrder(queueRef.current));
  }, [commitQueue]);
  const cycleRepeat = useCallback((): void => setRepeatState((current) => (current === 'off' ? 'all' : current === 'all' ? 'one' : 'off')), []);

  const setSleep = useCallback((minutes: number | 'track' | null): void => {
    if (minutes === null) { setSleepState({ endsAt: null, endOfTrack: false }); toast('Sleep timer off'); return; }
    if (minutes === 'track') { setSleepState({ endsAt: null, endOfTrack: true }); toast('Music will stop at the end of this song'); return; }
    setSleepState({ endsAt: Date.now() + minutes * 60_000, endOfTrack: false });
    toast(`Music will stop in ${minutes} minutes`);
  }, [toast]);

  useEffect(() => {
    if (sleep.endsAt === null) return;
    const timer = setTimeout(() => {
      engineRef.current?.pause();
      setSleepState({ endsAt: null, endOfTrack: false });
      toast('Sleep timer: music paused');
    }, Math.max(0, sleep.endsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [sleep.endsAt, toast]);

  // --- editing the queue -----------------------------------------------------------------------------------------------------------------------

  const playNext = useCallback((trackIds: readonly string[]): void => {
    const valid = trackIds.filter((id) => indexRef.current.byId.has(id));
    if (valid.length === 0) return;
    if (queueRef.current.items.length === 0) { startQueue(valid, { context: { kind: 'queue', id: null, label: 'Your queue' } }); return; }
    commitQueue(insertNext(queueRef.current, valid));
    toast(valid.length === 1 ? 'Playing next' : `${valid.length} songs will play next`);
  }, [commitQueue, startQueue, toast]);

  const addToQueue = useCallback((trackIds: readonly string[]): void => {
    const valid = trackIds.filter((id) => indexRef.current.byId.has(id));
    if (valid.length === 0) return;
    if (queueRef.current.items.length === 0) { startQueue(valid, { context: { kind: 'queue', id: null, label: 'Your queue' } }); return; }
    commitQueue(append(queueRef.current, valid));
    toast(valid.length === 1 ? 'Added to queue' : `${valid.length} songs added to the queue`);
  }, [commitQueue, startQueue, toast]);

  const removeFromQueue = useCallback((position: number): void => {
    const queueNow = queueRef.current;
    const wasCurrent = position === queueNow.index;
    const updated = removeAt(queueNow, position);
    commitQueue(updated);
    if (!wasCurrent) return;
    if (updated.index < 0) { engineRef.current?.stop(); clock.set(0, 0); return; }
    void loadCurrent();
  }, [clock, commitQueue, loadCurrent]);

  const moveInQueue = useCallback((from: number, to: number): void => commitQueue(move(queueRef.current, from, to)), [commitQueue]);
  const clearUpcoming = useCallback((): void => { commitQueue(clearQueueUpcoming(queueRef.current)); toast('Cleared what was coming up'); }, [commitQueue, toast]);

  const startRadio = useCallback((seed: RadioSeed, label?: string): void => {
    const picks = radioTracks(indexRef.current, seed, { count: 25, random: seededRandom(`${Date.now()}`), likes: likesRef.current });
    if (picks.length === 0) { toast('There are not enough songs for a radio from that.'); return; }
    startQueue(picks.map((pick) => pick.id), { start: 0, shuffle: false, context: { kind: 'radio', id: `${seed.kind}:${seed.value}`, label: label ?? radioLabel(indexRef.current, seed) } }, seed);
  }, [startQueue, toast]);

  // --- what the listener keeps ---------------------------------------------------------------------------------------------------------------------

  const toggleLike = useCallback((trackId: string): void => {
    const liked = likesRef.current.has(trackId);
    setUser((state) => ({ ...state, likes: liked ? state.likes.filter((id) => id !== trackId) : [trackId, ...state.likes] }));
    void repoRef.current?.setLike(trackId, !liked).catch((reason: unknown) => {
      setUser((state) => ({ ...state, likes: liked ? [trackId, ...state.likes] : state.likes.filter((id) => id !== trackId) }));
      toast(errorText(reason, 'That could not be saved.'));
    });
  }, [toast]);

  const replacePlaylist = useCallback((summary: PlaylistSummary): void => {
    setUser((state) => ({ ...state, playlists: [summary, ...state.playlists.filter((playlist) => playlist.id !== summary.id)] }));
  }, []);

  const createPlaylist = useCallback(async (name: string, trackIds: readonly string[] = []): Promise<PlaylistSummary | null> => {
    try {
      const valid = trackIds.filter((id) => indexRef.current.byId.has(id));
      const id = newId('p_');
      await repoRef.current?.createPlaylist(id, name, valid);
      const created: PlaylistSummary = { id, name, description: '', trackCount: valid.length, updatedAt: new Date().toISOString(), trackIds: [...valid] };
      replacePlaylist(created);
      return created;
    } catch (reason) { toast(errorText(reason, 'The playlist could not be created.')); return null; }
  }, [replacePlaylist, toast]);

  const renamePlaylist = useCallback(async (id: string, name: string): Promise<void> => {
    try {
      await repoRef.current?.renamePlaylist(id, name);
      const before = userRef.current.playlists.find((playlist) => playlist.id === id);
      if (before) replacePlaylist({ ...before, name, updatedAt: new Date().toISOString() });
    } catch (reason) { toast(errorText(reason, 'The playlist could not be renamed.')); }
  }, [replacePlaylist, toast]);

  const deletePlaylist = useCallback(async (id: string): Promise<void> => {
    try {
      await repoRef.current?.deletePlaylist(id);
      setUser((state) => ({ ...state, playlists: state.playlists.filter((playlist) => playlist.id !== id) }));
    } catch (reason) { toast(errorText(reason, 'The playlist could not be deleted.')); }
  }, [toast]);

  const setPlaylistTracks = useCallback(async (id: string, trackIds: readonly string[]): Promise<void> => {
    const before = userRef.current.playlists.find((playlist) => playlist.id === id);
    if (before) replacePlaylist({ ...before, trackIds: [...trackIds], trackCount: trackIds.length });
    try { await repoRef.current?.setPlaylistTracks(id, trackIds); } catch (reason) {
      if (before) replacePlaylist(before);
      toast(errorText(reason, 'The playlist could not be changed.'));
    }
  }, [replacePlaylist, toast]);

  const addToPlaylist = useCallback(async (id: string, trackIds: readonly string[]): Promise<void> => {
    const before = userRef.current.playlists.find((playlist) => playlist.id === id);
    if (!before) return;
    const valid = trackIds.filter((trackId) => indexRef.current.byId.has(trackId));
    await setPlaylistTracks(id, [...before.trackIds, ...valid]);
    toast(valid.length === 1 ? 'Added to playlist' : `${valid.length} songs added to the playlist`);
  }, [setPlaylistTracks, toast]);

  const saveRadio = useCallback(async (seed: RadioSeed, label: string): Promise<SavedRadio | null> => {
    try {
      const radio: SavedRadio = { id: `r_${hex12(`${seed.kind}:${seed.value}`)}`, seedKind: seed.kind, seedValue: seed.value, label, createdAt: new Date().toISOString() };
      await repoRef.current?.saveRadio(radio);
      setUser((state) => ({ ...state, radios: [radio, ...state.radios.filter((existing) => existing.id !== radio.id)] }));
      return radio;
    } catch (reason) { toast(errorText(reason, 'The radio could not be saved.')); return null; }
  }, [toast]);

  const deleteRadio = useCallback(async (id: string): Promise<void> => {
    try {
      await repoRef.current?.deleteRadio(id);
      setUser((state) => ({ ...state, radios: state.radios.filter((radio) => radio.id !== id) }));
    } catch (reason) { toast(errorText(reason, 'The radio could not be removed.')); }
  }, [toast]);

  // --- remembering the place --------------------------------------------------------------------------------------------------------------------------

  const track = useMemo<MusicTrack | null>(() => {
    const item = currentItem(queue);
    return item ? index.byId.get(item.trackId) ?? null : null;
  }, [queue, index]);

  useEffect(() => {
    if (!repo) return;
    const store = (): void => {
      if (queueRef.current.items.length === 0) return;
      const value: Session = { ids: queueRef.current.items.map((item) => item.trackId).slice(0, 500), index: Math.min(queueRef.current.index, 499), position: clock.get().position, context, volume, repeat, shuffle, autoplay, crossfade };
      void repo.setValue(SESSION_KEY, JSON.stringify(value)).catch(() => undefined);
    };
    store();
    const timer = setInterval(store, 5000);
    return () => { clearInterval(timer); store(); };
  }, [repo, queue, context, volume, repeat, shuffle, autoplay, crossfade, clock]);

  const value = useMemo<MusicContextValue>(() => ({
    status, error: library.scan.phase === 'error' ? library.scan.message : null, pending: library.music.pending, index, films, user, likes, canSave: true,
    queue, track, context, playing, buffering, volume, muted, shuffle, repeat, autoplay, crossfade, sleep, rate, clock,
    expanded, sheet, setExpanded, setSheet,
    playTracks, toggle, pause, stopAll, next, previous, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat, setAutoplay: setAutoplayState, setCrossfade: setCrossfadeState, setRate: setRateState, setSleep,
    playNext, addToQueue, removeFromQueue, moveInQueue, jumpTo: goTo, clearUpcoming, startRadio,
    toggleLike, createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, setPlaylistTracks, saveRadio, deleteRadio, toast, toastText,
  }), [status, library.scan, library.music.pending, index, films, user, likes, queue, track, context, playing, buffering, volume, muted, shuffle, repeat, autoplay, crossfade, sleep, rate, clock,
    expanded, sheet, playTracks, toggle, pause, stopAll, next, previous, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat, setSleep, playNext, addToQueue, removeFromQueue, moveInQueue, goTo, clearUpcoming, startRadio,
    toggleLike, createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, setPlaylistTracks, saveRadio, deleteRadio, toast, toastText]);

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}
