import { AudioLines, RefreshCw, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy, formatContent } from '../../core/content';
import { buildRows, newTitleIds, nextToPlay, pickFeatured, progressFraction, searchTitles, similarTo } from '../../core/watchModel';
import type { PlayTarget, ProgressEntry, WatchFile, WatchTitle } from '../../core/watchTypes';
import { useLibrary } from '../../data/LibraryProvider';
import { Dither } from '../../design/Dither';
import { Grid } from '../../design/Grid';
import { Press, Spinner } from '../../design/primitives';
import { clamp, theme, WATCH_PHONE_MAX, WATCH_TABLET_MAX, watch as W } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useMusic } from '../music/musicContext';
import { AccessNotice, AccessPanel } from '../shell/AccessPanel';
import { ProfileControl } from '../shell/ProfileControl';
import { Billboard } from './Billboard';
import { Player } from './Player';
import { TitleDialog } from './TitleDialog';
import { glassLook, Rail, TitleCard } from './ui';

type Section = 'home' | 'movies' | 'series' | 'list';
const SECTIONS: readonly { id: Section; label: string }[] = [
  { id: 'home', label: copy.watchView.navHome }, { id: 'movies', label: copy.watchView.navMovies }, { id: 'series', label: copy.watchView.navSeries }, { id: 'list', label: copy.watchView.navMyList },
];
const NOTICE_MS = 4500;

const newestYearFirst = (left: WatchTitle, right: WatchTitle): number => (right.year ?? 0) - (left.year ?? 0) || left.title.localeCompare(right.title);

/** The same chrome on every Watch icon button: a faint rim and a dark green fill (web: .watch-icon-button). */
const iconBox = () => ({ ...glassLook(), width: 38, height: 38, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: W.field });

export function WatchView({ onMusic }: { onMusic: () => void }) {
  const library = useLibrary();
  const { pause: pauseMusic } = useMusic();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const phone = width <= WATCH_PHONE_MAX;
  const tablet = width <= WATCH_TABLET_MAX;
  const gutter = clamp(16, width * 0.036, 56);
  const cardWidth = phone ? width * 0.42 : clamp(150, width * 0.164, 310);
  const [openedAt] = useState(() => Date.now());
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [list, setList] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('home');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dialogId, setDialogId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<PlayTarget | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const repo = library.repo;

  useEffect(() => {
    if (!repo) return;
    void repo.watchProgress().then(setProgress);
    void repo.watchList().then(setList);
  }, [repo]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), NOTICE_MS); return () => clearTimeout(timer); }, [notice]);

  // Songs live in the Music tab; Watch is for films and series.
  const titles = useMemo(() => library.titles.filter((title) => title.kind !== 'album'), [library.titles]);
  const rows = useMemo(() => buildRows(titles, progress, list), [titles, progress, list]);
  const newIds = useMemo(() => newTitleIds(titles, openedAt), [titles, openedAt]);
  const featured = useMemo(() => pickFeatured(titles, progress), [titles, progress]);
  const fractions = useMemo(() => new Map(titles.map((title) => [title.id, progressFraction(title, progress)])), [titles, progress]);
  const listed = useMemo(() => new Set(list), [list]);
  const results = useMemo(() => (query.trim() ? searchTitles(titles, query) : null), [titles, query]);
  const dialogTitle = dialogId ? titles.find((title) => title.id === dialogId) ?? null : null;

  const openTitle = useCallback((title: WatchTitle) => setDialogId(title.id), []);
  // A film and a song should not play over each other.
  const play = useCallback((target: PlayTarget) => { pauseMusic(); setDialogId(null); setPlaying(target); }, [pauseMusic]);
  const playTitle = useCallback((title: WatchTitle) => play(nextToPlay(title, progress)), [play, progress]);

  const toggleList = useCallback(async (title: WatchTitle): Promise<void> => {
    const wasListed = list.includes(title.id);
    setList((current) => (wasListed ? current.filter((id) => id !== title.id) : [title.id, ...current]));
    try { await repo?.setListed(title.id, !wasListed); } catch (reason) {
      setList((current) => (wasListed ? [title.id, ...current] : current.filter((id) => id !== title.id)));
      setNotice(reason instanceof Error ? reason.message : copy.watchView.watchCouldNotBeLoaded);
    }
  }, [list, repo]);
  const recordProgress = useCallback((entry: ProgressEntry) => {
    setProgress((current) => [entry, ...current.filter((item) => item.fileId !== entry.fileId)]);
    void repo?.saveProgress(entry).catch(() => undefined);
  }, [repo]);
  const playFile = useCallback((file: WatchFile) => setPlaying((current) => (current ? { title: current.title, file, startAt: 0 } : current)), []);

  // The Android back button: the player and the title page handle it themselves; then a search, then a section, then the system.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (playing || dialogId) return false;
      if (query) { setQuery(''); return true; }
      if (section !== 'home') { setSection('home'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [playing, dialogId, query, section]);

  const card = (title: WatchTitle, fixed?: number): ReactNode => <TitleCard key={title.id} title={title} progress={fractions.get(title.id) ?? 0} isNew={newIds.has(title.id)} width={fixed ?? '100%'} onOpen={openTitle} scheme={theme.mode} />;
  const grid = (items: readonly WatchTitle[], empty: string): ReactNode => (items.length === 0
    ? <Txt size={16} color={W.muted}>{empty}</Txt>
    : <Grid columns="auto" minWidth={cardWidth} gap={8} rowGap={14}>{items.map((title) => card(title))}</Grid>);
  const page = (heading: string, content: ReactNode): ReactNode => <View style={{ paddingTop: 12, paddingHorizontal: gutter, paddingBottom: 80 }}>
    <Txt size={clamp(24, width * 0.03, 34)} weight={800} ls={-0.02} accessibilityRole="header" style={{ marginBottom: 18 }}>{heading}</Txt>
    <AccessNotice kind="watch" style={{ marginBottom: 16 }} />
    {content}
  </View>;

  const body = (): ReactNode => {
    if (titles.length === 0) return <View style={{ paddingTop: 90 + insets.top }}><AccessPanel kind="watch" /></View>;
    if (results) return page(results.length === 0 ? formatContent(copy.watchView.nothingMatches, { query: query.trim() }) : copy.watchView.searchWatchMedia, results.length > 0 ? grid(results, '') : null);
    if (section === 'movies') return page(copy.watchView.allMovies, grid(titles.filter((title) => title.kind === 'movie').sort(newestYearFirst), copy.watchView.emptySection));
    if (section === 'series') return page(copy.watchView.tvSeries, grid(titles.filter((title) => title.kind === 'series').sort(newestYearFirst), copy.watchView.emptySection));
    if (section === 'list') return page(copy.watchView.myList, grid(list.map((id) => titles.find((title) => title.id === id)).filter((title): title is WatchTitle => title !== undefined), copy.watchView.emptyList));
    return <>
      {featured ? <Billboard title={featured} progress={progress} inList={listed.has(featured.id)} gutter={gutter} onPlay={playTitle} onInfo={openTitle} onToggleList={(title) => { void toggleList(title); }} /> : null}
      <View style={{ marginTop: -72, paddingBottom: 90, gap: 6 }}>
        <AccessNotice kind="watch" style={{ marginHorizontal: gutter, marginBottom: 8 }} />
        {rows.map((row) => <Rail key={row.id} title={row.title} gutter={gutter}>{row.items.map((title) => card(title, cardWidth))}</Rail>)}
      </View>
    </>;
  };

  const solid = scrolled || section !== 'home' || results !== null || titles.length === 0;
  const topPad = Math.max(12, insets.top);
  const home = section === 'home' && !results && titles.length > 0;
  const barHeight = phone || tablet ? 112 : 84;
  const scanning = library.scan.phase === 'listing' || library.scan.phase === 'reading';

  const sections = <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={copy.watchView.watchSections} contentContainerStyle={{ gap: 2 }} style={{ flexGrow: 0 }}>
    {SECTIONS.map((item) => {
      const active = section === item.id && !results;
      return <Press key={item.id} role="tab" selected={active} label={item.label} onPress={() => { setSection(item.id); setQuery(''); scroller.current?.scrollTo({ y: 0, animated: false }); }}
        style={[glassLook(), { minHeight: 36, paddingHorizontal: 13, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? W.chip : 'transparent' }]}>
        <Txt size={14} weight={active ? 700 : 400} color={active ? W.ink : W.muted}>{item.label}</Txt>
      </Press>;
    })}
  </ScrollView>;

  const searchWidth = phone ? 100 : clamp(130, width * 0.15, 210);
  const expanded = searchFocused && phone;
  const search = <View style={expanded
    ? { position: 'absolute', zIndex: 3, top: topPad, left: gutter, right: gutter, height: 38, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: W.accent, borderRadius: 8, backgroundColor: W.raised }
    : { width: searchWidth, height: 38, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: phone ? 10 : 11, borderWidth: 1, borderColor: W.line, borderRadius: 8, backgroundColor: W.field, overflow: 'hidden' }}>
    <Search size={17} color={W.muted} />
    <TextInput value={query} onChangeText={setQuery} placeholder={copy.watchView.searchPlaceholder} placeholderTextColor={W.muted} accessibilityLabel={copy.watchView.searchWatchMedia} returnKeyType="search" selectionColor={W.accent}
      onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
      style={{ flex: 1, minWidth: 0, width: phone && !searchFocused ? 0 : undefined, opacity: phone && !searchFocused ? 0 : 1, paddingVertical: 0, color: W.ink, fontFamily: 'DMSans_400Regular', fontSize: 14 }} />
    {query ? <Press onPress={() => setQuery('')} label={copy.watchView.clearSearch} style={{ padding: 2, borderRadius: 99 }}><X size={15} color={W.muted} /></Press> : null}
  </View>;
  const refresh = <Press onPress={() => { void library.rescan(); }} disabled={scanning} label={copy.watchView.refreshLibrary} style={iconBox()}><Spin on={scanning}><RefreshCw size={18} color={W.ink} /></Spin></Press>;
  const modeSwitch = <View accessibilityRole="tablist" accessibilityLabel={copy.watchView.appModes} style={{ flexDirection: 'row', gap: 2, padding: 3, borderWidth: 1, borderColor: W.line, borderRadius: 9, backgroundColor: W.field }}>
    <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={{ minHeight: 30, justifyContent: 'center', paddingHorizontal: phone ? 8 : 10, borderRadius: 6, backgroundColor: W.accent }}><Txt size={12} weight={700} color={W.accentInk}>{copy.watchView.watch}</Txt></View>
    <Press onPress={onMusic} label={copy.modeSwitch.music} role="tab" style={[glassLook(), { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: phone ? 8 : 10, borderRadius: 6, backgroundColor: 'transparent' }]}>
      <AudioLines size={15} color={W.muted} />
      {!phone ? <Txt size={12} color={W.muted}>{copy.modeSwitch.music}</Txt> : null}
    </Press>
  </View>;
  const account = <ProfileControl tone="watch" />;
  const brand = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
    <View style={{ width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: W.accent }}><AudioLines size={19} color={W.accentInk} /></View>
    <View><Txt family="mono" weight={500} size={9} ls={0.16} color={W.muted}>{copy.watchView.secondBrain}</Txt><Txt size={19} weight={800} ls={-0.02} style={{ marginTop: 3 }}>{copy.watchView.watch}</Txt></View>
  </View>;

  return <View style={{ flex: 1, backgroundColor: W.bg }}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: `radial-gradient(1100px 620px at 85% -8%, ${W.glowA}, transparent 62%), radial-gradient(900px 520px at -8% 38%, ${W.glowB}, transparent 62%)` }]}><Dither /></View>
    <ScrollView ref={scroller} scrollEventThrottle={32} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => setScrolled(event.nativeEvent.contentOffset.y > 24)}
      contentContainerStyle={{ paddingTop: home ? 0 : barHeight + Math.max(0, insets.top - 12) }}>
      {library.loaded ? body() : <View style={{ minHeight: 600, alignItems: 'center', justifyContent: 'center', gap: 14 }}><Spinner size={38} border={3} color={W.accent} track={W.track} /><Txt size={16} color={W.muted}>{copy.watchView.loadingLibrary}</Txt></View>}
    </ScrollView>

    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, minHeight: barHeight, paddingTop: topPad, paddingHorizontal: gutter, paddingBottom: 8, gap: 6, backgroundColor: solid ? `rgba(${W.veil}, 0.94)` : undefined, backgroundImage: solid ? undefined : `linear-gradient(to bottom, rgba(${W.veil}, 0.92), rgba(${W.veil}, 0))`, boxShadow: solid ? `0 1px 0 ${W.line}` : undefined }}>
      {phone || tablet ? <>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: phone ? 6 : 28 }}>
          {!phone ? brand : null}
          <View style={{ flex: phone ? 1 : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: phone ? 'space-between' : 'flex-end', gap: phone ? 6 : 8 }}>{search}{refresh}{modeSwitch}{account}</View>
        </View>
        {sections}
      </> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28 }}>
        {brand}
        <View style={{ flex: 1, minWidth: 0 }}>{sections}</View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{search}{refresh}{modeSwitch}{account}</View>
      </View>}
    </View>

    {scanning && library.scan.total > 0 ? <View pointerEvents="none" accessibilityRole="progressbar" style={{ position: 'absolute', zIndex: 30, left: gutter, bottom: 16 + insets.bottom, maxWidth: Math.min(520, width - 2 * gutter), flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: W.line, borderRadius: 8, backgroundColor: W.float, boxShadow: W.shadow }}>
      <Spinner size={14} border={2} color={W.accent} track={W.track} /><Txt size={13}>{formatContent(copy.watchView.preparingLibrary, { count: Math.max(0, library.scan.total - library.scan.done) })}</Txt>
    </View> : null}

    {dialogTitle ? <TitleDialog title={dialogTitle} progress={progress} inList={listed.has(dialogTitle.id)} similar={similarTo(dialogTitle, titles)} onClose={() => setDialogId(null)} onPlay={play} onToggleList={(title) => { void toggleList(title); }} onOpenTitle={openTitle} /> : null}
    {playing ? <Player key={playing.file.id} title={playing.title} file={playing.file} startAt={playing.startAt} onClose={() => setPlaying(null)} onPlayFile={playFile} onProgress={recordProgress} /> : null}
    {notice ? <View pointerEvents="none" style={{ position: 'absolute', zIndex: 90, bottom: 22 + insets.bottom, alignSelf: 'center', maxWidth: width - 32, paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: W.line, borderRadius: 8, backgroundColor: W.surface2, boxShadow: W.shadow }}><Txt size={14}>{notice}</Txt></View> : null}
  </View>;
}

/** Turns its child while `on` (the refresh arrows while the library is being read). */
function Spin({ on, children }: { on: boolean; children: ReactNode }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) { turn.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on, turn]);
  return <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>{children}</Animated.View>;
}
