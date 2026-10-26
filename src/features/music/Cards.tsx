import { ChevronLeft, ChevronRight, Play, Radio } from 'lucide-react-native';
import { createContext, useCallback, useContext, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { coversOf } from '../../core/musicHelpers';
import type { Album, Artist, Mix, Tile } from '../../core/musicModel';
import type { MusicTrack, PlayContext, PlaylistSummary } from '../../core/musicTypes';
import { useInGrid } from '../../design/Grid';
import { Press } from '../../design/primitives';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useMusic } from './musicContext';
import { useMusicNav } from './musicNav';
import { TrackRow } from './TrackRow';
import { Cover, IconButton, LikedCover, Mosaic } from './ui';

const t = copy.musicView;

/** The visible width of the shelf a column of songs sits in, so each column can be 92% of it (phones) or up to 420. */
const ShelfWidth = createContext(0);

const songCount = (count: number): string => formatContent(count === 1 ? t.oneSong : t.manySongs, { count });

/** The play button that appears over a card's picture (always visible on touch screens). */
function PlayBadge({ label, onPlay, style, size = 36 }: { label: string; onPlay: () => void; style?: ViewStyle; size?: number }) {
  return <Press onPress={onPlay} label={label} style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: M.ink, boxShadow: M.shadowPlay }, style]}>
    <Play size={size * 0.5} color={M.accentInk} fill={M.accentInk} />
  </Press>;
}

function CardFrame({ children, onPress, label, play }: { children: ReactNode; onPress: () => void; label: string; play?: { label: string; onPlay: () => void } | null }) {
  const nav = useMusicNav();
  const inGrid = useInGrid();
  const width = inGrid ? '100%' : nav.compact ? 140 : 168;
  return <View style={{ width, position: 'relative' }}>
    <Press onPress={onPress} label={label} style={{ padding: nav.compact ? 6 : 10, borderRadius: 16, gap: 4 }} pressedStyle={{ backgroundColor: M.surface }}>
      {children}
    </Press>
    {play ? <PlayBadge label={play.label} onPlay={play.onPlay} style={nav.compact ? { right: 12, bottom: 62 } : { right: 18, bottom: 74, width: 38, height: 38 }} /> : null}
  </View>;
}

const CardText = ({ title, subtitle }: { title: string; subtitle: string }) => <>
  <Txt size={15} weight={700} lines={1}>{title}</Txt>
  <Txt size={13} color={M.muted} lines={1}>{subtitle}</Txt>
</>;

const coverShadow = (): ViewStyle => ({ boxShadow: M.shadowCover, marginBottom: 6 });

export function AlbumCard({ album }: { album: Album }) {
  const music = useMusic();
  const nav = useMusicNav();
  const play = (): void => music.playTracks(album.trackIds, { context: { kind: 'album', id: album.id, label: album.name }, shuffle: false });
  return <CardFrame onPress={() => nav.go({ page: 'album', id: album.id })} label={formatContent(t.openAlbum, { name: album.name })} play={{ label: formatContent(t.playAlbum, { name: album.name }), onPlay: play }}>
    <Cover albumId={album.id} cover={album.cover} label={album.name} style={coverShadow()} />
    <CardText title={album.name} subtitle={[album.year, album.artists.slice(0, 2).join(', ') || songCount(album.trackIds.length)].filter(Boolean).join(' · ')} />
  </CardFrame>;
}

export function ArtistCard({ artist }: { artist: Artist }) {
  const music = useMusic();
  const nav = useMusicNav();
  const play = (): void => music.playTracks(artist.trackIds, { context: { kind: 'artist', id: artist.key, label: artist.name }, shuffle: true });
  return <CardFrame onPress={() => nav.go({ page: 'artist', key: artist.key })} label={formatContent(t.openArtist, { name: artist.name })} play={{ label: formatContent(t.playArtist, { name: artist.name }), onPlay: play }}>
    <Cover albumId={artist.coverAlbumId ?? ''} cover={artist.coverAlbumId !== null} label={artist.name} radius={9999} style={coverShadow()} />
    <CardText title={artist.name} subtitle={songCount(artist.trackIds.length)} />
  </CardFrame>;
}

export function MixCard({ mix }: { mix: Mix }) {
  const music = useMusic();
  const nav = useMusicNav();
  const covers = mix.albumIds.flatMap((id) => { const album = music.index.albumById.get(id); return album ? [{ albumId: album.id, cover: album.cover, label: album.name }] : []; });
  const play = (): void => music.playTracks(mix.trackIds, { context: { kind: 'mix', id: mix.id, label: mix.title }, shuffle: false });
  return <CardFrame onPress={() => nav.go({ page: 'mix', id: mix.id })} label={mix.title} play={{ label: formatContent(t.playNamed, { name: mix.title }), onPlay: play }}>
    <Mosaic covers={covers} label={mix.title} style={coverShadow()} />
    <CardText title={mix.title} subtitle={mix.description} />
  </CardFrame>;
}

export function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  const music = useMusic();
  const nav = useMusicNav();
  const tracks = playlist.trackIds.flatMap((id) => music.index.byId.get(id) ?? []);
  const play = (): void => music.playTracks(playlist.trackIds, { context: { kind: 'playlist', id: playlist.id, label: playlist.name }, shuffle: false });
  return <CardFrame onPress={() => nav.go({ page: 'playlist', id: playlist.id })} label={formatContent(t.openPlaylist, { name: playlist.name })} play={tracks.length > 0 ? { label: formatContent(t.playNamed, { name: playlist.name }), onPlay: play } : null}>
    <Mosaic covers={coversOf(tracks)} label={playlist.name} style={coverShadow()} />
    <CardText title={playlist.name} subtitle={`${t.playlistLabel} · ${songCount(playlist.trackCount)}`} />
  </CardFrame>;
}

/** A radio station: starts endless music from a song, singer, film, genre or language. */
export function RadioCard({ id, label, seedKind, seedValue, onRemove }: { id: string; label: string; seedKind: 'track' | 'artist' | 'album' | 'genre' | 'language'; seedValue: string; onRemove?: () => void }) {
  const music = useMusic();
  const seedTracks = seedKind === 'artist' ? (music.index.artistByKey.get(seedValue.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''))?.trackIds ?? [])
    : seedKind === 'album' ? music.index.albumById.get(seedValue)?.trackIds ?? [] : seedKind === 'track' ? [seedValue] : music.index.tracks.filter((track) => (seedKind === 'genre' ? track.genre : track.language) === seedValue).map((track) => track.id);
  const covers = coversOf(seedTracks.flatMap((trackId) => music.index.byId.get(trackId) ?? []));
  const start = (): void => music.startRadio({ kind: seedKind, value: seedValue }, label);
  return <CardFrame onPress={start} label={formatContent(t.playNamed, { name: label })} play={{ label: formatContent(t.playNamed, { name: label }), onPlay: start }}>
    <View style={coverShadow()}>
      <Mosaic covers={covers} label={label} />
      <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <Radio size={14} color="#fff" /><Txt size={11} weight={700} ls={0.04} upper color="#fff">{t.radioBadge}</Txt>
      </View>
    </View>
    <CardText title={label} subtitle={id.startsWith('suggested:') ? t.radioSuggested : t.radioSaved} />
    {onRemove ? <Press onPress={onRemove} label={t.removeRadio} style={{ position: 'absolute', top: 8, left: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)' }}><Txt size={18} color="#fff">×</Txt></Press> : null}
  </CardFrame>;
}

/** Liked Songs, shown like a playlist. */
export function LikedCard() {
  const music = useMusic();
  const nav = useMusicNav();
  const ids = music.user.likes.filter((id) => music.index.byId.has(id));
  return <CardFrame onPress={() => nav.go({ page: 'liked' })} label={t.likedSongs} play={ids.length > 0 ? { label: formatContent(t.playNamed, { name: t.likedSongs }), onPlay: () => music.playTracks(ids, { context: { kind: 'liked', id: null, label: t.likedSongs }, shuffle: false }) } : null}>
    <LikedCover radius={10} glyph={42} style={coverShadow()} />
    <CardText title={t.likedSongs} subtitle={`${t.playlistLabel} · ${songCount(ids.length)}`} />
  </CardFrame>;
}

/** One of the nine tiles of "Speed dial". */
export function SpeedDialTile({ tile }: { tile: Tile }) {
  const music = useMusic();
  const nav = useMusicNav();
  let title = '';
  let subtitle = '';
  let covers: { albumId: string; cover: boolean; label: string }[] = [];
  let open: () => void = () => undefined;
  if (tile.kind === 'album') {
    const album = music.index.albumById.get(tile.id);
    if (!album) return null;
    title = album.name; subtitle = t.albumLabel; covers = [{ albumId: album.id, cover: album.cover, label: album.name }];
    open = () => nav.go({ page: 'album', id: album.id });
  } else if (tile.kind === 'artist') {
    const artist = music.index.artistByKey.get(tile.key);
    if (!artist) return null;
    title = artist.name; subtitle = t.singerLabel; covers = artist.coverAlbumId ? [{ albumId: artist.coverAlbumId, cover: true, label: artist.name }] : [];
    open = () => nav.go({ page: 'artist', key: artist.key });
  } else if (tile.kind === 'playlist') {
    const playlist = music.user.playlists.find((entry) => entry.id === tile.id);
    if (!playlist) return null;
    title = playlist.name; subtitle = t.playlistLabel; covers = coversOf(playlist.trackIds.flatMap((id) => music.index.byId.get(id) ?? []));
    open = () => nav.go({ page: 'playlist', id: playlist.id });
  } else if (tile.kind === 'radio') {
    title = tile.radio.label; subtitle = t.radioBadge;
    covers = coversOf(music.index.tracks.filter((track) => (tile.radio.seedKind === 'artist' ? track.artists.includes(tile.radio.seedValue) : false)));
    open = () => music.startRadio({ kind: tile.radio.seedKind, value: tile.radio.seedValue }, tile.radio.label);
  } else if (tile.kind === 'liked') {
    title = t.likedSongs; subtitle = t.playlistLabel;
    open = () => nav.go({ page: 'liked' });
  } else return null;
  const cover = nav.compact ? 52 : 64;
  return <Press onPress={open} label={title} pressedStyle={{ backgroundColor: M.surfaceHover }}
    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: nav.compact ? 10 : 12, paddingRight: nav.compact ? 8 : 14, borderRadius: 12, borderWidth: 1, borderColor: M.line, backgroundColor: M.surface, overflow: 'hidden' }}>
    <View style={{ width: cover, height: cover }}>
      {tile.kind === 'liked' ? <LikedCover size={cover} radius={0} glyph={22} /> : <Mosaic covers={covers} label={title} radius={0} />}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Txt size={14} weight={700} lines={1}>{title}</Txt>
      <Txt size={12} color={M.muted} lines={1} style={{ marginTop: 2 }}>{subtitle}</Txt>
    </View>
  </Press>;
}

/** A titled row that slides sideways, with arrows that appear when there is more. */
export function Shelf({ title, subtitle, children, action, columns = false, arrows = true, onTitle }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; columns?: boolean; /** show the scroll arrows (a phone swipes, so the new pages leave them off) */ arrows?: boolean; /** makes the title a button, with a chevron, that opens the whole list */ onTitle?: () => void }) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [more, setMore] = useState({ back: false, forward: false });
  const [viewWidth, setViewWidth] = useState(0);
  const sizes = useRef({ offset: 0, view: 0, content: 0 });
  const measure = useCallback((): void => {
    const { offset, view, content } = sizes.current;
    setMore({ back: offset > 4, forward: offset + view < content - 4 });
  }, []);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    sizes.current.offset = event.nativeEvent.contentOffset.x;
    measure();
  };
  const slide = (direction: -1 | 1): void => scroller.current?.scrollTo({ x: Math.max(0, sizes.current.offset + direction * sizes.current.view * 0.85), animated: true });
  return <View accessible={false} style={{ gap: 12, minWidth: 0 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {onTitle
          ? <Press onPress={onTitle} label={title} style={{ alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{title}</Txt>
            <ChevronRight size={20} color={M.muted} strokeWidth={3} />
          </Press>
          : <Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{title}</Txt>}
        {subtitle ? <Txt size={13} weight={500} color={M.muted} style={{ marginTop: 3 }}>{subtitle}</Txt> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {action}
        {arrows ? <>
          <IconButton icon={ChevronLeft} label={t.scrollLeft} onPress={() => slide(-1)} disabled={!more.back} iconSize={20} />
          <IconButton icon={ChevronRight} label={t.scrollRight} onPress={() => slide(1)} disabled={!more.forward} iconSize={20} />
        </> : null}
      </View>
    </View>
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}
      onLayout={(event) => { sizes.current.view = event.nativeEvent.layout.width; setViewWidth(event.nativeEvent.layout.width); measure(); }}
      onContentSizeChange={(width) => { sizes.current.content = width; measure(); }}
      contentContainerStyle={{ gap: columns ? 18 : 14, paddingHorizontal: 2, paddingTop: 4, paddingBottom: 10 }} decelerationRate="fast">
      <ShelfWidth.Provider value={viewWidth}>{children}</ShelfWidth.Provider>
    </ScrollView>
  </View>;
}

/** Songs laid out in columns of four rows that slide sideways (Quick picks, Listen again, mixes). */
export function TrackColumns({ trackIds, context, rows = 4, subtitle, divided = false, peek }: { trackIds: readonly string[]; context: PlayContext; rows?: number; /** replaces the singer line under each title */ subtitle?: (track: MusicTrack) => string; /** a hairline between rows, and covers flush with the left edge */ divided?: boolean; /** how much of the shelf the next column shows (0 to 0.5), instead of the usual 8% */ peek?: number }) {
  const music = useMusic();
  const nav = useMusicNav();
  const shelfWidth = useContext(ShelfWidth);
  const tracks = trackIds.flatMap((id) => music.index.byId.get(id) ?? []);
  const ids = tracks.map((track) => track.id);
  const width = shelfWidth > 0 ? (nav.compact ? shelfWidth * (1 - (peek ?? 0.08)) : Math.min(shelfWidth, 420)) : 300;
  const columns: { track: (typeof tracks)[number]; position: number }[][] = [];
  tracks.forEach((track, position) => { const column = Math.floor(position / rows); (columns[column] ??= []).push({ track, position }); });
  return <>{columns.map((column, index) => <View key={index} style={{ width }}>
    {column.map(({ track, position }, row) => <TrackRow key={track.id} track={track} showAlbum={false} subtitle={subtitle?.(track)} divider={divided && row < column.length - 1} flush={divided} onPlay={() => music.playTracks(ids, { start: position, context, shuffle: false })} />)}
  </View>)}</>;
}
