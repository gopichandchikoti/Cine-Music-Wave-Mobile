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

export const withAlpha = (rgb: readonly [number, number, number], alpha: number): string => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
