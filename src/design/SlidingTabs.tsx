import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { spring, useReducedMotion } from './spring';

type Size = { width: number; height: number };

const FADE_OUT_MS = 160;

/**
 * A row of equal-width tabs with one highlight behind the selected tab. When another tab is chosen the highlight slides across on a
 * snappy spring instead of one tab's background switching off and the next switching on. With no tab selected (`index` -1) it fades
 * away, and the first selection fades it in at the tab rather than sliding in from somewhere else.
 *
 * The tabs are the children, laid out in a row; each should be `flex: 1` and transparent so the highlight shows through.
 */
export function SlidingTabs({ count, index, gap, color, radius, style, children }: {
  count: number; index: number; gap: number; color: string; radius: number; style?: StyleProp<ViewStyle>; children: ReactNode;
}) {
  const [size, setSize] = useState<Size | null>(null);
  const x = useRef(new Animated.Value(0)).current;
  const shown = useRef(new Animated.Value(0)).current;
  const visible = useRef(false);
  const reduced = useReducedMotion();
  const tabWidth = size ? (size.width - gap * (count - 1)) / count : 0;
  const target = index >= 0 && size ? index * (tabWidth + gap) : null;

  useEffect(() => {
    if (target === null) {
      visible.current = false;
      if (reduced) shown.setValue(0);
      else Animated.timing(shown, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start();
      return;
    }
    if (!visible.current || reduced) x.setValue(target);
    else Animated.spring(x, { toValue: target, ...spring('snappy') }).start();
    visible.current = true;
    if (reduced) shown.setValue(1);
    else Animated.spring(shown, { toValue: 1, ...spring('snappy') }).start();
  }, [target, reduced, x, shown]);

  const measure = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => (previous && previous.width === width && previous.height === height ? previous : { width, height }));
  };

  return <View onLayout={measure} style={[{ flexDirection: 'row', gap }, style]}>
    {size ? <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: 0, top: 0, width: tabWidth, height: size.height, borderRadius: radius, backgroundColor: color,
      opacity: shown.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateX: x }],
    }} /> : null}
    {children}
  </View>;
}
