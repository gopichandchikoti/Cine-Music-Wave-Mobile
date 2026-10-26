import { useCallback, useEffect, useState } from 'react';
import { useLibrary } from '../../data/LibraryProvider';
import type { Rgb3 } from '../../design/color';
import Wave from '../../../modules/wave-media';
import { useArt } from '../../platform/artwork';

/** The size a cover is read at to find its colour: tiny, because only the overall colour matters. */
const TINT_PX = 96;

const found = new Map<string, Rgb3 | null>();

/**
 * The colour that stands out most in an album's cover, used to tint the page around it (the artist and album pages take their colour
 * from the picture). It is null while the answer is being worked out and when the album has no cover. Answers are remembered.
 */
export function useCoverTint(albumId: string | null, hasCover: boolean): Rgb3 | null {
  const library = useLibrary();
  const source = hasCover && albumId ? library.coverSource(albumId) : undefined;
  const key = source && albumId ? `tint:${albumId}` : null;
  const make = useCallback(() => (source && albumId ? Wave.artwork(source.uri, 'audio', `cover:${albumId}`, TINT_PX) : Promise.resolve(null)), [source, albumId]);
  const uri = useArt(key, key ? make : null);
  const [answer, setAnswer] = useState<{ uri: string; color: Rgb3 | null } | null>(null);
  useEffect(() => {
    if (!uri || found.has(uri)) return undefined;
    let cancelled = false;
    Wave.dominantColor(uri).then((rgb) => {
      const color = rgb && rgb.length === 3 ? [rgb[0], rgb[1], rgb[2]] as const : null;
      found.set(uri, color);
      if (!cancelled) setAnswer({ uri, color });
    }, () => { found.set(uri, null); });
    return () => { cancelled = true; };
  }, [uri]);
  if (!uri) return null;
  return found.has(uri) ? found.get(uri) ?? null : answer?.uri === uri ? answer.color : null;
}
