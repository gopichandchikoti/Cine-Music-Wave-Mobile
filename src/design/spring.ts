import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, type Animated } from 'react-native';
import { physicsOf, SPRINGS, type SpringName, type SpringPhysics } from './springPhysics';

export { SPRINGS, type SpringName } from './springPhysics';

/** The `Animated.spring` settings for a named spring. Spread them into the config next to `toValue`. */
export const spring = (name: SpringName): SpringPhysics & { useNativeDriver: true } => ({ ...physicsOf(SPRINGS[name]), useNativeDriver: true });

/** 0..1 progress as an opacity. It is clamped, so a spring that overshoots never makes anything more than fully opaque. */
export const opacityOf = (progress: Animated.Value): Animated.AnimatedInterpolation<number> =>
  progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

/** 0..1 progress mapped from `from` to `to`. It is not clamped, so an overshooting spring overshoots the property too. */
export const between = (progress: Animated.Value, from: number, to: number): Animated.AnimatedInterpolation<number> =>
  progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

// The system "remove animations" setting, read once and kept up to date. Components read it with useReducedMotion; code outside React
// (the Presence timer) reads it with reduceMotionNow.
let reduceMotion = false;
let watching = false;
const listeners = new Set<() => void>();

const apply = (value: boolean): void => {
  if (value === reduceMotion) return;
  reduceMotion = value;
  listeners.forEach((listener) => listener());
};

function watch(): void {
  if (watching) return;
  watching = true;
  AccessibilityInfo.isReduceMotionEnabled().then(apply, () => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
}

const subscribe = (listener: () => void): (() => void) => {
  watch();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function reduceMotionNow(): boolean {
  watch();
  return reduceMotion;
}

/** True when the person asked the system to reduce motion. Springs then become instant changes. */
export const useReducedMotion = (): boolean => useSyncExternalStore(subscribe, () => reduceMotion, () => false);
