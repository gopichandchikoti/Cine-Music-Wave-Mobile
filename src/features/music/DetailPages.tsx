import { ArrowLeft, Check, ListEnd, Pencil, Play, Radio, Shuffle, Trash2, X } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { TextInput, useWindowDimensions, View } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { coversOf, lengthOf } from '../../core/musicHelpers';
import { MOOD_LABEL } from '../../core/moodLabels';
import { dailyMixes, keyOf, moodTracks, type MoodId } from '../../core/musicModel';
import type { MusicTrack, PlayContext } from '../../core/musicTypes';
import { Grid } from '../../design/Grid';
import { clamp, music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { AlbumCard, ArtistCard } from './Cards';
import { AlbumHeroPage, ArtistHeroPage } from './HeroPages';
import { useMusic } from './musicContext';
import { useMusicNav, type MusicRoute } from './musicNav';
import { EmptyNote, IconButton, LikedCover, Mosaic, Cover, Pill } from './ui';
import { Page } from './pageui';
import { TrackList } from './TrackList';
import { MenuButton, TrackRow } from './TrackRow';
import { useSortable } from './useSortable';

const t = copy.musicView;
const songCount = (count: number): string => formatContent(count === 1 ? t.oneSong : t.manySongs, { count });

function Header({ cover, kind, title, meta, children, round = false }: { cover: ReactNode; kind: string; title: ReactNode; meta: ReactNode; children?: ReactNode; round?: boolean }) {
  const nav = useMusicNav();
  const { width } = useWindowDimensions();
  const coverWidth = nav.compact ? Math.min(width * 0.62, 240) : clamp(150, width * 0.22, 232);
  return <View style={{ flexDirection: nav.compact ? 'column' : 'row', flexWrap: 'wrap', alignItems: nav.compact ? 'flex-start' : 'flex-end', gap: nav.compact ? 14 : 22, paddingTop: 6 }}>
    {nav.canGoBack ? <View style={{ width: '100%', marginLeft: -8 }}><IconButton icon={ArrowLeft} label={t.back} onPress={nav.back} size={44} iconSize={22} color={M.ink} /></View> : null}
    <View style={[{ width: coverWidth, marginTop: nav.compact ? 4 : 18, borderRadius: round ? coverWidth / 2 : 14, overflow: 'visible', boxShadow: M.shadowHero }, nav.compact ? { alignSelf: 'center' } : null]}>{cover}</View>
    <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: nav.compact ? undefined : 280, minWidth: 0, width: nav.compact ? '100%' : undefined, gap: 10 }}>
      <Txt family="mono" weight={500} size={11} ls={0.14} upper color={M.muted}>{kind}</Txt>
      {typeof title === 'string' ? <Txt size={clamp(30, width * 0.05, 60)} weight={800} lh={1.02} ls={-0.035} accessibilityRole="header">{title}</Txt> : title}
      <Txt size={14} color={M.muted}>{meta}</Txt>
      {children}
    </View>
  </View>;
}

/** Play, Shuffle, Radio and "…" for a set of songs. */
function Actions({ tracks, context, radio, extra }: { tracks: readonly MusicTrack[]; context: PlayContext; radio?: { seed: { kind: 'artist' | 'album' | 'genre' | 'language' | 'track'; value: string }; label: string }; extra?: ReactNode }) {
  const music = useMusic();
  const ids = tracks.map((track) => track.id);
  const saved = radio ? music.user.radios.some((entry) => entry.seedKind === radio.seed.kind && entry.seedValue === radio.seed.value) : false;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
    <Pill primary icon={Play} disabled={ids.length === 0} onPress={() => music.playTracks(ids, { context, shuffle: false, start: 0 })}>{t.play}</Pill>
    <Pill icon={Shuffle} disabled={ids.length === 0} onPress={() => music.playTracks(ids, { context, shuffle: true })}>{t.shuffle}</Pill>
    {radio ? <Pill icon={Radio} onPress={() => music.startRadio(radio.seed, radio.label)}>{t.radio}</Pill> : null}
    {radio ? <Pill icon={saved ? Check : ListEnd} on={saved} disabled={saved} onPress={() => { void music.saveRadio(radio.seed, radio.label).then((created) => { if (created) music.toast(formatContent(t.radioSavedToast, { name: radio.label })); }); }}>{saved ? t.radioSaved : t.saveRadio}</Pill> : null}
    {ids.length > 0 ? <MenuButton trackIds={ids} iconSize={22} /> : null}
    {extra}
  </View>;
}

export function AlbumPage({ route }: { route: Extract<MusicRoute, { page: 'album' }> }) {
  const music = useMusic();
  const nav = useMusicNav();
  const album = music.index.albumById.get(route.id);
  const tracks = useMemo(() => (album?.trackIds ?? []).flatMap((id) => music.index.byId.get(id) ?? []), [album, music.index]);
  if (!album) return <Page><EmptyNote>{t.notFound}</EmptyNote></Page>;
  const context: PlayContext = { kind: 'album', id: album.id, label: album.name };
  if (nav.compact) return <AlbumHeroPage album={album} tracks={tracks} context={context} />;
  return <Page>
    <Header cover={<Cover albumId={album.id} cover={album.cover} label={album.name} radius={14} />} kind={t.albumLabel} title={album.name}
      meta={[album.year, songCount(tracks.length), lengthOf(tracks)].filter(Boolean).join(' · ')}>
      {album.artists.length > 0 ? <Txt size={14} lh={1.5}>{album.artists.map((name, position) => <Txt key={name} size={14}>{position > 0 ? ', ' : ''}<Txt size={14} weight={700} onPress={() => nav.go({ page: 'artist', key: keyOf(name) })}>{name}</Txt></Txt>)}</Txt> : null}
      {album.cast.length > 0 ? <Txt size={14} lh={1.5} color={M.muted}>{t.starring} {album.cast.join(', ')}</Txt> : null}
      <Actions tracks={tracks} context={context} radio={{ seed: { kind: 'album', value: album.id }, label: `${album.name} Radio` }} />
    </Header>
    <TrackList tracks={tracks} context={context} numbered showAlbum={false} />
  </Page>;
}

export function ArtistPage({ route }: { route: Extract<MusicRoute, { page: 'artist' }> }) {
  const { index, user } = useMusic();
  const nav = useMusicNav();
  const artist = index.artistByKey.get(route.key);
  const tracks = useMemo(() => (artist?.trackIds ?? []).flatMap((id) => index.byId.get(id) ?? []), [artist, index]);
  const popular = useMemo(() => {
    const plays = new Map(user.plays.map((play) => [play.trackId, play.count]));
    return [...tracks].sort((left, right) => (plays.get(right.id) ?? 0) - (plays.get(left.id) ?? 0) || (right.year ?? 0) - (left.year ?? 0) || left.title.localeCompare(right.title)).slice(0, 8);
  }, [tracks, user.plays]);
  const albums = useMemo(() => (artist?.albumIds ?? []).flatMap((id) => index.albumById.get(id) ?? []).sort((left, right) => (right.year ?? 0) - (left.year ?? 0)), [artist, index]);
  const together = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of tracks) for (const name of track.artists) if (keyOf(name) !== route.key) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 12).flatMap(([name]) => index.artistByKey.get(keyOf(name)) ?? []);
  }, [tracks, index, route.key]);
  if (!artist) return <Page><EmptyNote>{t.notFound}</EmptyNote></Page>;
  const context: PlayContext = { kind: 'artist', id: artist.key, label: artist.name };
  if (nav.compact) return <ArtistHeroPage artist={artist} tracks={tracks} popular={popular} albums={albums} together={together} context={context} />;
  const grid = (items: ReactNode[]): ReactNode => <Grid columns={nav.compact ? 2 : 'auto'} minWidth={168} gap={nav.compact ? 8 : 14} rowGap={nav.compact ? 14 : 18}>{items}</Grid>;
  return <Page>
    <Header round cover={<Mosaic covers={coversOf(tracks)} label={artist.name} radius={9999} />} kind={t.singerLabel} title={artist.name} meta={[songCount(tracks.length), `${albums.length} ${albums.length === 1 ? t.filmOne : t.filmMany}`].join(' · ')}>
      <Actions tracks={tracks} context={context} radio={{ seed: { kind: 'artist', value: artist.name }, label: `${artist.name} Radio` }} />
    </Header>
    <View accessibilityLabel={t.popular} style={{ gap: 12 }}>
      <Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{t.popular}</Txt>
      <TrackList tracks={popular} context={{ ...context, label: `${artist.name} · ${t.popular}` }} />
    </View>
    {albums.length > 0 ? <View accessibilityLabel={t.scopeFilms} style={{ gap: 12 }}><Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{t.scopeFilms}</Txt>{grid(albums.map((album) => <AlbumCard key={album.id} album={album} />))}</View> : null}
    {tracks.length > popular.length ? <View accessibilityLabel={t.allSongs} style={{ gap: 12 }}><Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{t.allSongs}</Txt><TrackList tracks={tracks} context={context} /></View> : null}
    {together.length > 0 ? <View accessibilityLabel={t.singsWith} style={{ gap: 12 }}><Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{t.singsWith}</Txt>{grid(together.map((other) => <ArtistCard key={other.key} artist={other} />))}</View> : null}
  </Page>;
}

/** A page for a fixed list of songs: a daily mix or a mood. */
function ListPage({ title, subtitle, tracks, context, kind }: { title: string; subtitle: string; tracks: readonly MusicTrack[]; context: PlayContext; kind: string }) {
  return <Page>
    <Header cover={<Mosaic covers={coversOf(tracks)} label={title} radius={14} />} kind={kind} title={title} meta={`${subtitle} · ${songCount(tracks.length)} · ${lengthOf(tracks)}`}>
      <Actions tracks={tracks} context={context} />
    </Header>
    <TrackList tracks={tracks} context={context} />
  </Page>;
}

export function MixPage({ route }: { route: Extract<MusicRoute, { page: 'mix' }> }) {
  const music = useMusic();
  const [now] = useState(() => new Date());
  const mix = useMemo(() => dailyMixes(music.index, music.user, now).find((entry) => entry.id === route.id), [music.index, music.user, now, route.id]);
  if (!mix) return <Page><EmptyNote>{t.notFound}</EmptyNote></Page>;
  const tracks = mix.trackIds.flatMap((id) => music.index.byId.get(id) ?? []);
  return <ListPage title={mix.title} subtitle={mix.description} tracks={tracks} kind={t.mixLabel} context={{ kind: 'mix', id: mix.id, label: mix.title }} />;
}

export function MoodPage({ route }: { route: Extract<MusicRoute, { page: 'mood' }> }) {
  const music = useMusic();
  const [now] = useState(() => new Date());
  const mood = route.id as MoodId;
  const tracks = useMemo(() => moodTracks(music.index, mood, now), [music.index, mood, now]);
  const label = MOOD_LABEL[mood] ?? mood;
  return <ListPage title={label} subtitle={t.moodSubtitle} tracks={tracks} kind={t.moodLabel} context={{ kind: 'mix', id: `mood:${mood}`, label }} />;
}

export function LikedPage() {
  const music = useMusic();
  const tracks = music.user.likes.flatMap((id) => music.index.byId.get(id) ?? []);
  return <Page>
    <Header cover={<LikedCover radius={14} glyph={72} />} kind={t.playlistLabel} title={t.likedSongs} meta={`${songCount(tracks.length)} · ${lengthOf(tracks)}`}>
      <Actions tracks={tracks} context={{ kind: 'liked', id: null, label: t.likedSongs }} />
    </Header>
    {tracks.length === 0 ? <EmptyNote>{t.noLikesYet}</EmptyNote> : <TrackList tracks={tracks} context={{ kind: 'liked', id: null, label: t.likedSongs }} />}
  </Page>;
}

export function PlaylistPage({ route }: { route: Extract<MusicRoute, { page: 'playlist' }> }) {
  const music = useMusic();
  const nav = useMusicNav();
  const playlist = music.user.playlists.find((entry) => entry.id === route.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const ids = playlist?.trackIds ?? [];
  const sortable = useSortable({
    count: ids.length,
    onMove: (from, to) => {
      if (!playlist) return;
      const next = [...playlist.trackIds];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void music.setPlaylistTracks(playlist.id, next);
    },
  });
  const { width } = useWindowDimensions();
  if (!playlist) return <Page><EmptyNote>{t.notFound}</EmptyNote></Page>;
  const known = ids.flatMap((id) => music.index.byId.get(id) ?? []);
  const context: PlayContext = { kind: 'playlist', id: playlist.id, label: playlist.name };
  const save = (): void => {
    if (name.trim() && name.trim() !== playlist.name) void music.renamePlaylist(playlist.id, name.trim());
    setEditing(false);
  };
  return <Page>
    <Header cover={<Mosaic covers={coversOf(known)} label={playlist.name} radius={14} />} kind={t.playlistLabel}
      title={editing
        ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TextInput value={name} onChangeText={setName} onSubmitEditing={save} maxLength={80} autoFocus accessibilityLabel={t.newPlaylistName} selectionColor={M.accent}
            style={{ flex: 1, minWidth: 0, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: M.line, borderRadius: 10, backgroundColor: M.surface, color: M.ink, fontFamily: 'DMSans_700Bold', fontSize: clamp(24, width * 0.04, 44) }} />
          <IconButton icon={Check} label={t.save} onPress={save} iconSize={20} />
          <IconButton icon={X} label={t.cancel} onPress={() => setEditing(false)} iconSize={20} />
        </View>
        : playlist.name}
      meta={`${songCount(known.length)} · ${lengthOf(known)}`}>
      <Actions tracks={known} context={context} extra={<>
        <IconButton icon={Pencil} label={t.renamePlaylist} onPress={() => { setName(playlist.name); setEditing(true); }} iconSize={20} />
        {confirming
          ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt size={14} color={M.muted}>{t.deletePlaylistQuestion}</Txt>
            <Pill danger onPress={() => { void music.deletePlaylist(playlist.id).then(() => nav.go({ page: 'library', tab: 'playlists' })); }}>{t.delete}</Pill>
            <Pill onPress={() => setConfirming(false)}>{t.cancel}</Pill>
          </View>
          : <IconButton icon={Trash2} label={t.deletePlaylist} onPress={() => setConfirming(true)} iconSize={20} />}
      </>} />
    </Header>
    {ids.length === 0 ? <EmptyNote>{t.emptyPlaylist}</EmptyNote> : <View>
      {ids.map((id, position) => {
        const track = music.index.byId.get(id);
        if (!track) return null;
        return <TrackRow key={`${id}:${position}`} track={track} position={position} sortable={sortable} source={{ playlistId: playlist.id, playlistPosition: position }} onPlay={() => music.playTracks(ids, { start: position, context })} />;
      })}
    </View>}
  </Page>;
}
