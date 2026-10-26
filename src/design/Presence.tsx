import { Component, createContext, useContext, useEffect, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';
import { reduceMotionNow, spring, useReducedMotion, type SpringName } from './spring';

type Phase = 'open' | 'exit';

const PresenceContext = createContext<Phase>('open');

/** Whether the surrounding overlay is open or on its way out. Overlays that never leave through <Presence> are always 'open'. */
export const usePresencePhase = (): Phase => useContext(PresenceContext);

const EXIT_MS = 240;
/** How long the removal waits after the exit starts: the exit animation plus a frame or two. */
const REMOVE_AFTER_MS = EXIT_MS + 30;
const REDUCED_REMOVE_AFTER_MS = 60;

type PresenceProps = { show: boolean; children: ReactNode };
type PresenceState = { node: ReactNode; phase: 'open' | 'exit' | 'gone' };

/**
 * Keeps an overlay mounted while it animates away, so closing is as deliberate as opening. The children from the last open render
 * stay on screen in the 'exit' phase; they read it with `usePresencePhase` (or `useSpringEnterExit`) and play their exit.
 * It is a class because it derives state from props before rendering and runs a timer from a lifecycle method.
 */
export class Presence extends Component<PresenceProps, PresenceState> {
  state: PresenceState = this.props.show ? { node: this.props.children, phase: 'open' } : { node: null, phase: 'gone' };
  private timer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromProps(props: PresenceProps, state: PresenceState): Partial<PresenceState> | null {
    if (props.show) return { node: props.children, phase: 'open' };
    return state.phase === 'open' ? { phase: 'exit' } : null;
  }

  componentDidUpdate(_previousProps: PresenceProps, previousState: PresenceState): void {
    if (this.state.phase === 'open' && this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.state.phase === 'exit' && previousState.phase !== 'exit') this.scheduleRemoval();
  }

  private scheduleRemoval(): void {
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.setState({ node: null, phase: 'gone' });
    }, reduceMotionNow() ? REDUCED_REMOVE_AFTER_MS : REMOVE_AFTER_MS);
  }

  componentWillUnmount(): void {
    clearTimeout(this.timer);
  }

  render(): ReactNode {
    const { node, phase } = this.state;
    if (phase === 'gone' || node === null || node === false) return null;
    return <PresenceContext.Provider value={phase}>{node}</PresenceContext.Provider>;
  }
}

/**
 * Drives a 0..1 value for an overlay: it springs to 1 when the overlay opens and eases back to 0 when it leaves. Interpolate the
 * value into opacity and translation. With reduced motion it jumps instead.
 */
export function useSpringEnterExit(progress: Animated.Value, name: SpringName): void {
  const phase = usePresencePhase();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      progress.setValue(phase === 'exit' ? 0 : 1);
      return;
    }
    if (phase === 'exit') {
      Animated.timing(progress, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start();
      return;
    }
    Animated.spring(progress, { toValue: 1, ...spring(name) }).start();
  }, [phase, reduced, progress, name]);
}
