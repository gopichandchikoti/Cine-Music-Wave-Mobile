import { House, Library, Search } from 'lucide-react-native';
import { useRef, type ComponentType } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy } from '../../core/content';
import { Glass } from '../../design/Glass';
import { useSpringEnterExit } from '../../design/Presence';
import { Press } from '../../design/primitives';
import { between, opacityOf } from '../../design/spring';
import { music as M } from '../../design/tokens';
import { menuGlass, MenuItem, Scrim } from './Menus';
import { useMusic } from './musicContext';
import { useMusicNav, type MusicRoute } from './musicNav';
import { useOverlay } from './pageui';
import { MiniPlayer } from './PlayerBar';

const t = copy.musicView;

/** The round buttons and the mini player are this tall, and the dock floats this far above the bottom edge (plus the safe area). */
export const DOCK_HEIGHT = 56;
const DOCK_LIFT = 10;
const SIDE = 14;
const GAP = 8;
const POP_FROM = 0.86;

/** Room a page leaves under its content for the dock (and the mini player when a song is queued). */
export const dockSpace = (bottomInset: number): number => DOCK_HEIGHT + DOCK_LIFT + bottomInset + 16;
/** Where the top of the dock is, measured up from the bottom edge. */
export const dockTop = (bottomInset: number): number => DOCK_HEIGHT + DOCK_LIFT + bottomInset;

type Section = 'home' | 'library' | 'search';

export const sectionOf = (route: MusicRoute): Section => (route.page === 'search' ? 'search' : route.page === 'home' || route.page === 'mood' || route.page === 'mix' ? 'home' : 'library');

function DockButton({ icon: Icon, label, onPress, on = false }: { icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; label: string; onPress: () => void; on?: boolean }) {
  return <Press onPress={onPress} label={label} selected={on} pressScale={0.92} style={{ width: DOCK_HEIGHT, height: DOCK_HEIGHT }}>
    <Glass radius={DOCK_HEIGHT / 2} style={{ width: DOCK_HEIGHT, height: DOCK_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={25} color={M.accent} strokeWidth={on ? 2.6 : 2.2} />
    </Glass>
  </Press>;
}

/** The list the section button opens: it grows out of the button with a bounce and shrinks back into it. */
function SectionMenu({ current, onClose }: { current: Section; onClose: () => void }) {
  const nav = useMusicNav();
  const insets = useSafeAreaInsets();
  const pop = useRef(new Animated.Value(0)).current;
  useSpringEnterExit(pop, 'bouncy');
  const go = (route: MusicRoute) => (): void => { onClose(); nav.go(route); };
  return <Scrim onClose={onClose} light align="start">
    <Animated.View style={{ position: 'absolute', left: SIDE, bottom: dockTop(insets.bottom) + GAP, width: 230, opacity: opacityOf(pop), transformOrigin: 'bottom left', transform: [{ scale: between(pop, POP_FROM, 1) }] }}>
      <Glass {...menuGlass()} radius={22} style={{ padding: 6 }}>
        <MenuItem icon={House} fillIcon={current === 'home'} label={t.home} onPress={go({ page: 'home' })} />
        <MenuItem icon={Library} fillIcon={current === 'library'} label={t.yourLibrary} onPress={go({ page: 'library' })} />
      </Glass>
    </Animated.View>
  </Scrim>;
}

/**
 * The bottom of a phone screen: a button for Home and Your Library, the mini player, and Search, each floating on glass over the page.
 * With nothing queued the two buttons sit at the two edges.
 */
export function Dock() {
  const music = useMusic();
  const nav = useMusicNav();
  const overlay = useOverlay();
  const insets = useSafeAreaInsets();
  const section = sectionOf(nav.route);
  const openSections = (): void => overlay.show(<SectionMenu current={section} onClose={overlay.hide} />);
  return <View pointerEvents="box-none" accessibilityRole="toolbar" style={{ position: 'absolute', left: SIDE, right: SIDE, bottom: DOCK_LIFT + insets.bottom, flexDirection: 'row', alignItems: 'center', gap: GAP }}>
    <DockButton icon={section === 'home' ? House : Library} label={`${section === 'home' ? t.home : t.yourLibrary}. ${t.sections}`} onPress={openSections} />
    {music.track ? <MiniPlayer /> : <View style={{ flex: 1 }} />}
    <DockButton icon={Search} label={t.search} on={section === 'search'} onPress={() => nav.go({ page: 'search' })} />
  </View>;
}
