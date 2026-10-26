import { Eraser, Infinity as InfinityIcon, ListPlus, Radio, Repeat, Repeat1, Shuffle } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { lyricsFromText } from '../../core/lyrics';
import { artistLine, keyOf, radioTracks, seededRandom } from '../../core/musicModel';
import type { Lyrics, MusicTrack } from '../../core/musicTypes';
import { useLibrary } from '../../data/LibraryProvider';
import { Press } from '../../design/primitives';
import { clamp, inkAlpha, music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import Wave from '../../../modules/wave-media';
import { useMusic, usePlaybackClock } from './musicContext';
import { useMusicNav } from './musicNav';
import { TrackRow } from './TrackRow';
import { EmptyNote, IconButton, Note, Pill } from './ui';
import { useSortable } from './useSortable';

const t = copy.musicView;

/** Everything in the queue, in order, with the playing song marked. Drag a handle to re-order; press × to remove. */
export function QueueSheet() {
  const music = useMusic();
  const nav = useMusicNav();
  const [dragging, setDragging] = useState(false);
  const sortable = useSortable({ count: music.queue.items.length, onMove: music.moveInQueue, onActive: setDragging });
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const currentUid = music.queue.items[music.queue.index]?.uid;
  const rows = music.queue.items.flatMap((item, position) => {
    const track = music.index.byId.get(item.trackId);
    return track ? [{ item, track, position }] : [];
  });
  const upcomingCount = Math.max(0, music.queue.items.length - music.queue.index - 1);

  useEffect(() => {
    // Only when the sheet opens: scrolling again whenever the song changes would fight someone who is browsing the queue.
    const timer = setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, (music.queue.index - 2) * 62), animated: false }), 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const repeatLabel = music.repeat === 'off' ? t.repeatOff : music.repeat === 'all' ? t.repeatAll : t.repeatOne;
  return <View style={{ flex: 1, minHeight: 0 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4, paddingHorizontal: 18, paddingBottom: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={20} weight={800} accessibilityRole="header">{t.upNext}</Txt>
        <Txt size={13} color={M.muted} lines={1} style={{ marginTop: 2 }}>{music.context ? formatContent(t.playingFrom, { name: music.context.label }) : t.yourQueue}{upcomingCount > 0 ? ` · ${formatContent(t.songsToCome, { count: upcomingCount })}` : ''}</Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton icon={Shuffle} label={t.shuffle} onPress={music.toggleShuffle} on={music.shuffle} iconSize={18} />
        <IconButton icon={music.repeat === 'one' ? Repeat1 : Repeat} label={repeatLabel} onPress={music.cycleRepeat} on={music.repeat !== 'off'} iconSize={18} />
        <IconButton icon={InfinityIcon} label={t.autoplay} onPress={() => music.setAutoplay(!music.autoplay)} on={music.autoplay} iconSize={18} />
        <IconButton icon={ListPlus} label={t.saveQueue} onPress={() => nav.pickPlaylist(music.queue.items.map((item) => item.trackId))} disabled={rows.length === 0} iconSize={18} />
        <IconButton icon={Eraser} label={t.clearQueue} onPress={music.clearUpcoming} disabled={upcomingCount === 0} iconSize={18} />
      </View>
    </View>
    {rows.length === 0
      ? <EmptyNote>{t.queueEmpty}</EmptyNote>
      : <ScrollView ref={scroller} scrollEnabled={!dragging} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 14 }}>
        {rows.map(({ item, track, position }) => <TrackRow key={item.uid} track={track} showAlbum={false} queue current={item.uid === currentUid} past={position < music.queue.index} position={position} sortable={sortable}
          source={{ queuePosition: position }} onPlay={() => music.jumpTo(position)} onRemove={() => music.removeFromQueue(position)} />)}
        {music.autoplay ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 12 }}><InfinityIcon size={14} color={M.muted} /><Txt size={13} color={M.muted} lh={1.5} style={{ flex: 1 }}>{t.autoplayContinues}</Txt></View> : null}
      </ScrollView>}
  </View>;
}

const activeIndex = (lines: readonly { time: number }[], position: number): number => {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].time <= position + 0.25) { found = middle; low = middle + 1; } else high = middle - 1;
  }
  return found;
};

/** Lyrics that follow the song (when they are timed), or plain lyrics to read. They come from the lyrics tag inside the song file. */
export function LyricsSheet() {
  const music = useMusic();
  const library = useLibrary();
  const { width } = useWindowDimensions();
  const { position } = usePlaybackClock();
  const trackId = music.track?.id ?? null;
  const [loaded, setLoaded] = useState<{ trackId: string; lyrics: Lyrics | null; failed: boolean } | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<number[]>([]);
  const lastTouch = useRef(0);

  useEffect(() => {
    if (!trackId) return;
    let cancelled = false;
    const record = library.recordOf(trackId);
    if (!record) { setLoaded({ trackId, lyrics: null, failed: true }); return; }
    Wave.lyrics(record.uri).then(
      (text) => { if (!cancelled) setLoaded({ trackId, lyrics: text ? lyricsFromText(text, 'tag') : null, failed: false }); },
      () => { if (!cancelled) setLoaded({ trackId, lyrics: null, failed: true }); },
    );
    return () => { cancelled = true; };
  }, [trackId, library]);

  const state = loaded?.trackId === trackId ? loaded : null;
  const lines = state?.lyrics?.synced ?? null;
  const current = lines ? activeIndex(lines, position) : -1;

  useEffect(() => {
    if (current < 0 || Date.now() - lastTouch.current < 4000) return;
    const y = offsets.current[current];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
  }, [current]);

  const size = clamp(22, width * 0.044, 32);
  return <View style={{ flex: 1, minHeight: 0 }}>
    <View style={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 10 }}>
      <Txt size={20} weight={800} accessibilityRole="header">{t.lyrics}</Txt>
      {music.track ? <Txt size={13} color={M.muted} lines={1} style={{ marginTop: 2 }}>{music.track.title}</Txt> : null}
    </View>
    <ScrollView ref={scroller} onScrollBeginDrag={() => { lastTouch.current = Date.now(); }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 40, gap: 4 }}>
      {!trackId ? <EmptyNote>{t.nothingPlaying}</EmptyNote> : null}
      {trackId && !state ? <Note spinner>{t.loadingLyrics}</Note> : null}
      {state?.failed ? <EmptyNote>{t.lyricsFailed}</EmptyNote> : null}
      {state && !state.failed && !state.lyrics ? <EmptyNote hint="Lyrics are read from the lyrics tag stored inside the song file.">{t.noLyrics}</EmptyNote> : null}
      {lines ? lines.map((line, index) => <Press key={`${line.time}:${index}`} onPress={() => music.seek(line.time)} label={line.text || '♪'}
        style={{ paddingVertical: 8, paddingHorizontal: 4, transform: index === current ? [{ scale: 1.04 }] : undefined }}>
        <View onLayout={(event) => { offsets.current[index] = event.nativeEvent.layout.y; }}>
          <Txt size={size} weight={800} lh={1.25} ls={-0.02} color={index === current ? M.text : index < current ? inkAlpha(0.28) : inkAlpha(0.4)}>{line.text || '♪'}</Txt>
        </View>
      </Press>) : null}
      {state?.lyrics?.plain ? <Txt size={20} lh={1.7} color={inkAlpha(0.9)}>{state.lyrics.plain}</Txt> : null}
    </ScrollView>
  </View>;
}

/** More from the same film and singers, and songs like this one. */
export function RelatedSheet() {
  const music = useMusic();
  const track = music.track;
  const sections = useMemo(() => {
    if (!track) return null;
    const sameAlbum = (music.index.albumById.get(track.albumId)?.trackIds ?? []).filter((id) => id !== track.id).flatMap((id) => music.index.byId.get(id) ?? []);
    const bySinger = [...new Set(track.artists.flatMap((name) => music.index.artistByKey.get(keyOf(name))?.trackIds ?? []))].filter((id) => id !== track.id && !sameAlbum.some((entry) => entry.id === id)).flatMap((id) => music.index.byId.get(id) ?? []).slice(0, 12);
    const like = radioTracks(music.index, { kind: 'track', value: track.id }, { count: 13, random: seededRandom(`related:${track.id}`), exclude: new Set([track.id]), likes: music.likes });
    return { sameAlbum, bySinger, like };
  }, [track, music.index, music.likes]);
  if (!track || !sections) return <View style={{ flex: 1 }}><EmptyNote>{t.nothingPlaying}</EmptyNote></View>;
  const block = (title: string, tracks: readonly MusicTrack[], label: string, action?: () => void) => (tracks.length === 0 ? null : (
    <View accessibilityLabel={title} style={{ paddingVertical: 6, paddingHorizontal: 4, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <Txt size={16} weight={800} accessibilityRole="header" style={{ flex: 1 }}>{title}</Txt>
        {action ? <Pill icon={Radio} onPress={action}>{t.startRadio}</Pill> : null}
      </View>
      <View>{tracks.map((entry, position) => <TrackRow key={entry.id} track={entry} showAlbum={false} onPlay={() => music.playTracks(tracks.map((other) => other.id), { start: position, context: { kind: 'mix', id: null, label } })} />)}</View>
    </View>
  ));
  return <View style={{ flex: 1, minHeight: 0 }}>
    <View style={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 10 }}>
      <Txt size={20} weight={800} accessibilityRole="header">{t.related}</Txt>
      <Txt size={13} color={M.muted} lines={1} style={{ marginTop: 2 }}>{artistLine(track) || track.album}</Txt>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 14, gap: 4 }}>
      {block(formatContent(t.moreFromFilm, { name: track.album }), sections.sameAlbum, track.album)}
      {block(t.moreFromSingers, sections.bySinger, t.moreFromSingers)}
      {block(t.songsLikeThis, sections.like, t.songsLikeThis, () => music.startRadio({ kind: 'track', value: track.id }))}
    </ScrollView>
  </View>;
}
