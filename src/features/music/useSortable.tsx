import { GripVertical } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, View, type ViewStyle } from 'react-native';
import { music as M } from '../../design/tokens';

// Drag-to-reorder for a vertical list of equal-height rows, by finger. The row being dragged follows the finger; the rows it passes slide
// out of the way; releasing saves the new order. It never moves the rows itself: it only reports (from, to) and the list re-renders.

type Drag = { from: number; over: number; offset: number };

export type Sortable = {
  dragging: number | null;
  rowStyle: (index: number) => ViewStyle | undefined;
  measureRow: (height: number) => void;
  begin: (index: number) => void;
  move: (dy: number) => void;
  end: (commit: boolean) => void;
  /** move one row by one place (screen readers, which cannot drag) */
  nudge: (index: number, delta: -1 | 1) => void;
};

export function useSortable({ count, onMove, onActive }: { count: number; onMove: (from: number, to: number) => void; onActive?: (active: boolean) => void }): Sortable {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const height = useRef(62);
  const latest = useRef({ count, onMove, onActive });
  useEffect(() => { latest.current = { count, onMove, onActive }; });

  const publish = useCallback((next: Drag | null): void => { dragRef.current = next; setDrag(next); }, []);
  const measureRow = useCallback((value: number): void => { if (value > 0) height.current = value; }, []);
  const begin = useCallback((index: number): void => { publish({ from: index, over: index, offset: 0 }); latest.current.onActive?.(true); }, [publish]);
  const move = useCallback((dy: number): void => {
    const current = dragRef.current;
    if (!current) return;
    const over = Math.min(latest.current.count - 1, Math.max(0, current.from + Math.round(dy / height.current)));
    publish({ from: current.from, over, offset: dy });
  }, [publish]);
  const end = useCallback((commit: boolean): void => {
    const state = dragRef.current;
    publish(null);
    latest.current.onActive?.(false);
    if (commit && state && state.over !== state.from) latest.current.onMove(state.from, state.over);
  }, [publish]);

  const nudge = useCallback((index: number, delta: -1 | 1): void => {
    const target = index + delta;
    if (target >= 0 && target < latest.current.count) latest.current.onMove(index, target);
  }, []);

  /** Style for a row: the dragged row follows the finger, rows in its way make room. */
  const rowStyle = (index: number): ViewStyle | undefined => {
    if (!drag) return undefined;
    if (index === drag.from) return { transform: [{ translateY: drag.offset }], zIndex: 5, backgroundColor: 'rgba(60, 62, 80, 0.95)', boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)' };
    if (drag.from < drag.over && index > drag.from && index <= drag.over) return { transform: [{ translateY: -height.current }] };
    if (drag.from > drag.over && index < drag.from && index >= drag.over) return { transform: [{ translateY: height.current }] };
    return undefined;
  };

  return { dragging: drag?.from ?? null, rowStyle, measureRow, begin, move, end, nudge };
}

/** The grip at the end of a row. Pressing it starts a drag; the page does not scroll while it is held. */
export function DragHandle({ index, sortable, label }: { index: number; sortable: Sortable; label: string }) {
  const latest = useRef({ index, sortable });
  useEffect(() => { latest.current = { index, sortable }; });
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => latest.current.sortable.begin(latest.current.index),
    onPanResponderMove: (_event, gesture) => latest.current.sortable.move(gesture.dy),
    onPanResponderRelease: () => latest.current.sortable.end(true),
    onPanResponderTerminate: () => latest.current.sortable.end(false),
  })).current;
  return <View accessible accessibilityRole="button" accessibilityLabel={label} accessibilityActions={[{ name: 'moveUp', label: 'Move up' }, { name: 'moveDown', label: 'Move down' }]}
    onAccessibilityAction={(event) => latest.current.sortable.nudge(latest.current.index, event.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} {...responder.panHandlers}>
    <GripVertical size={20} color={M.muted} />
  </View>;
}
