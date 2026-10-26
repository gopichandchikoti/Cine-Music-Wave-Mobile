/** What a song file says about itself, exactly as tagged (junk included); musicMetadata.cleanTags turns it into what the app shows. */
export type ProbedTags = {
  title: string | null;
  artist: string | null;
  albumArtist: string | null;
  album: string | null;
  genre: string | null;
  date: string | null;
  track: string | null;
  disc: string | null;
  composer: string | null;
  language: string | null;
  bpm: number | null;
  hasLyrics: boolean;
};
