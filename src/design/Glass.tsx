import { BlurTargetView, BlurView } from 'expo-blur';
import { createContext, useContext, useRef, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { PixelRatio, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { glass, glassDarkPalette } from './tokens';

/*
 * Liquid glass, ported from the web's Glass.css: a pane blurs what is behind it, has a bright rim where light would catch the edge, and a
 * soft glow in one corner. On Android the blur needs to know which view to blur (expo-blur's BlurTargetView), so a screen is built as
 * <BlurLayer overlay={...glass...}>content</BlurLayer>: the content is the target and glass in `overlay` blurs it.
 */

type TargetRef = RefObject<ComponentRef<typeof View> | null>;
const BlurTargetContext = createContext<TargetRef | null>(null);

/** Content that glass may blur, plus the glass floating over it. Glass inside `children` cannot blur its own layer. */
export function BlurLayer({ children, overlay, style }: { children: ReactNode; overlay?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const target = useRef<ComponentRef<typeof View>>(null);
  return <View style={[styles.layer, style]}>
    <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>{children}</BlurTargetView>
    <BlurTargetContext.Provider value={target}>{overlay}</BlurTargetContext.Provider>
  </View>;
}

const SUPPORTS_BLUR = Platform.OS === 'ios' || (typeof Platform.Version === 'number' && Platform.Version >= 31);
const DENSITY = PixelRatio.get();

export type Rgb = readonly [number, number, number];

export type GlassProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** border-radius in dp; or four corners [top-left, top-right, bottom-right, bottom-left] */
  radius?: number | readonly [number, number, number, number];
  /** the light colour of the pane (web: --glass-tint) */
  tint?: Rgb;
  /** opacity of the tint at the start, the 60% stop and the end of the 140deg gradient (web dark: .17 / .05 / .09) */
  alphas?: readonly [number, number, number];
  /** a flat colour under the gradient, for darker panes (web: e.g. rgba(16,18,28,.58)) */
  base?: string;
  /** colour used when the device cannot blur, so text stays readable (web: the @supports fallback) */
  solid?: string;
  /** rim colour */
  border?: string;
  /** brightness of the 1px highlight along the top edge (web: inset 0 1px 0 rgba(255,255,255,.42)) */
  rim?: number;
  /** outer shadow, or false for none */
  shadow?: string | false;
  /** the soft glow in the top-left corner */
  glow?: boolean;
  /** blur radius in CSS px; 0 draws the pane without blurring what is behind it */
  blur?: number;
  /** keep the dark look in the light theme (panes over artwork or video) */
  dark?: boolean;
  pointerEvents?: ViewStyle['pointerEvents'];
};

const cornerStyle = (radius: GlassProps['radius']): ViewStyle => {
  if (Array.isArray(radius)) return { borderTopLeftRadius: radius[0], borderTopRightRadius: radius[1], borderBottomRightRadius: radius[2], borderBottomLeftRadius: radius[3] };
  return { borderRadius: (radius as number | undefined) ?? 0 };
};

/** A translucent pane with a blurred backdrop, a rim and a corner glow. */
export function Glass({ children, style, radius = 0, tint, alphas, base, solid, border, rim, shadow, glow = true, blur = 26, dark = false, pointerEvents }: GlassProps) {
  const palette = dark ? glassDarkPalette : glass;
  const target = useContext(BlurTargetContext);
  const corners = cornerStyle(radius);
  const blurs = blur > 0 && target !== null && SUPPORTS_BLUR;
  const needsSolid = blur > 0 && !blurs;
  const t = (tint ?? palette.tint).join(', ');
  const stops = alphas ?? palette.alphas;
  const rimLevel = rim ?? palette.rim;
  const paneShadow = shadow === undefined ? palette.shadow : shadow;
  // expo-blur adds a faint white veil proportional to `intensity`; a small intensity keeps it near-invisible while the reduction factor
  // restores the radius we want (radius = intensity / reduction, in device pixels).
  const intensity = 4.5;
  const reduction = intensity / Math.max(1, blur * DENSITY);
  return <View pointerEvents={pointerEvents} style={[styles.pane, corners, { borderColor: border ?? palette.border }, paneShadow ? { boxShadow: paneShadow } : null, style]}>
    {blurs && <BlurView blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={intensity} blurReductionFactor={reduction} tint="default" style={[StyleSheet.absoluteFill, corners]} />}
    {needsSolid && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: solid ?? palette.solid }]} />}
    {base ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: base }]} /> : null}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: `linear-gradient(140deg, rgba(${t}, ${stops[0]}), rgba(${t}, ${stops[1]}) 60%, rgba(${t}, ${stops[2]}))` }]} />
    {glow ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: 'radial-gradient(120% 90% at 0% 0%, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0) 42%), radial-gradient(90% 80% at 100% 100%, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0) 55%)' }]} /> : null}
    {children}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, corners, { boxShadow: `inset 0 1px 0 rgba(255, 255, 255, ${rimLevel}), inset 0 -1px 0 rgba(255, 255, 255, 0.07), inset 0 0 22px rgba(255, 255, 255, 0.05)` }]} />
  </View>;
}

const styles = StyleSheet.create({
  layer: { flex: 1 },
  pane: { overflow: 'hidden', borderWidth: 1 },
});
