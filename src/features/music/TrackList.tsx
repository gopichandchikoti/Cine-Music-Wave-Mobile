import { useState } from 'react';
import { View } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import type { MusicTrack, PlayContext } from '../../core/musicTypes';
import { useMusic } from './musicContext';
import type { MenuSource } from './musicNav';
import { TrackRow } from './TrackRow';
import { Pill } from './ui';

const t = copy.musicView;
const PAGE = 200;

type TrackListProps = {
  tracks: readonly MusicTrack[];
  context: PlayContext;
  /** Show 1, 2, 3 … instead of covers (albums). */
  numbered?: boolean;
  showAlbum?: boolean;
  source?: MenuSource;
};

/** A list of songs. Pressing one plays the whole list from it, so what comes next is the rest of the list. */
export function TrackList({ tracks, context, numbered = false, showAlbum = true, source }: TrackListProps) {
  const music = useMusic();
  const [shown, setShown] = useState(PAGE);
  const visible = tracks.slice(0, shown);
  const ids = tracks.map((track) => track.id);
  return <View>
    {visible.map((track, position) => <TrackRow key={`${track.id}:${position}`} track={track} number={numbered ? track.track ?? position + 1 : undefined} showCover={!numbered} showAlbum={showAlbum} source={source} onPlay={() => music.playTracks(ids, { start: position, context })} />)}
    {tracks.length > shown ? <View style={{ alignItems: 'center', marginTop: 10 }}><Pill onPress={() => setShown(shown + PAGE)}>{formatContent(t.showMore, { count: tracks.length - shown })}</Pill></View> : null}
  </View>;
}
