import type { MediaRecord } from '../data/types';
import { parseAlbumFolder, parseTrackName, parseVideoName, titleKey } from './filename';
import { hex12 } from './hash';
import { cleanTags, nameKey } from './musicMetadata';
import type { MusicTrack } from './musicTypes';
import type { ProbedTags } from './probedTags';
import type { AudioTrack, Resolution, SubtitleOption, WatchFile, WatchKind, WatchTitle } from './watchTypes';

// Turns catalogued device files into what the Music and Watch screens show. This is the phone's counterpart of the web server's
// MusicLibrary.tracks() and groupEntries(): the same cleaning and grouping rules, fed by Android's own indexing instead of a folder walk.

const relativePathOf = (record: MediaRecord): string => (record.folder ? `${record.folder}/${record.name}` : record.name);

const probedTagsOf = (record: MediaRecord): ProbedTags => {
  const tags = record.tags;
  return {
    title: tags?.title ?? null,
    artist: tags?.artist ?? null,
    albumArtist: tags?.albumArtist ?? null,
    album: tags?.album ?? null,
    genre: tags?.genre ?? null,
    date: tags?.date ?? tags?.year ?? null,
    track: tags?.track ?? null,
    disc: tags?.disc ?? null,
    composer: tags?.composer ?? null,
    language: null,
    bpm: null,
    hasLyrics: record.lyrics,
  };
};

export const albumIdFor = (albumKey: string): string => `a_${hex12(albumKey)}`;
export const titleIdFor = (key: string): string => `t_${hex12(key)}`;

export type CoverSource = { recordId: string; uri: string };

export type BuiltMusic = {
  tracks: MusicTrack[];
  /** one song per album that carries a picture, so the cover can be extracted when first needed */
  coverSources: Map<string, CoverSource>;
  /** songs whose tags have not been read yet */
  pending: number;
};

export function buildMusic(records: readonly MediaRecord[]): BuiltMusic {
  const audio = records.filter((record) => record.kind === 'audio' && !record.missing);
  const ready = audio.filter((record) => record.readAt > 0);
  const sources = ready.map((record) => ({ record, clean: cleanTags(probedTagsOf(record), relativePathOf(record)) }));
  // One person is written many ways ("S.P.Balasubrahmanyam", "S. P. Balasubrahmanyam"); the most common spelling is used everywhere.
  const spellings = new Map<string, Map<string, number>>();
  for (const { clean } of sources) {
    for (const name of [...clean.artists, ...clean.cast]) {
      const counts = spellings.get(nameKey(name)) ?? new Map<string, number>();
      counts.set(name, (counts.get(name) ?? 0) + 1);
      spellings.set(nameKey(name), counts);
    }
  }
  const canonical = (name: string): string => [...(spellings.get(nameKey(name)) ?? new Map([[name, 1]])).entries()].sort((left, right) => right[1] - left[1] || left[0].length - right[0].length)[0][0];
  const coverSources = new Map<string, CoverSource>();
  for (const { record, clean } of sources) {
    const albumId = albumIdFor(clean.albumKey);
    if (record.cover && !coverSources.has(albumId)) coverSources.set(albumId, { recordId: record.id, uri: record.uri });
  }
  const tracks = sources.map(({ record, clean }): MusicTrack => {
    const albumId = albumIdFor(clean.albumKey);
    return {
      id: record.id,
      title: clean.title,
      artists: clean.artists.map(canonical),
      album: clean.album,
      albumId,
      year: clean.year,
      track: clean.track,
      disc: clean.disc,
      genre: clean.genre,
      language: clean.language,
      cast: clean.cast.map(canonical),
      bpm: clean.bpm,
      duration: record.duration,
      format: record.mime.split('/')[1]?.replace('x-', '') || record.name.split('.').pop()?.toLowerCase() || 'audio',
      size: record.size,
      cover: coverSources.has(albumId),
      lyrics: clean.hasLyrics,
      addedAt: new Date(record.modified || record.added).toISOString(),
      loudness: null,
    };
  });
  return { tracks, coverSources, pending: audio.length - ready.length };
}

// --- Watch -----------------------------------------------------------------------------------------------------------------------------

const LANGUAGE_NAMES: Record<string, string> = {
  tel: 'Telugu', te: 'Telugu', tam: 'Tamil', ta: 'Tamil', hin: 'Hindi', hi: 'Hindi', mal: 'Malayalam', ml: 'Malayalam', kan: 'Kannada', kn: 'Kannada',
  eng: 'English', en: 'English', kor: 'Korean', ko: 'Korean', jpn: 'Japanese', ja: 'Japanese', spa: 'Spanish', es: 'Spanish', fre: 'French', fra: 'French', fr: 'French',
  ger: 'German', deu: 'German', de: 'German', ita: 'Italian', it: 'Italian', por: 'Portuguese', pt: 'Portuguese', rus: 'Russian', ru: 'Russian', chi: 'Chinese', zho: 'Chinese', zh: 'Chinese',
  ara: 'Arabic', ar: 'Arabic', ben: 'Bengali', bn: 'Bengali', mar: 'Marathi', mr: 'Marathi', pan: 'Punjabi', pa: 'Punjabi', guj: 'Gujarati', gu: 'Gujarati', urd: 'Urdu', ur: 'Urdu',
  tha: 'Thai', th: 'Thai', tur: 'Turkish', tr: 'Turkish', ind: 'Indonesian', id: 'Indonesian',
};
const CODEC_NAMES: Record<string, string> = {
  'audio/eac3': 'Dolby Digital Plus', 'audio/eac3-joc': 'Dolby Digital Plus', 'audio/ac3': 'Dolby Digital', 'audio/mp4a-latm': 'AAC', 'audio/aac': 'AAC', 'audio/vnd.dts': 'DTS', 'audio/vnd.dts.hd': 'DTS-HD',
  'audio/true-hd': 'Dolby TrueHD', 'audio/mpeg': 'MP3', 'audio/opus': 'Opus', 'audio/flac': 'FLAC', 'audio/vorbis': 'Vorbis',
};
const channelLabel = (channels: number): string => (channels === 1 ? 'Mono' : channels === 2 ? 'Stereo' : channels === 6 ? '5.1' : channels === 8 ? '7.1' : channels > 0 ? `${channels}ch` : '');

export const languageName = (code: string | null | undefined): string | null => {
  if (!code) return null;
  const lower = code.toLowerCase();
  if (lower === 'und' || lower === 'unk' || lower === 'zxx') return null;
  return LANGUAGE_NAMES[lower] ?? code.toUpperCase();
};

const resolutionLabel = (height: number): Resolution | null => (height <= 0 ? null : height >= 2000 ? '4K' : height >= 700 ? 'HD' : 'SD');

type Group = {
  key: string;
  kind: WatchKind;
  title: string;
  year: number | null;
  languages: Set<string>;
  files: { record: MediaRecord; season: number | null; episode: number | null; episodeTitle: string | null; name: string }[];
};

const byEpisode = (left: Group['files'][number], right: Group['files'][number]): number =>
  (left.season ?? 0) - (right.season ?? 0) || (left.episode ?? 0) - (right.episode ?? 0) || left.name.localeCompare(right.name, 'en', { numeric: true });

/** One movie per film, one series per show (the web catalog's grouping, on file names and folders). */
export function groupVideos(records: readonly MediaRecord[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const record of records) {
    const folders = record.folder ? record.folder.split('/').filter(Boolean) : [];
    const parsed = parseVideoName(record.name, folders);
    const isSeries = parsed.season !== null;
    const key = isSeries ? `series:${titleKey(parsed.title)}` : `movie:${titleKey(parsed.title)}:${parsed.year ?? ''}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, kind: isSeries ? 'series' : 'movie', title: parsed.title, year: parsed.year, languages: new Set(), files: [] };
      groups.set(key, group);
    }
    group.files.push({ record, season: parsed.season, episode: parsed.episode, episodeTitle: parsed.episodeTitle, name: record.name });
    for (const language of parsed.languages) group.languages.add(language);
    if (group.year === null && parsed.year !== null) group.year = parsed.year;
  }
  for (const group of groups.values()) group.files.sort(byEpisode);
  return groups;
}

const audioTrackOf = (info: { mime: string; language: string | null; channels?: number }, ordinal: number): AudioTrack => {
  const language = languageName(info.language);
  const detail = [CODEC_NAMES[info.mime.toLowerCase()] ?? info.mime.replace('audio/', '').toUpperCase(), channelLabel(info.channels ?? 0)].filter(Boolean).join(' ');
  return { ordinal, label: `${language ?? `Track ${ordinal + 1}`} · ${detail}`, language: info.language, default: ordinal === 0 };
};

const subtitleOf = (info: { mime: string; language: string | null }, ordinal: number): SubtitleOption => ({
  ordinal, label: languageName(info.language) ?? `Subtitles ${ordinal + 1}`, language: info.language, default: false,
});

export function buildTitles(records: readonly MediaRecord[]): WatchTitle[] {
  const videos = records.filter((record) => record.kind === 'video' && !record.missing);
  const titles: WatchTitle[] = [];
  for (const group of groupVideos(videos).values()) {
    const id = titleIdFor(group.key);
    const files: WatchFile[] = group.files.map(({ record, season, episode, episodeTitle }) => ({
      id: record.id,
      season,
      episode,
      title: episodeTitle,
      duration: record.duration > 0 ? record.duration : null,
      quality: resolutionLabel(record.height),
      height: record.height > 0 ? record.height : null,
      hdr: false,
      audio: (record.tags?.audioTracks ?? []).map(audioTrackOf),
      subtitles: (record.tags?.subtitleTracks ?? []).map(subtitleOf),
      probed: record.readAt > 0,
      thumb: record.readAt > 0 ? 1 : null,
    }));
    const pictured = files.some((file) => file.probed);
    titles.push({
      id,
      kind: group.kind,
      title: group.title,
      year: group.year,
      overview: '',
      genres: [],
      languages: [...group.languages],
      rating: null,
      addedAt: new Date(Math.min(...group.files.map(({ record }) => record.seenAt))).toISOString(),
      art: { card: pictured ? 1 : null, backdrop: pictured ? 1 : null },
      files,
    });
  }
  return titles;
}

export { parseAlbumFolder, parseTrackName };
