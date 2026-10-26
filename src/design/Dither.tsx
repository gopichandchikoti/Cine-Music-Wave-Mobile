import { Image, PixelRatio, StyleSheet, useWindowDimensions, View } from 'react-native';

// A 384 px tile of white pixels with a random alpha of 0 to 2.4% (`assets/dither@3x.png`).
const NOISE = require('../../assets/dither.png') as number; // Metro picks the @3x file by the base name
const TILE_PX = 384;

/**
 * A very fine noise laid over a gradient. Android draws gradients in 8 bits without dithering, so a slow dark gradient shows flat bands
 * (measured: runs of 16 px with steps of 1 to 3 levels); a browser dithers its gradients, which is why the web looks smooth. The noise
 * moves each pixel by a level or two at random, which hides the bands. Put it as the last child of the view that holds the gradient.
 *
 * It is laid out as a grid of plain images, one grain per device pixel at any screen density: the `repeat` resize mode drew nothing here.
 * `height` is how far down to cover (the screen's height unless the gradient is shorter).
 */
export function Dither({ height }: { height?: number }) {
  const window = useWindowDimensions();
  const tile = TILE_PX / PixelRatio.get();
  const columns = Math.ceil(window.width / tile);
  const rows = Math.ceil((height ?? window.height) / tile);
  const cells = Array.from({ length: columns * rows }, (_unused, index) => ({ index, left: (index % columns) * tile, top: Math.floor(index / columns) * tile }));
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    {cells.map((cell) => <Image key={cell.index} source={NOISE} fadeDuration={0} style={{ position: 'absolute', left: cell.left, top: cell.top, width: tile, height: tile }} />)}
  </View>;
}
