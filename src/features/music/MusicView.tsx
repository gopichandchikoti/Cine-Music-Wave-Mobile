import { AudioLines, Disc3, Film, House, Library, ListMusic, Music2, Plus, Radio, Search } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ComponentType, type ReactNode } from 'react';
import { Animated, BackHandler, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy, formatContent } from '../../core/content';
import { coversOf } from '../../core/musicHelpers';
import { Dither } from '../../design/Dither';
import { BlurLayer, Glass } from '../../design/Glass';
import { Presence } from '../../design/Presence';
import { Press } from '../../design/primitives';
import { MUSIC_COMPACT_MAX, music as M, theme } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { ProfileControl } from '../shell/ProfileControl';
import { Dock, dockSpace, dockTop } from './Dock';
import { ImmersiveBar } from './Hero';
import { HomePage } from './HomePage';
import { LibraryPage } from './LibraryPage';
import { CreatePlaylistDialog } from './Menus';
import { AlbumPage, ArtistPage, LikedPage, MixPage, MoodPage, PlaylistPage } from './DetailPages';
import { useMusic } from './musicContext';
import { MusicNavContext, useMusicNav, type MusicNav, type MusicRoute } from './musicNav';
import { NowPlaying } from './NowPlaying';
import { useOverlay } from './pageui';
import { OverlayOutlet, OverlayProvider } from './overlays';
import { PlayerBar } from './PlayerBar';
import { SearchPage } from './SearchPage';
import { LikedCover, Mosaic } from './ui';

const t = copy.musicView;
/** A hero page counts as scrolled past its picture (the name has reached the clock) after this many screen widths. */
const HERO_PASSED = 0.62;

type TabIcon = ComponentType<{ size?: number; color?: string }>;

/** The cover-coloured wash behind everything (web: .music-backdrop). */
function Backdrop() {
  const { width, height } = useWindowDimensions();
  const image = [
    `radial-gradient(${width * 0.6}px ${height * 0.5}px at 12% -8%, ${M.glowPink}, transparent 70%)`,
    `radial-gradient(${width * 0.55}px ${height * 0.55}px at 100% 8%, ${M.glowViolet}, transparent 70%)`,
    `radial-gradient(${width * 0.7}px ${height * 0.6}px at 55% 120%, ${M.glowTeal}, transparent 70%)`,
  ].join(', ');
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: M.bg, backgroundImage: image }]}><Dither /></View>;
}

/** A row of the wide layout's side list (a phone uses the dock instead). */
function NavButton({ icon: Icon, label, on, onPress }: { icon: TabIcon; label: string; on: boolean; onPress: () => void }) {
  return <Press onPress={onPress} label={label} selected={on} role="tab" pressedStyle={{ backgroundColor: M.surface }}
    style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? M.surfaceHover : 'transparent' }}>
    <Icon size={22} color={on ? M.accent : M.muted} />
    <Txt size={15} weight={600} color={on ? M.ink : M.muted}>{label}</Txt>
  </Press>;
}

/** Watch / Music switch (web: .music-mode-switch). */
function ModeSwitch({ onWatch, compact }: { onWatch: () => void; compact: boolean }) {
  return <Glass radius={999} blur={0} shadow={false} style={{ flexDirection: 'row', gap: 2, padding: compact ? 3 : 4 }}>
    <Press onPress={onWatch} label={copy.modeSwitch.watch} style={{ minHeight: compact ? 32 : 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: compact ? 10 : 14, borderRadius: 999 }}>
      <Film size={15} color={M.muted} />
      {!compact ? <Txt size={13} color={M.muted}>{copy.modeSwitch.watch}</Txt> : null}
    </Press>
    <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={{ minHeight: compact ? 32 : 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: compact ? 10 : 14, borderRadius: 999, backgroundColor: M.solid }}>
      <AudioLines size={15} color={M.accentInk} />
      <Txt size={13} weight={700} color={M.accentInk}>{copy.modeSwitch.music}</Txt>
    </View>
  </Glass>;
}

type Props = { onWatch: () => void };

export function MusicView({ onWatch }: Props) {
  const music = useMusic();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width <= MUSIC_COMPACT_MAX;
  const [history, setHistory] = useState<MusicRoute[]>([{ page: 'home' }]);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const route = history[history.length - 1];

  const go = useCallback((next: MusicRoute): void => {
    setHistory((current) => [...current.slice(-30), next]);
    music.setExpanded(false);
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [music]);
  const back = useCallback((): void => {
    setHistory((current) => (current.length > 1 ? current.slice(0, -1) : current));
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // Android's back button: close the player's list, then the player, then step back through pages.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (music.expanded) { if (music.sheet) music.setSheet(null); else music.setExpanded(false); return true; }
      if (history.length > 1) { back(); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [music, history.length, back]);

  const nav = useMemo<MusicNav>(() => ({
    route, go, back, canGoBack: history.length > 1, compact,
    openMenu: () => undefined, pickPlaylist: () => undefined,
  }), [route, go, back, history.length, compact]);

  return <MusicNavContext.Provider value={nav}>
    <OverlayProvider>
      <View style={{ flex: 1, backgroundColor: M.bg }}>
        <Shell route={route} compact={compact} onWatch={onWatch} scroller={scroller} top={insets.top} />
        <Presence show={music.expanded && music.track !== null}><NowPlaying /></Presence>
      </View>
    </OverlayProvider>
  </MusicNavContext.Provider>;
}

function Shell({ route, compact, onWatch, scroller, top }: { route: MusicRoute; compact: boolean; onWatch: () => void; scroller: React.RefObject<ComponentRef<typeof ScrollView> | null>; top: number }) {
  const music = useMusic();
  const nav = useMusicNav();
  const insets = useSafeAreaInsets();
  const overlay = useOverlay();
  const { width } = useWindowDimensions();
  const [pastHero, setPastHero] = useState(false);
  const active = route.page === 'search' ? 'search' : route.page === 'home' || route.page === 'mood' || route.page === 'mix' ? 'home' : 'library';
  const page = ((): ReactNode => {
    switch (route.page) {
      case 'home': return <HomePage />;
      case 'search': return <SearchPage key={`${route.query ?? ''}|${JSON.stringify(route.filters ?? {})}`} route={route} />;
      case 'library': return <LibraryPage route={route} />;
      case 'album': return <AlbumPage route={route} />;
      case 'artist': return <ArtistPage route={route} />;
      case 'playlist': return <PlaylistPage route={route} />;
      case 'liked': return <LikedPage />;
      case 'mix': return <MixPage route={route} />;
      case 'mood': return <MoodPage route={route} />;
    }
  })();
  const homeButton = <NavButton key="home" icon={House} label={t.home} on={active === 'home'} onPress={() => nav.go({ page: 'home' })} />;
  const searchButton = <NavButton key="search" icon={Search} label={t.search} on={active === 'search'} onPress={() => nav.go({ page: 'search' })} />;
  const libraryButton = <NavButton key="library" icon={Library} label={t.yourLibrary} on={active === 'library'} onPress={() => nav.go({ page: 'library' })} />;
  const bottomSpace = compact ? dockSpace(insets.bottom) : 0;
  // A singer's or film's page on a phone runs its picture up under the status bar, so it has no top bar and no panel behind it.
  const immersive = compact && (route.page === 'artist' || route.page === 'album');

  const topbar = <View style={{ zIndex: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: compact ? 8 : 12, paddingHorizontal: compact ? 12 : 12, paddingTop: compact ? 8 + top : 10 + top }}>
    <View style={{ flex: compact ? undefined : 1, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundImage: 'linear-gradient(140deg, #ff5c8a, #7c5cff)', boxShadow: '0 6px 18px rgba(255, 92, 138, 0.35)' }}>
        <Music2 size={19} color="#fff" />
      </View>
      {!compact ? <View>
        <Txt family="mono" weight={500} size={9} ls={0.16} color={M.muted}>{copy.watchView.secondBrain}</Txt>
        <Txt size={19} weight={800} ls={-0.02} style={{ marginTop: 3 }}>{t.music}</Txt>
      </View> : null}
    </View>
    <ModeSwitch onWatch={onWatch} compact={compact} />
    <View style={{ flex: compact ? undefined : 1, alignItems: 'flex-end' }}><ProfileControl /></View>
  </View>;

  const main = <View style={{ flex: 1, minHeight: 0, borderTopLeftRadius: compact ? 24 : 22, borderTopRightRadius: compact ? 24 : 22, borderBottomLeftRadius: compact ? 0 : 22, borderBottomRightRadius: compact ? 0 : 22, overflow: 'hidden', backgroundImage: immersive ? undefined : M.panel }}>
    <ScrollView ref={scroller} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: bottomSpace }} accessibilityLabel={t.music}
      scrollEventThrottle={immersive ? 64 : undefined} onScroll={immersive ? (event) => setPastHero(event.nativeEvent.contentOffset.y > width * HERO_PASSED) : undefined}>{page}</ScrollView>
  </View>;

  if (compact) {
    return <BlurLayer overlay={<>
      {immersive ? <ImmersiveBarFor route={route as Extract<MusicRoute, { page: 'artist' | 'album' }>} scrolled={pastHero} /> : null}
      <Dock />
      <Toast />
      <OverlayOutlet />
    </>}>
      <Backdrop />
      {immersive ? <StatusBar style={theme.mode === 'light' && pastHero ? 'dark' : 'light'} /> : null}
      {immersive ? main : <View style={{ flex: 1, gap: 6 }}>{topbar}{main}</View>}
    </BlurLayer>;
  }

  const likes = music.user.likes.length;
  return <BlurLayer overlay={<><Toast /><OverlayOutlet /></>}>
    <Backdrop />
    <View style={{ flex: 1, gap: 10, paddingBottom: 12 + insets.bottom, paddingHorizontal: 12 }}>
      {topbar}
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 12 }}>
        <Glass radius={22} blur={0} style={{ width: 300, padding: 10, gap: 4 }}>
          <View style={{ gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: M.line }}>{homeButton}{searchButton}{libraryButton}</View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingLeft: 12, paddingRight: 6, paddingBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ListMusic size={16} color={M.muted} /><Txt size={12} weight={700} ls={0.08} upper color={M.muted}>{t.scopePlaylists}</Txt></View>
              <Press label={t.createPlaylist} onPress={() => overlay.show(<CreatePlaylistDialog onClose={overlay.hide} onCreated={(playlist) => nav.go({ page: 'playlist', id: playlist.id })} />)} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}><Plus size={18} color={M.muted} /></Press>
            </View>
            <SideRow active={route.page === 'liked'} onPress={() => nav.go({ page: 'liked' })} title={t.likedSongs} subtitle={formatContent(likes === 1 ? t.oneSong : t.manySongs, { count: likes })} art={<LikedCover size={44} radius={8} glyph={16} />} />
            {music.user.playlists.map((playlist) => <SideRow key={playlist.id} active={route.page === 'playlist' && route.id === playlist.id} onPress={() => nav.go({ page: 'playlist', id: playlist.id })} title={playlist.name}
              subtitle={formatContent(playlist.trackCount === 1 ? t.oneSong : t.manySongs, { count: playlist.trackCount })}
              art={<View style={{ width: 44 }}><Mosaic covers={coversOf(playlist.trackIds.flatMap((id) => music.index.byId.get(id) ?? []))} label={playlist.name} radius={8} /></View>} />)}
            {music.user.radios.length > 0 ? <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, paddingLeft: 12, paddingBottom: 4 }}><Radio size={16} color={M.muted} /><Txt size={12} weight={700} ls={0.08} upper color={M.muted}>{t.radios}</Txt></View>
              {music.user.radios.map((radio) => <SideRow key={radio.id} active={false} onPress={() => music.startRadio({ kind: radio.seedKind, value: radio.seedValue }, radio.label)} title={radio.label} subtitle={t.radioSaved}
                art={<View style={{ width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundImage: 'linear-gradient(140deg, #19b6a4, #3b6bff)' }}><Radio size={16} color="#fff" /></View>} />)}
            </> : null}
            <Press onPress={() => nav.go({ page: 'library', tab: 'albums' })} label={t.browseFilms} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: M.line, borderRadius: 12 }}>
              <Disc3 size={16} color={M.muted} /><Txt size={13} color={M.muted}>{t.browseFilms}</Txt>
            </Press>
          </ScrollView>
        </Glass>
        {main}
      </View>
      <PlayerBar />
    </View>
  </BlurLayer>;
}

/** The pinned back and "…" buttons of a singer's or film's page; its menu also offers radio for that singer or film. */
function ImmersiveBarFor({ route, scrolled }: { route: Extract<MusicRoute, { page: 'artist' | 'album' }>; scrolled: boolean }) {
  const { index } = useMusic();
  if (route.page === 'artist') {
    const artist = index.artistByKey.get(route.key);
    return <ImmersiveBar scrolled={scrolled} trackIds={artist?.trackIds ?? []} source={artist ? { radio: { seed: { kind: 'artist', value: artist.name }, label: `${artist.name} Radio` } } : undefined} />;
  }
  const album = index.albumById.get(route.id);
  return <ImmersiveBar scrolled={scrolled} trackIds={album?.trackIds ?? []} source={album ? { radio: { seed: { kind: 'album', value: album.id }, label: `${album.name} Radio` } } : undefined} />;
}

function SideRow({ active, onPress, title, subtitle, art }: { active: boolean; onPress: () => void; title: string; subtitle: string; art: ReactNode }) {
  return <Press onPress={onPress} label={title} pressedStyle={{ backgroundColor: M.surface }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, backgroundColor: active ? M.surfaceHover : 'transparent' }}>
    {art}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Txt size={14} weight={600} lines={1}>{title}</Txt>
      <Txt size={12} color={M.muted} lines={1} style={{ marginTop: 2 }}>{subtitle}</Txt>
    </View>
  </Press>;
}


/** The short message at the bottom ("Added to queue"). */
function Toast() {
  const music = useMusic();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const text = music.toastText;
  useEffect(() => { if (text) { fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); } }, [text, fade]);
  if (!text) return null;
  const compact = width <= MUSIC_COMPACT_MAX;
  return <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', alignSelf: 'center', bottom: compact ? dockTop(insets.bottom) + 14 : 110, maxWidth: Math.min(520, width - 32), opacity: fade, zIndex: 120 }}>
    <View style={{ paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: M.floatBorder, backgroundColor: M.float, boxShadow: M.shadowHero }}>
      <Txt size={14} align="center">{text}</Txt>
    </View>
  </Animated.View>;
}
