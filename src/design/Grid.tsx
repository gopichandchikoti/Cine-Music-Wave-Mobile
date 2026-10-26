import { Children, createContext, useContext, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/** True inside a grid cell: a card there fills the cell instead of keeping its shelf width. */
export const GridCellContext = createContext(false);
export const useInGrid = (): boolean => useContext(GridCellContext);

type GridProps = {
  children: ReactNode;
  /** a fixed number of columns, or "auto" to fit as many as `minWidth` allows (CSS repeat(auto-fill, minmax(minWidth, 1fr))) */
  columns: number | 'auto';
  minWidth?: number;
  gap: number;
  rowGap?: number;
  style?: StyleProp<ViewStyle>;
};

/** A CSS-grid-like layout: equal columns that share the width. */
export function Grid({ children, columns, minWidth = 168, gap, rowGap = gap, style }: GridProps) {
  const [width, setWidth] = useState(0);
  const count = columns === 'auto' ? Math.max(1, Math.floor((width + gap) / (minWidth + gap))) : columns;
  const cell = width > 0 ? (width - gap * (count - 1)) / count : 0;
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gap, rowGap }, style]}>
    {width > 0 ? Children.toArray(children).map((child, position) => <GridCellContext.Provider key={position} value><View style={{ width: cell, minWidth: 0 }}>{child}</View></GridCellContext.Provider>) : null}
  </View>;
}
