import type { NativeRect, NativeTrackInfo } from '../../modules/wave-media';

/** What reading a file's tags found (only text the file itself carries, exactly as tagged). */
export type StoredTags = {
  title?: string; artist?: string; albumArtist?: string; album?: string; genre?: string; composer?: string;
  date?: string; year?: string; track?: string; disc?: string;
  audioTracks?: NativeTrackInfo[];
  subtitleTracks?: NativeTrackInfo[];
  /** where the real picture sits inside baked-in black bars (null: measured, no bars) */
  contentRect?: NativeRect | null;
};

/** One audio or video file on this device, as the app catalogued it. The original file is never changed. */
export type MediaRecord = {
  id: string;
  kind: 'audio' | 'video';
  uri: string;
  name: string;
  folder: string;
  size: number;
  modified: number;
  added: number;
  /** when this app first saw the file */
  seenAt: number;
  duration: number;
  width: number;
  height: number;
  mime: string;
  tags: StoredTags | null;
  cover: boolean;
  lyrics: boolean;
  /** 0 until the tags have been read */
  readAt: number;
  missing: boolean;
};

export type LocalProfile = { id: string; name: string; createdAt: string };

export type ScanPhase = 'idle' | 'listing' | 'reading' | 'artwork' | 'done' | 'error';
export type ScanProgress = { phase: ScanPhase; done: number; total: number; message: string | null };
