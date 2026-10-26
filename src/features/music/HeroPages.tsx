import { Play, Radio, Shuffle, Star } from 'lucide-react-native';
import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { lengthOf } from '../../core/musicHelpers';
import { keyOf, type Album, type Artist } from '../../core/musicModel';
import type { MusicTrack, PlayContext } from '../../core/musicTypes';
import { Dither } from '../../design/Dither';
import { Glass } from '../../design/Glass';
import { Press } from '../../design/primitives';
import { clamp, music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { AlbumCard, ArtistCard, Shelf, TrackColumns } from './Cards';
import { useCoverTint } from './coverTint';
import { ActionCircle, heroHeight, HeroImage, tintedPage, usePageTint } from './Hero';
import { useMusic } from './musicContext';
import { useMusicNav } from './musicNav';
import { TrackList } from './TrackList';
import { Cover } from './ui';

/*
 * The artist and album pages on a phone: a picture edge to edge, the name over its foot, round buttons, then the page. The page takes a
 * tint from the picture. The wide layouts keep the headers in DetailPages.
 */

const t = copy.musicView;
const SIDE = 14;
const SECTION_GAP = 22;
/** How many songs "Top songs" shows: three columns of four. */
const TOP_SONGS = 12;
/** How much of the shelf the next column of "Top songs" shows at its edge, so it is plain there is more to swipe to. */
const TOP_SONGS_PEEK = 0.16;

const songCount = (count: number): string => formatContent(count === 1 ? t.oneSong : t.manySongs, { count });

/** The album the singer is best known by here: the one whose songs were played most, then the newest. */
function featuredOf(albums: readonly Album[], plays: ReadonlyMap<string, number>): Album | null {
  const played = (album: Album): number => album.trackIds.reduce((total, id) => total + (plays.get(id) ?? 0), 0);
  return [...albums].sort((left, right) => played(right) - played(left) || (right.year ?? 0) - (left.year ?? 0))[0] ?? null;
}

function FeaturedAlbum({ album }: { album: Album }) {
  const music = useMusic();
  const nav = useMusicNav();
  const play = (): void => music.playTracks(album.trackIds, { context: { kind: 'album', id: album.id, label: album.name }, shuffle: false });
  return <Glass radius={22} blur={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10 }}>
    <Press onPress={() => nav.go({ page: 'album', id: album.id })} label={formatContent(t.openAlbum, { name: album.name })} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 58 }}><Cover albumId={album.id} cover={album.cover} label={album.name} radius={8} maxPx={240} style={{ boxShadow: M.shadowThumb }} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt family="mono" weight={500} size={10} ls={0.14} upper color={M.muted} lines={1}>{t.featuredAlbum}</Txt>
        <Txt size={17} weight={700} lines={1}>{album.name}</Txt>
        <Txt size={13} color={M.muted} lines={1}>{[album.year, songCount(album.trackIds.length)].filter(Boolean).join(' · ')}</Txt>
      </View>
    </Press>
    <Press onPress={play} label={formatContent(t.playAlbum, { name: album.name })} pressScale={0.92} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: M.solid }}>
      <Play size={20} color={M.accentInk} fill={M.accentInk} />
    </Press>
  </Glass>;
}

type ArtistHeroProps = { artist: Artist; tracks: readonly MusicTrack[]; popular: readonly MusicTrack[]; albums: readonly Album[]; together: readonly Artist[]; context: PlayContext };

export function ArtistHeroPage({ artist, tracks, popular, albums, together, context }: ArtistHeroProps) {
  const music = useMusic();
  const { width } = useWindowDimensions();
  const height = heroHeight(width);
  const page = usePageTint(useCoverTint(artist.coverAlbumId, artist.coverAlbumId !== null));
  const ids = tracks.map((track) => track.id);
  const radioLabel = `${artist.name} Radio`;
  const saved = music.user.radios.find((radio) => radio.seedKind === 'artist' && keyOf(radio.seedValue) === artist.key);
  const plays = useMemo(() => new Map(music.user.plays.map((play) => [play.trackId, play.count])), [music.user.plays]);
  const featured = useMemo(() => featuredOf(albums, plays), [albums, plays]);
  const top = useMemo(() => popular.slice(0, TOP_SONGS).map((track) => track.id), [popular]);
  const toggleSaved = (): void => {
    if (saved) {
      void music.deleteRadio(saved.id).then(() => music.toast(formatContent(t.radioRemovedToast, { name: radioLabel })));
      return;
    }
    void music.saveRadio({ kind: 'artist', value: artist.name }, radioLabel).then((created) => { if (created) music.toast(formatContent(t.radioSavedToast, { name: radioLabel })); });
  };
  return <View style={{ backgroundImage: tintedPage(page, height), paddingBottom: 30 }}>
    <Dither />
    <View style={{ height, justifyContent: 'flex-end', alignItems: 'center', gap: 16, paddingBottom: 22 }}>
      <HeroImage albumId={artist.coverAlbumId ?? ''} cover={artist.coverAlbumId !== null} label={artist.name} height={height} page={page} />
      <Txt size={clamp(30, width * 0.09, 44)} weight={800} ls={-0.03} lh={1.05} align="center" lines={2} accessibilityRole="header" style={{ paddingHorizontal: 20 }}>{artist.name}</Txt>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ActionCircle icon={Star} on={saved !== undefined} label={formatContent(saved ? t.removeArtistRadio : t.saveArtistRadio, { name: radioLabel })} onPress={toggleSaved} />
        <ActionCircle icon={Play} filled disabled={ids.length === 0} label={t.play} onPress={() => music.playTracks(ids, { context, shuffle: false, start: 0 })} />
        <ActionCircle icon={Shuffle} disabled={ids.length === 0} label={t.shuffle} onPress={() => music.playTracks(ids, { context, shuffle: true })} />
      </View>
    </View>
    <View style={{ paddingHorizontal: SIDE, paddingTop: 14, gap: SECTION_GAP }}>
      {featured ? <FeaturedAlbum album={featured} /> : null}
      {top.length > 0 ? <Shelf title={t.topSongs} columns arrows={false}>
        <TrackColumns trackIds={top} context={{ ...context, label: `${artist.name} · ${t.topSongs}` }} divided peek={TOP_SONGS_PEEK} subtitle={(track) => [track.album, track.year].filter(Boolean).join(' · ')} />
      </Shelf> : null}
      {albums.length > 0 ? <Shelf title={t.scopeFilms} arrows={false}>{albums.map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf> : null}
      {tracks.length > popular.length ? <View accessibilityLabel={t.allSongs} style={{ gap: 12 }}><Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{t.allSongs}</Txt><TrackList tracks={tracks} context={context} flush /></View> : null}
      {together.length > 0 ? <Shelf title={t.singsWith} arrows={false}>{together.map((other) => <ArtistCard key={other.key} artist={other} />)}</Shelf> : null}
    </View>
  </View>;
}

export function AlbumHeroPage({ album, tracks, context }: { album: Album; tracks: readonly MusicTrack[]; context: PlayContext }) {
  const music = useMusic();
  const nav = useMusicNav();
  const { width } = useWindowDimensions();
  const height = heroHeight(width, 110);
  const page = usePageTint(useCoverTint(album.id, album.cover));
  const ids = tracks.map((track) => track.id);
  const meta = [album.year, songCount(tracks.length), lengthOf(tracks)].filter(Boolean).join(' · ');
  return <View style={{ backgroundImage: tintedPage(page, height), paddingBottom: 30 }}>
    <Dither />
    <View style={{ height, justifyContent: 'flex-end', alignItems: 'center', gap: 6, paddingBottom: 20, paddingHorizontal: 20 }}>
      <HeroImage albumId={album.id} cover={album.cover} label={album.name} height={height} page={page} />
      <Txt size={clamp(26, width * 0.07, 34)} weight={800} ls={-0.03} lh={1.08} align="center" lines={2} accessibilityRole="header">{album.name}</Txt>
      {album.artists.length > 0 ? <Txt size={16} lh={1.4} align="center">{album.artists.map((name, position) => <Txt key={name} size={16} weight={700} onPress={() => nav.go({ page: 'artist', key: keyOf(name) })}>{position > 0 ? ', ' : ''}{name}</Txt>)}</Txt> : null}
      <Txt size={13} color={M.muted} align="center">{meta}</Txt>
      {album.cast.length > 0 ? <Txt size={13} color={M.muted} align="center" lines={2}>{t.starring} {album.cast.join(', ')}</Txt> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <ActionCircle icon={Shuffle} size={54} iconSize={22} disabled={ids.length === 0} label={t.shuffle} onPress={() => music.playTracks(ids, { context, shuffle: true })} />
        <Press onPress={() => music.playTracks(ids, { context, shuffle: false, start: 0 })} disabled={ids.length === 0} label={t.play} pressScale={0.97}
          style={{ minWidth: 150, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 28, borderRadius: 27, backgroundColor: M.solid, boxShadow: M.shadowPlay }}>
          <Play size={20} color={M.accentInk} fill={M.accentInk} />
          <Txt size={17} weight={700} color={M.accentInk}>{t.play}</Txt>
        </Press>
        <ActionCircle icon={Radio} size={54} iconSize={22} label={`${t.startRadio}: ${album.name}`} onPress={() => music.startRadio({ kind: 'album', value: album.id }, `${album.name} Radio`)} />
      </View>
    </View>
    <View style={{ paddingHorizontal: SIDE, paddingTop: 8 }}>
      <TrackList tracks={tracks} context={context} numbered showAlbum={false} />
    </View>
  </View>;
}
