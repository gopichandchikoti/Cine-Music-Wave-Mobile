/**
 * Apple-style springs, the same three the web apps use (themes/motion.css). A spring is described by how long it takes to arrive
 * (`response`, seconds) and how much it overshoots (`dampingFraction`: 1 arrives without overshoot, below 1 overshoots). They are
 * the two numbers SwiftUI's `.spring(response:dampingFraction:)` takes. Physics, with mass 1: stiffness = (2π / response)² and
 * damping = 4π × dampingFraction / response, which is what `Animated.spring` expects.
 *
 * This file has no React Native imports so the tests can run it under Node.
 */
export type SpringSpec = { response: number; dampingFraction: number };

export const SPRINGS = {
  /** Tab indicators, switches, small state changes. */
  snappy: { response: 0.32, dampingFraction: 0.86 },
  /** Sheets, the full-screen player, minimise and expand. No overshoot. */
  smooth: { response: 0.5, dampingFraction: 1 },
  /** Menus, popovers and dialogs appearing. */
  bouncy: { response: 0.45, dampingFraction: 0.7 },
} as const satisfies Record<string, SpringSpec>;

export type SpringName = keyof typeof SPRINGS;

export type SpringPhysics = { mass: 1; stiffness: number; damping: number };

/** The mass, stiffness and damping of a spring given as response and damping fraction. */
export const physicsOf = ({ response, dampingFraction }: SpringSpec): SpringPhysics => ({
  mass: 1,
  stiffness: (2 * Math.PI) ** 2 / response ** 2,
  damping: (4 * Math.PI * dampingFraction) / response,
});
