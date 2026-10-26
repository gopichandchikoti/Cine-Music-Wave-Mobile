import { createContext, useContext, useSyncExternalStore } from 'react';
import type { LibraryIndex, RadioSeed } from '../../core/musicModel';
import type { Queue, RepeatMode } from '../../core/queue';
import type { MusicState, MusicTrack, PlayContext, PlaylistSummary, SavedRadio } from '../../core/musicTypes';

/** The playing position, kept outside React state so the progress bar can tick four times a second without re-rendering the screen. */
export class PlaybackClock {
  private snapshot = { position: 0, duration: 0 };
  private readonly listeners = new Set<() => void>();
  set(position: number, duration: number): void {
    if (position === this.snapshot.position && duration === this.snapshot.duration) return;
    this.snapshot = { position, duration };
    for (const listener of this.listeners) listener();
  }
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get = (): { position: number; duration: number } => this.snapshot;
}

export type SleepTimer = { endsAt: number | null; endOfTrack: boolean };
export type Sheet = 'queue' | 'lyrics' | 'related' | null;

export type MusicContextValue = {
  // the library
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** Songs whose tags are still being read. */
  pending: number;
  index: LibraryIndex;
  films: readonly { title: string; year: number | null }[];
  user: MusicState;
  likes: ReadonlySet<string>;
  canSave: boolean;

  // what is playing
  queue: Queue;
  track: MusicTrack | null;
  context: PlayContext | null;
  playing: boolean;
  buffering: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  autoplay: boolean;
  crossfade: number;
  sleep: SleepTimer;
  rate: number;
  clock: PlaybackClock;

  // the full-screen player and its sheets
  expanded: boolean;
  sheet: Sheet;
  setExpanded: (expanded: boolean) => void;
  setSheet: (sheet: Sheet) => void;

  // transport
  playTracks: (trackIds: readonly string[], options?: { start?: number; context?: PlayContext; shuffle?: boolean }) => void;
  toggle: () => void;
  /** Pauses without starting anything (a film is about to play). */
  pause: () => void;
  /** Stops and forgets the queue (the profile is being left). */
  stopAll: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setAutoplay: (value: boolean) => void;
  setCrossfade: (seconds: number) => void;
  setRate: (rate: number) => void;
  setSleep: (minutes: number | 'track' | null) => void;

  // the queue
  playNext: (trackIds: readonly string[]) => void;
  addToQueue: (trackIds: readonly string[]) => void;
  removeFromQueue: (position: number) => void;
  moveInQueue: (from: number, to: number) => void;
  jumpTo: (position: number) => void;
  clearUpcoming: () => void;
  startRadio: (seed: RadioSeed, label?: string) => void;

  // what the listener keeps
  toggleLike: (trackId: string) => void;
  createPlaylist: (name: string, trackIds?: readonly string[]) => Promise<PlaylistSummary | null>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (id: string, trackIds: readonly string[]) => Promise<void>;
  setPlaylistTracks: (id: string, trackIds: readonly string[]) => Promise<void>;
  saveRadio: (seed: RadioSeed, label: string) => Promise<SavedRadio | null>;
  deleteRadio: (id: string) => Promise<void>;

  toast: (message: string) => void;
  toastText: string | null;
};

export const MusicContext = createContext<MusicContextValue | null>(null);

export function useMusic(): MusicContextValue {
  const value = useContext(MusicContext);
  if (!value) throw new Error('useMusic must be used inside the music provider.');
  return value;
}

/** The playing position and the song's length; the component re-renders as the song plays. */
export function usePlaybackClock(): { position: number; duration: number } {
  const { clock } = useMusic();
  return useSyncExternalStore(clock.subscribe, clock.get);
}
