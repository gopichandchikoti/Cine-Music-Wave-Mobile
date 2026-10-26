import { Play, Search, Shuffle, X } from 'lucide-react-native';
import { useDeferredValue, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { describeFilters } from '../../core/musicHelpers';
import { searchLibrary, type SearchFilters, type SearchScope } from '../../core/musicModel';
import { Grid } from '../../design/Grid';
import { Press } from '../../design/primitives';
import { hsl } from '../../design/color';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { AlbumCard, ArtistCard, PlaylistCard, Shelf } from './Cards';
import { FilterBar } from './FilterBar';
import { useMusic } from './musicContext';
import { useMusicNav, type MusicRoute } from './musicNav';
import { Page, SectionHead } from './pageui';
import { TrackList } from './TrackList';
import { Chip, EmptyNote, IconButton, Pill } from './ui';

const t = copy.musicView;

const SCOPES: readonly { id: SearchScope; label: string }[] = [
  { id: 'all', label: t.scopeAll }, { id: 'songs', label: t.scopeSongs }, { id: 'albums', label: t.scopeFilms }, { id: 'artists', label: t.scopeSingers }, { id: 'playlists', label: t.scopePlaylists },
];

/** A colourful category tile (web: .music-browse-tile): the hue steps around the colour wheel by tile position. */
function BrowseTile({ label, index, liked, onPress }: { label: string; index: number; liked?: boolean; onPress: () => void }) {
  const background = liked ? 'linear-gradient(140deg, #6d4cff, #ff5c8a)' : `linear-gradient(140deg, ${hsl(index * 47 + 210, 62, 42)}, ${hsl(index * 47 + 250, 60, 26)})`;
  return <Press onPress={onPress} label={label} pressScale={0.98} style={{ minHeight: 96, padding: 14, borderRadius: 14, overflow: 'hidden', backgroundImage: background }}>
    <Txt size={18} weight={800} color="#fff">{label}</Txt>
  </Press>;
}

/** Find songs by song name, singer, film or cast, and narrow them with filters. */
export function SearchPage({ route }: { route: Extract<MusicRoute, { page: 'search' }> }) {
  const music = useMusic();
  const nav = useMusicNav();
  const [query, setQuery] = useState(route.query ?? '');
  const [scope, setScope] = useState<SearchScope>(route.scope ?? 'all');
  const [filters, setFilters] = useState<SearchFilters>(route.filters ?? {});
  const [focused, setFocused] = useState(false);
  const deferred = useDeferredValue(query);
  const filtered = Object.values(filters).some((value) => value !== undefined && value !== false && value !== '');
  const results = useMemo(() => searchLibrary(music.index, deferred, { filters, likes: music.likes, playlists: music.user.playlists }), [music.index, deferred, filters, music.likes, music.user.playlists]);
  const searching = deferred.trim() !== '' || filtered;
  const description = describeFilters(filters, { artist: (key) => music.index.artistByKey.get(key)?.name, album: (id) => music.index.albumById.get(id)?.name }, t.filterLiked);
  const ids = results.tracks.map((track) => track.id);
  const context = { kind: 'search' as const, id: null, label: deferred.trim() ? formatContent(t.searchFor, { query: deferred.trim() }) : description || t.search };
  const show = (name: SearchScope): boolean => scope === 'all' || scope === name;

  return <Page>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingLeft: 16, paddingRight: query ? 8 : 16, borderWidth: 1, borderColor: focused ? M.ink : M.line, borderRadius: 999, backgroundColor: focused ? M.surfaceHover : M.surface }}>
      <Search size={20} color={focused ? M.ink : M.muted} />
      <TextInput value={query} onChangeText={setQuery} placeholder={t.searchPlaceholder} placeholderTextColor={M.muted} accessibilityLabel={t.search} returnKeyType="search" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={M.accent}
        style={{ flex: 1, minWidth: 0, paddingVertical: 0, color: M.ink, fontFamily: 'DMSans_400Regular', fontSize: 17 }} />
      {query ? <IconButton icon={X} label={t.clearSearch} onPress={() => setQuery('')} iconSize={18} /> : null}
    </View>
    <View accessibilityRole="tablist" accessibilityLabel={t.searchScopes} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {SCOPES.map((entry) => <Chip key={entry.id} role="tab" label={entry.label} on={scope === entry.id} onPress={() => setScope(entry.id)} />)}
    </View>
    <FilterBar filters={filters} onChange={setFilters} />

    {!searching ? <View accessibilityLabel={t.browse} style={{ gap: 14 }}>
      <Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{t.browse}</Txt>
      <Grid columns={nav.compact ? 2 : 'auto'} minWidth={160} gap={12}>
        {[...music.index.languages.map((language, position) => <BrowseTile key={language} label={language} index={position} onPress={() => setFilters({ language })} />),
          ...music.index.genres.slice(0, 8).map((genre, position) => <BrowseTile key={genre} label={genre} index={position + 3} onPress={() => setFilters({ genre })} />),
          <BrowseTile key="liked" label={t.likedSongs} index={0} liked onPress={() => setFilters({ liked: true })} />]}
      </Grid>
      {music.index.artists.length > 0 ? <Shelf title={t.topSingers}>{music.index.artists.slice(0, 16).map((artist) => <ArtistCard key={artist.key} artist={artist} />)}</Shelf> : null}
    </View> : null}

    {searching && results.tracks.length === 0 && results.albums.length === 0 && results.artists.length === 0 && results.playlists.length === 0 ? <EmptyNote>{formatContent(t.nothingMatches, { query: query.trim() || description })}</EmptyNote> : null}

    {searching && show('artists') && results.artists.length > 0 ? <Shelf title={t.scopeSingers}>{results.artists.map((artist) => <ArtistCard key={artist.key} artist={artist} />)}</Shelf> : null}
    {searching && show('albums') && results.albums.length > 0 ? <Shelf title={t.scopeFilms}>{results.albums.map((album) => <AlbumCard key={album.id} album={album} />)}</Shelf> : null}
    {searching && show('playlists') && results.playlists.length > 0 ? <Shelf title={t.scopePlaylists}>{results.playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}</Shelf> : null}
    {searching && show('songs') && results.tracks.length > 0 ? <View accessibilityLabel={t.scopeSongs} style={{ gap: 12 }}>
      <SectionHead title={t.scopeSongs} small={`${formatContent(results.tracks.length === 1 ? t.oneSong : t.manySongs, { count: results.tracks.length })}${description ? ` · ${description}` : ''}`}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Pill primary icon={Play} onPress={() => music.playTracks(ids, { context, shuffle: false })}>{t.play}</Pill>
          <Pill icon={Shuffle} onPress={() => music.playTracks(ids, { context, shuffle: true })}>{t.shuffle}</Pill>
        </View>
      </SectionHead>
      <TrackList tracks={results.tracks} context={context} />
    </View> : null}
  </Page>;
}
