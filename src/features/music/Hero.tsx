import { ChevronLeft, Ellipsis } from 'lucide-react-native';
import { useMemo, type ComponentType } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy } from '../../core/content';
import { css, mix, rgbOfHex, type Rgb3 } from '../../design/color';
import { Glass } from '../../design/Glass';
import { Press } from '../../design/primitives';
import { music as M, theme } from '../../design/tokens';
import { useMusicNav, type MenuSource } from './musicNav';
import { Cover } from './ui';

const t = copy.musicView;

type IconComponent = ComponentType<{ size?: number; color?: string; fill?: string; strokeWidth?: number }>;

/** How far the page takes the colour of the picture: more on dark, where a tint reads as depth, less on light, where it reads as stain. */
const TINT_STRENGTH = { dark: 0.32, light: 0.2 } as const;
/** How far below the picture's fade the page keeps its tint before easing back to the plain page colour. */
const TINT_RUNOUT = 520;

/** The height of a full-bleed hero (picture, name and buttons) on a screen this wide: the picture is square, the buttons overlap its foot. `extra` makes room for more text. */
export const heroHeight = (width: number, extra = 0): number => Math.round(width * 1.02 + 40 + extra);

/**
 * The colour of the page behind a hero: the page colour moved towards the picture's colour. Null when the picture has no colour to
 * give (no cover), and the page keeps its plain colour.
 */
export function usePageTint(tint: Rgb3 | null): Rgb3 {
  return useMemo(() => {
    const page = rgbOfHex(M.bg);
    return tint ? mix(page, tint, TINT_STRENGTH[theme.mode]) : page;
  }, [tint]);
}

/** The tinted page behind a hero page's content: the tint down to the hero's foot, then easing out to nothing. */
export const tintedPage = (page: Rgb3, height: number): string => {
  const plain = rgbOfHex(M.bg);
  return `linear-gradient(180deg, ${css(page)} 0px, ${css(page)} ${height}px, rgba(${plain.join(', ')}, 0) ${height + TINT_RUNOUT}px)`;
};

/** The picture of a hero page, edge to edge under the status bar, darkened at the top for the buttons and faded into the page at the foot. */
export function HeroImage({ albumId, cover, label, height, page }: { albumId: string; cover: boolean; label: string; height: number; page: Rgb3 }) {
  const colour = page.join(', ');
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}>
      <Cover albumId={albumId} cover={cover} label={label} radius={0} hero plain style={{ height: '100%', aspectRatio: undefined }} />
    </View>
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0))' }} />
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.66, backgroundImage: `linear-gradient(180deg, rgba(${colour}, 0) 0%, rgba(${colour}, 0.8) 58%, rgb(${colour}) 100%)` }} />
  </View>;
}

/** A round glass button on the page: favourite, play, shuffle. The glass takes the theme (it sits on the tinted page, not on the picture). */
export function ActionCircle({ icon: Icon, label, onPress, size = 60, iconSize = 26, on = false, filled = false, disabled = false }: { icon: IconComponent; label: string; onPress: () => void; size?: number; iconSize?: number; on?: boolean; filled?: boolean; disabled?: boolean }) {
  const tint = on ? M.accent : M.ink;
  return <Press onPress={onPress} label={label} disabled={disabled} pressScale={0.92} selected={on || undefined} style={{ width: size, height: size }}>
    <Glass radius={size / 2} blur={0} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={iconSize} color={tint} fill={on || filled ? tint : 'none'} />
    </Glass>
  </Press>;
}

/** A 44 dp round button over the picture. It stays dark glass with white icons in both themes: it sits on artwork, not on the page. */
function TopButton({ icon: Icon, label, onPress }: { icon: IconComponent; label: string; onPress: () => void }) {
  return <Press onPress={onPress} label={label} pressScale={0.92} style={{ width: 46, height: 46 }}>
    <Glass dark radius={23} alphas={[0.16, 0.1, 0.12]} base="rgba(8, 9, 14, 0.28)" border="rgba(255, 255, 255, 0.2)" shadow={false} glow={false} style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={24} color="#ffffff" strokeWidth={2.4} />
    </Glass>
  </Press>;
}

/**
 * Back and "…", pinned over a hero page so they stay put while it scrolls. Once the page has scrolled past its picture, the status bar
 * gets a fade of the page colour behind it so the content passing under the clock stays out of its way.
 */
export function ImmersiveBar({ trackIds, source, scrolled }: { trackIds: readonly string[]; source?: MenuSource; scrolled: boolean }) {
  const nav = useMusicNav();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const page = rgbOfHex(M.bg).join(', ');
  return <>
    {scrolled ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height: insets.top + 16, backgroundImage: `linear-gradient(180deg, rgba(${page}, 0.94), rgba(${page}, 0))` }} /> : null}
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, width, paddingTop: insets.top + 8, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
      {nav.canGoBack ? <TopButton icon={ChevronLeft} label={t.back} onPress={nav.back} /> : <View />}
      <TopButton icon={Ellipsis} label={t.more} onPress={() => nav.openMenu(trackIds, null, source)} />
    </View>
  </>;
}
