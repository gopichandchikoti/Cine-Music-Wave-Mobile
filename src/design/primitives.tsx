import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Pressable, View, type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { music } from './tokens';

export type PressProps = {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** merged over `style` while the finger is down (web: the :hover / :active look) */
  pressedStyle?: StyleProp<ViewStyle>;
  /** web: transform: scale(.92) on :active */
  pressScale?: number;
  disabled?: boolean;
  label?: string;
  hint?: string;
  role?: 'button' | 'tab' | 'menuitem' | 'switch' | 'radio' | 'link' | 'imagebutton';
  selected?: boolean;
  checked?: boolean;
  expanded?: boolean;
  hitSlop?: number;
  children?: ReactNode | ((pressed: boolean) => ReactNode);
};

/** The app's one pressable: accessible by default, with the web's pressed feedback. */
export function Press({ onPress, onLongPress, style, pressedStyle, pressScale, disabled, label, hint, role = 'button', selected, checked, expanded, hitSlop, children }: PressProps) {
  return <Pressable
    onPress={onPress}
    onLongPress={onLongPress}
    disabled={disabled}
    hitSlop={hitSlop}
    accessibilityRole={role}
    accessibilityLabel={label}
    accessibilityHint={hint}
    accessibilityState={{ disabled: disabled === true, selected, checked, expanded }}
    style={({ pressed }) => [style, disabled ? { opacity: 0.45 } : null, pressed ? pressedStyle : null, pressed && pressScale !== undefined ? { transform: [{ scale: pressScale }] } : null]}
  >{({ pressed }) => (typeof children === 'function' ? children(pressed) : children)}</Pressable>;
}

/** A turning ring: web .music-spinner / .watch-spinner. */
export function Spinner({ size = 28, border = 3, color, track = music.ring, slow = false }: { size?: number; border?: number; color: string; track?: string; slow?: boolean }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: slow ? 2400 : 800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turn, slow]);
  return <Animated.View accessibilityRole="progressbar" style={{ width: size, height: size, borderRadius: size / 2, borderWidth: border, borderColor: track, borderTopColor: color, transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} />;
}

export type RangeSliderProps = {
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  /** called once when the finger lifts, with the final value */
  onCommit?: (value: number) => void;
  disabled?: boolean;
  label: string;
  fill: string;
  track: string;
  thumb?: string | null;
  thumbSize?: number;
  trackHeight?: number;
  /** secondary fill drawn behind the main fill (web: the buffered range of the video) */
  buffered?: number;
  bufferedColor?: string;
  style?: StyleProp<ViewStyle>;
};

const snap = (value: number, min: number, max: number, step: number): number => {
  const clamped = Math.min(Math.max(value, min), max);
  return step > 0 ? Math.min(max, min + Math.round((clamped - min) / step) * step) : clamped;
};

/** The web's thin range slider: a 4px track filled up to the handle. Dragging reports continuously; lifting commits. */
export function RangeSlider({ value, min = 0, max, step = 0, onChange, onCommit, disabled, label, fill, track, thumb = '#fff', thumbSize = 12, trackHeight = 4, buffered, bufferedColor, style }: RangeSliderProps) {
  const [width, setWidth] = useState(0);
  const frame = useRef({ left: 0, width: 0 });
  const box = useRef<ComponentRef<typeof View>>(null);
  const latest = useRef({ min, max, step, onChange, onCommit, disabled });
  useEffect(() => { latest.current = { min, max, step, onChange, onCommit, disabled }; });
  const pending = useRef<number | null>(null);

  const valueAt = (pageX: number): number => {
    const { min: low, max: high, step: increment } = latest.current;
    const ratio = frame.current.width > 0 ? (pageX - frame.current.left) / frame.current.width : 0;
    return snap(low + ratio * (high - low), low, high, increment);
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onMoveShouldSetPanResponder: () => !latest.current.disabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event: GestureResponderEvent) => {
      const pageX = event.nativeEvent.pageX;
      box.current?.measureInWindow((x, _y, w) => {
        frame.current = { left: x, width: w };
        pending.current = valueAt(pageX);
        latest.current.onChange?.(pending.current);
      });
    },
    onPanResponderMove: (event: GestureResponderEvent) => {
      pending.current = valueAt(event.nativeEvent.pageX);
      latest.current.onChange?.(pending.current);
    },
    onPanResponderRelease: () => { if (pending.current !== null) latest.current.onCommit?.(pending.current); pending.current = null; },
    onPanResponderTerminate: () => { pending.current = null; },
  })).current;

  const range = max - min;
  const ratio = range > 0 ? Math.min(1, Math.max(0, (value - min) / range)) : 0;
  const bufferRatio = buffered !== undefined && range > 0 ? Math.min(1, Math.max(0, (buffered - min) / range)) : 0;
  const onLayout = (event: LayoutChangeEvent): void => setWidth(event.nativeEvent.layout.width);
  return <View
    ref={box}
    onLayout={onLayout}
    accessible
    accessibilityRole="adjustable"
    accessibilityLabel={label}
    accessibilityValue={{ min, max, now: value }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={(event) => {
      const delta = (step > 0 ? step : range / 20) * (event.nativeEvent.actionName === 'increment' ? 1 : -1);
      const next = snap(value + delta, min, max, step);
      onChange?.(next);
      onCommit?.(next);
    }}
    style={[{ height: 22, justifyContent: 'center' }, disabled ? { opacity: 0.45 } : null, style]}
    {...responder.panHandlers}
  >
    <View style={{ height: trackHeight, borderRadius: 2, backgroundColor: track, overflow: 'hidden' }}>
      {bufferedColor ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bufferRatio * 100}%`, backgroundColor: bufferedColor }} /> : null}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${ratio * 100}%`, backgroundColor: fill }} />
    </View>
    {thumb ? <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, ratio * width - thumbSize / 2), top: (22 - thumbSize) / 2, width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: thumb, boxShadow: '0 1px 6px rgba(0, 0, 0, 0.5)' }} /> : null}
  </View>;
}
