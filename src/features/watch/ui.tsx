import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { memo, useCallback, useRef, useState, type ComponentRef, type ComponentType, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { content as copy } from '../../core/content';
import type { WatchTitle } from '../../core/watchTypes';
import { primaryFile } from '../../core/watchModel';
import { useLibrary } from '../../data/LibraryProvider';
import { Press } from '../../design/primitives';
import { watch as W } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import Wave from '../../../modules/wave-media';
import { useArt } from '../../platform/artwork';

/**
 * Every button in the web's Watch shell gets a glass rim (Entertainment.css): a faint 145° sheen, a 1px light border and a highlight along
 * the top edge. These are those values, so each control here has the same edge.
 */
export const glassLook: ViewStyle = {
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.22)',
  backgroundImage: 'linear-gradient(145deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.045) 60%, rgba(255, 255, 255, 0.10))',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.32), inset 0 -1px 0 rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.15)',
};

type Icon = ComponentType<{ size?: number; color?: string; fill?: string }>;

/** web: .watch-button (with .is-primary) */
export function WatchButton({ label, icon: Icon, onPress, primary, disabled, fill, style }: { label: string; icon?: Icon; onPress?: () => void; primary?: boolean; disabled?: boolean; fill?: boolean; style?: StyleProp<ViewStyle> }) {
  const ink = primary ? W.accentInk : W.ink;
  return <Press onPress={onPress} disabled={disabled} label={label} pressScale={0.98}
    style={[glassLook, { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 22, borderRadius: 7, backgroundColor: primary ? W.accent : 'rgba(236, 253, 243, 0.16)' }, style]}
    pressedStyle={{ backgroundColor: primary ? W.accentHover : 'rgba(236, 253, 243, 0.26)' }}>
    {Icon ? <Icon size={20} color={ink} fill={fill ? ink : 'none'} /> : null}
    <Txt size={16} weight={700} color={ink}>{label}</Txt>
  </Press>;
}

/** web: .watch-round, a 40px circle for icon-only actions. */
export function RoundButton({ label, icon: Icon, onPress, primary, ghost, size = 40, iconSize = 20, fill, on }: { label: string; icon: Icon; onPress?: () => void; primary?: boolean; ghost?: boolean; size?: number; iconSize?: number; fill?: boolean; on?: boolean }) {
  const ink = primary ? W.accentInk : W.ink;
  return <Press onPress={onPress} label={label} selected={on} pressScale={0.94}
    style={[ghost ? { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.22)' } : glassLook, { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? W.accent : ghost ? 'transparent' : 'rgba(3, 17, 10, 0.55)' }]}>
    <Icon size={iconSize} color={ink} fill={fill ? ink : 'none'} />
  </Press>;
}

const initialsOf = (name: string): string => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');

/** The title's picture (a frame from the video), or a green placeholder while it is being made. */
export function TitleArt({ title, kind, radius = 0 }: { title: WatchTitle; kind: 'card' | 'backdrop'; radius?: number }) {
  const library = useLibrary();
  const file = primaryFile(title);
  const record = file ? library.recordOf(file.id) : undefined;
  const px = kind === 'card' ? 480 : 960;
  const key = record && record.readAt > 0 ? `poster:${record.id}:${px}` : null;
  const make = useCallback(() => (record ? Wave.artwork(record.uri, 'video', key ?? record.id, px) : Promise.resolve(null)), [record, key, px]);
  const uri = useArt(key, key ? make : null);
  return <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: radius, alignItems: 'center', justifyContent: 'center', backgroundImage: 'linear-gradient(135deg, #14572f, #072a19 70%)' }]}>
    {uri ? <Image source={{ uri }} resizeMode="cover" fadeDuration={150} style={StyleSheet.absoluteFill} /> : <Txt size={22} weight={800} ls={0.04} color="rgba(236, 253, 243, 0.45)">{initialsOf(title.title)}</Txt>}
  </View>;
}

/** A film or series as a 16:9 card with its name over the bottom, a green NEW badge and a progress bar (web: .watch-card). */
function TitleCardView({ title, progress, isNew, width, onOpen }: { title: WatchTitle; progress: number; isNew: boolean; width?: number | `${number}%`; onOpen: (title: WatchTitle) => void }) {
  return <Press onPress={() => onOpen(title)} label={title.title}
    style={[glassLook, { width, aspectRatio: 16 / 9, borderRadius: 6, overflow: 'hidden', backgroundColor: W.surface }]}>
    <TitleArt title={title} kind="card" />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: 'linear-gradient(to top, rgba(3, 17, 10, 0.88), rgba(3, 17, 10, 0) 58%)' }]} />
    {isNew ? <View style={{ position: 'absolute', top: 8, left: 8, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 4, backgroundColor: W.accent }}><Txt size={10} weight={800} ls={0.08} upper color={W.accentInk}>{copy.watchView.newBadge}</Txt></View> : null}
    <View style={{ position: 'absolute', left: 10, right: 10, bottom: 9 }}>
      <Txt size={12} weight={700} lh={1.2} lines={2} style={{ textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 }}>{title.title}</Txt>
    </View>
    {progress > 0 ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(236, 253, 243, 0.25)' }}><View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: W.accent }} /></View> : null}
  </Press>;
}
export const TitleCard = memo(TitleCardView);

/** A titled row that slides sideways, with arrows at the edges when there is more to see (web: .watch-rail). */
export function Rail({ title, gutter, children }: { title: string; gutter: number; children: ReactNode }) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const sizes = useRef({ offset: 0, view: 0, content: 0 });
  const [more, setMore] = useState({ back: false, forward: false });
  const measure = (): void => { const { offset, view, content } = sizes.current; setMore({ back: offset > 4, forward: offset + view < content - 4 }); };
  const slide = (direction: -1 | 1): void => scroller.current?.scrollTo({ x: Math.max(0, sizes.current.offset + direction * sizes.current.view * 0.86), animated: true });
  const arrowWidth = Math.max(44, gutter + 18);
  return <View accessibilityLabel={title} style={{ gap: 0 }}>
    <Txt size={16} weight={700} ls={-0.01} accessibilityRole="header" style={{ paddingHorizontal: gutter }}>{title}</Txt>
    <View>
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast"
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => { sizes.current.offset = event.nativeEvent.contentOffset.x; measure(); }} scrollEventThrottle={32}
        onLayout={(event) => { sizes.current.view = event.nativeEvent.layout.width; measure(); }} onContentSizeChange={(width) => { sizes.current.content = width; measure(); }}
        contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 14, paddingHorizontal: gutter }}>
        {children}
      </ScrollView>
      {more.back ? <Press onPress={() => slide(-1)} label={copy.watchView.scrollLeft} style={{ position: 'absolute', left: 0, top: 10, bottom: 14, width: arrowWidth, alignItems: 'center', justifyContent: 'center', opacity: 0.9, backgroundImage: 'linear-gradient(to right, rgba(3, 17, 10, 0.88), rgba(3, 17, 10, 0))' }}><ChevronLeft size={30} color={W.ink} /></Press> : null}
      {more.forward ? <Press onPress={() => slide(1)} label={copy.watchView.scrollRight} style={{ position: 'absolute', right: 0, top: 10, bottom: 14, width: arrowWidth, alignItems: 'center', justifyContent: 'center', opacity: 0.9, backgroundImage: 'linear-gradient(to left, rgba(3, 17, 10, 0.88), rgba(3, 17, 10, 0))' }}><ChevronRight size={30} color={W.ink} /></Press> : null}
    </View>
  </View>;
}
