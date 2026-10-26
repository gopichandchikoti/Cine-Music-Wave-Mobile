import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Heart } from 'lucide-react-native';
import { hueFor } from '../../core/musicModel';
import { hsl } from '../../design/color';
import { Press, Spinner } from '../../design/primitives';
import { spring, useReducedMotion } from '../../design/spring';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useLibrary } from '../../data/LibraryProvider';
import { art, useArt } from '../../platform/artwork';
import Wave from '../../../modules/wave-media';
import { useCallback } from 'react';

type IconComponent = ComponentType<{ size?: number; color?: string; fill?: string; strokeWidth?: number }>;

// --- small controls (web: .music-icon-button, .music-pill, .music-chip, .music-badge, .music-switch) ----------------------------------------

export function IconButton({ icon: Icon, label, onPress, on, size = 38, iconSize = 20, disabled, color, style, fill }: { icon: IconComponent; label: string; onPress?: () => void; on?: boolean; size?: number; iconSize?: number; disabled?: boolean; color?: string; style?: StyleProp<ViewStyle>; fill?: boolean }) {
  const tint = color ?? (on ? M.accent : M.muted);
  return <Press onPress={onPress} label={label} disabled={disabled} pressScale={0.92} pressedStyle={{ backgroundColor: M.surfaceHover }} style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Icon size={iconSize} color={tint} fill={fill ? tint : 'none'} />
  </Press>;
}

export function Pill({ children, icon: Icon, onPress, primary, on, danger, disabled, label, style }: { children?: ReactNode; icon?: IconComponent; onPress?: () => void; primary?: boolean; on?: boolean; danger?: boolean; disabled?: boolean; label?: string; style?: StyleProp<ViewStyle> }) {
  const ink = primary ? M.accentInk : danger ? '#fff' : on ? M.accent : M.ink;
  return <Press onPress={onPress} disabled={disabled} label={label} pressScale={0.97}
    style={[{ minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: primary || danger ? 'transparent' : M.line, backgroundColor: primary ? M.ink : danger ? '#d6354f' : M.surface }, style]}
    pressedStyle={{ backgroundColor: primary ? M.solid : M.surfaceHover }}>
    {Icon ? <Icon size={16} color={ink} fill={primary && Icon.displayName === 'Play' ? ink : 'none'} /> : null}
    {typeof children === 'string' ? <Txt size={14} weight={700} color={ink}>{children}</Txt> : children}
  </Press>;
}

export function Chip({ label, icon: Icon, on, clear, onPress, role = 'button' }: { label: string; icon?: ComponentType<{ size?: number; color?: string; fill?: string }>; on?: boolean; clear?: boolean; onPress?: () => void; role?: 'button' | 'tab' }) {
  const ink = on ? M.accentInk : clear ? M.accent : M.ink;
  return <Press onPress={onPress} label={label} role={role} selected={role === 'tab' ? on : undefined}
    style={{ minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderStyle: clear ? 'dashed' : 'solid', borderColor: on ? 'transparent' : M.line, backgroundColor: on ? M.ink : M.surface }}
    pressedStyle={{ backgroundColor: on ? M.ink : M.surfaceHover }}>
    {Icon ? <Icon size={16} color={ink} /> : null}
    <Txt size={13} weight={600} color={ink}>{label}</Txt>
  </Press>;
}

export function Badge({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return <View style={{ minWidth: compact ? 18 : 20, paddingHorizontal: compact ? 5 : 6, paddingVertical: 1, borderRadius: 99, backgroundColor: M.ink }}>
    <Txt size={compact ? 10 : 11} weight={800} color={M.accentInk}>{children}</Txt>
  </View>;
}

export function MusicSwitch({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  const slide = useRef(new Animated.Value(on ? 1 : 0)).current;
  const reduced = useReducedMotion();
  // The knob settles on a snappy spring, so it carries the finger's flick a little past the end and eases back.
  useEffect(() => {
    if (reduced) slide.setValue(on ? 1 : 0);
    else Animated.spring(slide, { toValue: on ? 1 : 0, ...spring('snappy') }).start();
  }, [on, slide, reduced]);
  return <Press onPress={() => onChange(!on)} role="switch" checked={on} label={label} style={{ width: 48, height: 28, borderRadius: 99, backgroundColor: on ? M.accent : M.ring }}>
    <Animated.View style={{ position: 'absolute', top: 3, left: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)', transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }} />
  </Press>;
}

export function Note({ children, spinner, style }: { children: ReactNode; spinner?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>
    {spinner ? <Spinner size={16} border={2} color={M.ink} /> : null}
    <Txt size={13} color={M.muted} lh={1.5} style={{ flexShrink: 1 }}>{children}</Txt>
  </View>;
}

export function EmptyNote({ children, hint }: { children: ReactNode; hint?: string }) {
  return <View style={{ paddingVertical: 18, paddingHorizontal: 4 }}>
    <Txt size={16} color={M.muted} lh={1.5}>{children}</Txt>
    {hint ? <Txt size={12} color={M.muted} style={{ marginTop: 6 }}>{hint}</Txt> : null}
  </View>;
}

// --- covers (web: .music-cover, .music-mosaic, .music-liked-cover) -----------------------------------------------------------------------------

const initialsOf = (label: string): string => label.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');

/** The picture size of a full-bleed hero, in pixels. */
const HERO_PX = 1080;

type CoverProps = { albumId: string; cover: boolean; label: string; radius?: number; style?: StyleProp<ViewStyle>; maxPx?: number; /** a full-bleed picture: made large and kept apart from the small copies */ hero?: boolean; /** hide the letters shown while there is no picture */ plain?: boolean };

/** An album cover: the picture from the song files, or a tile whose colour comes from the name, so every album still looks like itself. */
export function Cover({ albumId, cover, label, radius = 10, style, maxPx = 720, hero = false, plain = false }: CoverProps) {
  const library = useLibrary();
  const { width } = useWindowDimensions();
  const source = cover ? library.coverSource(albumId) : undefined;
  const px = hero ? HERO_PX : maxPx;
  // The picture cache is keyed by name alone, so a big picture needs its own name or a small copy made earlier would be reused.
  const key = hero ? `cover:${albumId}:hero` : `cover:${albumId}`;
  const make = useCallback(() => (source ? Wave.artwork(source.uri, 'audio', `cover:${albumId}`, px) : Promise.resolve(null)), [source, albumId, px]);
  const uri = useArt(source ? key : null, source ? make : null);
  const hue = hueFor(label);
  const showInitials = !plain && (!cover || uri === null);
  return <View style={[{ width: '100%', aspectRatio: 1, borderRadius: radius, overflow: 'hidden', backgroundImage: `linear-gradient(140deg, ${hsl(hue, 55, 38)}, ${hsl(hue + 40, 55, 22)})` }, style]}>
    {uri ? <Image source={{ uri }} style={styles.fill} resizeMode="cover" fadeDuration={150} /> : null}
    {showInitials ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Txt size={Math.min(34, Math.max(14, width * 0.03))} weight={800} ls={0.04} color="rgba(255, 255, 255, 0.7)">{initialsOf(label)}</Txt></View> : null}
  </View>;
}

type CoverInfo = { albumId: string; cover: boolean; label: string };

/** Up to four covers in a square, for playlists and mixes. Two or three covers repeat so the square is always full. */
export function Mosaic({ covers, label, radius = 10, style }: { covers: readonly CoverInfo[]; label: string; radius?: number; style?: StyleProp<ViewStyle> }) {
  if (covers.length < 2) return covers[0] ? <Cover {...covers[0]} radius={radius} style={style} /> : <Cover albumId="" cover={false} label={label} radius={radius} style={style} />;
  const cells = covers.length >= 4 ? covers.slice(0, 4) : covers.length === 3 ? [...covers, covers[0]] : [covers[0], covers[1], covers[1], covers[0]];
  return <View style={[{ width: '100%', aspectRatio: 1, borderRadius: radius, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }, style]}>
    {cells.map((item, position) => <View key={`${item.albumId}:${position}`} style={{ width: '50%', height: '50%' }}><Cover {...item} radius={0} maxPx={400} style={{ height: '100%', aspectRatio: undefined }} /></View>)}
  </View>;
}

/** Liked Songs: a violet-to-pink tile with a heart. */
export function LikedCover({ size, radius = 10, style, glyph }: { size?: number; radius?: number; style?: StyleProp<ViewStyle>; glyph: number }) {
  return <View style={[{ width: size ?? '100%', height: size, aspectRatio: size ? undefined : 1, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundImage: 'linear-gradient(140deg, #6d4cff, #ff5c8a)' }, style]}>
    <Heart size={glyph} color="#fff" fill="#fff" />
  </View>;
}

/** Three bars that dance while a song plays. */
export function Equalizer({ paused }: { paused: boolean }) {
  const bars = useRef([new Animated.Value(0.4), new Animated.Value(0.4), new Animated.Value(0.4)]).current;
  useEffect(() => {
    if (paused) { bars.forEach((bar) => bar.stopAnimation()); return; }
    const loops = bars.map((bar, position) => Animated.loop(Animated.sequence([
      Animated.delay(position * 300),
      Animated.timing(bar, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(bar, { toValue: 0.4, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])));
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [paused, bars]);
  const heights = [0.6, 1, 0.4];
  return <View accessibilityElementsHidden style={{ width: 16, height: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
    {bars.map((bar, position) => <Animated.View key={position} style={{ width: 3, height: 16 * heights[position], borderRadius: 1, backgroundColor: M.accent, transform: [{ translateY: bar.interpolate({ inputRange: [0.4, 1], outputRange: [16 * heights[position] * 0.3, 0] }) }, { scaleY: bar }] }} />)}
  </View>;
}

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill as ImageStyle,
});

export type { TextStyle };
export { art };
