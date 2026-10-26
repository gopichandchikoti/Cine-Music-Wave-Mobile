import { requireNativeModule } from 'expo';

/** One MediaStore (or picked-document) row: cheap facts only, no tag reading yet. */
export type NativeRow = {
  key: string;
  kind: 'audio' | 'video';
  uri: string;
  name: string;
  /** the folder the file sits in, e.g. "Music/Tillu Square" */
  folder: string;
  size: number;
  modified: number;
  added: number;
  mime: string;
  duration: number;
  width: number;
  height: number;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  genre?: string | null;
  year?: string | null;
  track?: string | null;
  disc?: string | null;
  composer?: string | null;
};

export type NativeTrackInfo = { mime: string; language: string | null; channels?: number };

export type NativeTags = {
  uri: string;
  readable: boolean;
  title?: string; artist?: string; albumArtist?: string; album?: string; genre?: string; composer?: string;
  date?: string; year?: string; track?: string; disc?: string;
  duration?: number;
  hasCover?: boolean;
  hasLyrics?: boolean;
  width?: number;
  height?: number;
  audioTracks?: NativeTrackInfo[];
  subtitleTracks?: NativeTrackInfo[];
};

export type NativeRect = { x: number; y: number; w: number; h: number };

type WaveMediaNative = {
  list(kind: 'audio' | 'video', offset: number, limit: number): Promise<NativeRow[]>;
  readTags(uris: string[], kind: 'audio' | 'video'): Promise<NativeTags[]>;
  artwork(uri: string, kind: 'audio' | 'video', key: string, maxPx: number): Promise<string | null>;
  lyrics(uri: string): Promise<string | null>;
  contentRect(uri: string): Promise<NativeRect | null>;
  /** [r, g, b] of the picture's most striking colour, or null */
  dominantColor(uri: string): Promise<number[] | null>;
  exists(uri: string): Promise<boolean>;
  requestScan(paths: string[]): Promise<number>;
  pick(folder: boolean): Promise<NativeRow[]>;
  pickedFolders(): Promise<NativeRow[]>;
};

export default requireNativeModule<WaveMediaNative>('WaveMedia');
