import { ChevronDown, Disc3, ListMusic, Mic2, Music, Music4, Plus, Radio, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { filterTracks, keyOf, type SearchFilters } from '../../core/musicModel';
import { Grid } from '../../design/Grid';
import { Press } from '../../design/primitives';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { AccessPanel } from '../shell/AccessPanel';
import { AlbumCard, ArtistCard, LikedCard, PlaylistCard, RadioCard, Shelf } from './Cards';
import { FilterBar } from './FilterBar';
import { useMusic } from './musicContext';
import { CreatePlaylistDialog, OptionSheet } from './Menus';
import { useMusicNav, type MusicRoute } from './musicNav';
import { Page, PageTitle, useOverlay } from './pageui';
import { SectionPills, type Section } from './SectionPills';
import { TrackList } from './TrackList';
import { EmptyNote, Pill } from './ui';

const t = copy.musicView;

type Tab = 'all' | 'playlists' | 'albums' | 'artists' | 'songs' | 'radios';
type Sort = 'recent' | 'name' | 'year' | 'songs';

const TABS: readonly Section<Tab>[] = [
  { id: 'all', label: t.scopeAll, icon: Music4 }, { id: 'playlists', label: t.scopePlaylists, icon: ListMusic }, { id: 'albums', label: t.scopeFilms, icon: Disc3 },
  { id: 'artists', label: t.scopeSingers, icon: Mic2 }, { id: 'songs', label: t.scopeSongs, icon: Music }, { id: 'radios', label: t.radios, icon: Radio },
];

/** How many items each shelf of the overview shows. */
const SHELF_SIZE = 14;

/** The first section of the library: a few shelves, each opening its full section from its title. */
function Overview({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const music = useMusic();
  const { index, user } = music;
  const recent = useMemo(() => [...index.albums].sort((left, right) => right.addedAt.localeCompare(left.addedAt)).slice(0, SHELF_SIZE), [index.albums]);
  const onRepeat = useMemo(() => {
    const plays = new Map(user.plays.map((play) => [play.trackId, play.count]));
    const played = (albumId: string): number => (index.albumById.get(albumId)?.trackIds ?? []).reduce((total, id) => total + (plays.get(id) ?? 0), 0);
    return index.albums.filter((album) => played(album.id) > 0).sort((left, right) => played(right.id) - played(left.id)).slice(0, SHELF_SIZE);
  }, [index.albums, index.albumById, user.plays]);
  if (index.tracks.length === 0) return <AccessPanel kind="music" />;
  return <>
    <Shelf title={t.scopePlaylists} arrows={false} onTitle={() => onOpen('playlists')}>
      <LikedCard />
      {user.playlists.slice(0, SHELF_SIZE).map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
    </Shelf>
    <Shelf title={t.recentlyAdded} arrows={false} onTitle={() => onOpen('albums')}>{recent.map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf>
    {onRepeat.length > 0 ? <Shelf title={t.onRepeat} arrows={false} onTitle={() => onOpen('songs')}>{onRepeat.map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf> : null}
    <Shelf title={t.scopeSingers} arrows={false} onTitle={() => onOpen('artists')}>{index.artists.slice(0, SHELF_SIZE).map((artist) => <ArtistCard key={artist.key} artist={artist} />)}</Shelf>
  </>;
}

/** Everything in your music, with tabs for playlists, films, singers, songs and radios. */
export function LibraryPage({ route }: { route: Extract<MusicRoute, { page: 'library' }> }) {
  const music = useMusic();
  const nav = useMusicNav();
  const overlay = useOverlay();
  const [tab, setTab] = useState<Tab>(route.tab ?? 'all');
  const [sort, setSort] = useState<Sort>('recent');
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [focused, setFocused] = useState(false);
  const needle = keyOf(text);

  const albums = useMemo(() => {
    const list = music.index.albums.filter((album) => !needle || keyOf(`${album.name} ${album.artists.join(' ')} ${album.cast.join(' ')}`).includes(needle));
    return sort === 'year' ? [...list].sort((left, right) => (right.year ?? 0) - (left.year ?? 0)) : sort === 'songs' ? [...list].sort((left, right) => right.trackIds.length - left.trackIds.length) : sort === 'recent' ? [...list].sort((left, right) => right.addedAt.localeCompare(left.addedAt)) : list;
  }, [music.index.albums, needle, sort]);
  const artists = useMemo(() => {
    const list = music.index.artists.filter((artist) => !needle || artist.key.includes(needle));
    return sort === 'name' ? [...list].sort((left, right) => left.name.localeCompare(right.name)) : list;
  }, [music.index.artists, needle, sort]);
  const playlists = music.user.playlists.filter((playlist) => !needle || keyOf(playlist.name).includes(needle));
  const sortedPlaylists = sort === 'name' ? [...playlists].sort((left, right) => left.name.localeCompare(right.name)) : playlists;
  const songs = useMemo(() => {
    const list = filterTracks(music.index, filters, music.likes).filter((track) => !needle || keyOf(`${track.title} ${track.artists.join(' ')} ${track.album}`).includes(needle));
    return sort === 'name' ? [...list].sort((left, right) => left.title.localeCompare(right.title)) : sort === 'year' ? [...list].sort((left, right) => (right.year ?? 0) - (left.year ?? 0)) : list;
  }, [music.index, filters, music.likes, needle, sort]);

  const sorts: { id: Sort; label: string }[] = [{ id: 'recent', label: t.sortRecent }, { id: 'name', label: t.sortName }, ...(tab === 'albums' || tab === 'songs' ? [{ id: 'year' as const, label: t.sortYear }] : []), ...(tab === 'albums' ? [{ id: 'songs' as const, label: t.sortSongs }] : [])];
  const create = (): void => overlay.show(<CreatePlaylistDialog onClose={overlay.hide} onCreated={(playlist) => nav.go({ page: 'playlist', id: playlist.id })} />);
  const grid = (children: React.ReactNode[]): React.ReactNode => <Grid columns={nav.compact ? 2 : 'auto'} minWidth={168} gap={nav.compact ? 8 : 14} rowGap={nav.compact ? 14 : 18}>{children}</Grid>;

  return <Page>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <PageTitle>{t.yourLibrary}</PageTitle>
      <Pill primary icon={Plus} onPress={create}>{t.createPlaylist}</Pill>
    </View>
    <SectionPills sections={TABS} value={tab} label={t.librarySections} onChange={(next) => { setTab(next); setSort('recent'); }} />
    {tab === 'all' ? <Overview onOpen={setTab} /> : null}
    {tab !== 'radios' && tab !== 'all' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flexGrow: 1, flexBasis: 220, maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: focused ? M.ink : M.line, borderRadius: 10, backgroundColor: M.surface }}>
        <Search size={16} color={M.muted} />
        <TextInput value={text} onChangeText={setText} placeholder={t.filterLibrary} placeholderTextColor={M.muted} accessibilityLabel={t.filterLibrary} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={M.accent}
          style={{ flex: 1, minWidth: 0, paddingVertical: 0, color: M.ink, fontFamily: 'DMSans_400Regular', fontSize: 14 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt size={13} color={M.muted}>{t.sortBy}</Txt>
        <Press label={`${t.sortBy}: ${sorts.find((entry) => entry.id === sort)?.label ?? ''}`} hint="Opens a list"
          onPress={() => overlay.show(<OptionSheet title={t.sortBy} value={sort} options={sorts.map((entry) => ({ value: entry.id, label: entry.label }))} onPick={(value) => setSort(value as Sort)} onClose={overlay.hide} />)}
          style={{ minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 10, borderWidth: 1, borderColor: M.line, borderRadius: 10, backgroundColor: M.surface }}>
          <Txt size={13} weight={600}>{sorts.find((entry) => entry.id === sort)?.label}</Txt>
          <ChevronDown size={12} color={M.chevron} strokeWidth={3} />
        </Press>
      </View>
    </View> : null}
    {tab === 'songs' ? <FilterBar filters={filters} onChange={setFilters} /> : null}

    {tab === 'playlists' ? <>
      {grid([<LikedCard key="liked" />, ...sortedPlaylists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)])}
      {music.user.playlists.length === 0 ? <EmptyNote>{t.noPlaylistsYet}</EmptyNote> : null}
    </> : null}
    {tab === 'albums' ? grid(albums.map((album) => <AlbumCard key={album.id} album={album} />)) : null}
    {tab === 'artists' ? grid(artists.map((artist) => <ArtistCard key={artist.key} artist={artist} />)) : null}
    {tab === 'songs' ? <>
      <Txt size={13} color={M.muted}>{formatContent(songs.length === 1 ? t.oneSong : t.manySongs, { count: songs.length })}</Txt>
      <TrackList tracks={songs} context={{ kind: 'library', id: null, label: t.yourLibrary }} />
    </> : null}
    {tab === 'radios' ? <>
      {grid([
        ...music.user.radios.map((radio) => <RadioCard key={radio.id} id={radio.id} label={radio.label} seedKind={radio.seedKind} seedValue={radio.seedValue} onRemove={() => { void music.deleteRadio(radio.id); }} />),
        ...music.index.artists.slice(0, 4).filter((artist) => !music.user.radios.some((radio) => radio.seedKind === 'artist' && keyOf(radio.seedValue) === artist.key)).map((artist) => <RadioCard key={`s:${artist.key}`} id={`suggested:${artist.key}`} label={`${artist.name} Radio`} seedKind="artist" seedValue={artist.name} />),
      ])}
      {music.user.radios.length === 0 ? <EmptyNote>{t.noRadiosYet}</EmptyNote> : null}
    </> : null}
  </Page>;
}
