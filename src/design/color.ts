/** hsl(h s% l%) as an rgb() string, so gradient strings never depend on the platform's colour parser. */
export function hsl(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): number => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `rgb(${channel(0)}, ${channel(8)}, ${channel(4)})`;
}

export type Rgb3 = readonly [number, number, number];

export const withAlpha = (rgb: Rgb3, alpha: number): string => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;

/** The red, green and blue of a `#rrggbb` colour. */
export function rgbOfHex(hex: string): Rgb3 {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/** `from` moved `amount` (0 to 1) of the way towards `to`. */
export function mix(from: Rgb3, to: Rgb3, amount: number): Rgb3 {
  return [0, 1, 2].map((channel) => Math.round(from[channel] + (to[channel] - from[channel]) * amount)) as unknown as Rgb3;
}

export const css = (rgb: Rgb3): string => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
