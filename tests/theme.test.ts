import assert from 'node:assert/strict';
import test from 'node:test';
import { rgbOfHex, mix } from '../src/design/color';
import { applyTheme, inkAlpha, music, musicDarkPalette, theme, watch, watchDarkPalette } from '../src/design/tokens';

type Rgba = { rgb: readonly [number, number, number]; alpha: number };

/** Reads `#rrggbb` and `rgba(r, g, b, a)`. */
function parse(colour: string): Rgba {
  if (colour.startsWith('#')) return { rgb: rgbOfHex(colour), alpha: 1 };
  const parts = colour.replace(/rgba?\(|\)/g, '').split(',').map((part) => Number(part.trim()));
  return { rgb: [parts[0], parts[1], parts[2]], alpha: parts[3] ?? 1 };
}

const linear = (channel: number): number => { const s = channel / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: readonly [number, number, number]): number => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** WCAG contrast of `foreground` (which may be translucent) drawn over the opaque `background`. */
function contrast(foreground: string, background: string): number {
  const back = parse(background).rgb;
  const front = parse(foreground);
  const seen = mix(back, front.rgb, front.alpha);
  const [high, low] = [luminance(seen), luminance(back)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

test('the dark theme is the approved palette, unchanged', () => {
  applyTheme('dark');
  assert.equal(theme.mode, 'dark');
  assert.deepEqual({ bg: music.bg, ink: music.ink, muted: music.muted, accent: music.accent, accentInk: music.accentInk }, { bg: '#090a10', ink: '#f6f6fb', muted: 'rgba(246, 246, 251, 0.64)', accent: '#ff5c8a', accentInk: '#1a0610' });
  assert.deepEqual({ bg: watch.bg, raised: watch.raised, ink: watch.ink, accent: watch.accent }, { bg: '#03110a', raised: '#072216', ink: '#ecfdf3', accent: '#34e58a' });
  assert.equal(inkAlpha(0.78), 'rgba(255, 255, 255, 0.78)', 'the white-alpha strings the dark screens always used');
});

test('switching the theme changes the live palettes in place, and switching back restores them', () => {
  applyTheme('light');
  assert.equal(theme.mode, 'light');
  assert.equal(music.bg, '#f4f4f8');
  assert.equal(watch.bg, '#eef5f0');
  assert.equal(inkAlpha(0.5), 'rgba(20, 21, 31, 0.5)');
  assert.equal(musicDarkPalette.bg, '#090a10', 'the dark-only copy never changes');
  assert.equal(watchDarkPalette.bg, '#03110a');
  applyTheme('dark');
  assert.equal(music.bg, '#090a10');
  assert.equal(watch.bg, '#03110a');
});

for (const mode of ['dark', 'light'] as const) {
  test(`${mode} Music: text meets WCAG AA on the page, and the accent controls do too`, () => {
    applyTheme(mode);
    assert.ok(contrast(music.ink, music.bg) >= 7, 'ink on the page');
    assert.ok(contrast(music.muted, music.bg) >= 4.5, 'muted text on the page');
    assert.ok(contrast(music.accent, music.bg) >= 4.5, 'accent on the page');
    assert.ok(contrast(music.accentInk, music.accent) >= 4.5, 'text on the accent');
    assert.ok(contrast(music.accentInk, music.solid) >= 7, 'text on the strong fill');
    assert.ok(contrast(music.danger, music.bg) >= 4.5, 'destructive text on the page');
    const surface = mix(parse(music.bg).rgb, parse(music.surface).rgb, parse(music.surface).alpha);
    assert.ok(contrast(music.muted, `rgb(${surface.join(', ')})`) >= 4.5, 'muted text on a raised surface');
  });

  test(`${mode} Watch: text meets WCAG AA on the page, and the accent controls do too`, () => {
    applyTheme(mode);
    assert.ok(contrast(watch.ink, watch.bg) >= 7, 'ink on the page');
    assert.ok(contrast(watch.muted, watch.bg) >= 4.5, 'muted text on the page');
    assert.ok(contrast(watch.accent, watch.bg) >= 4.5, 'accent on the page');
    assert.ok(contrast(watch.accentInk, watch.accent) >= 4.5, 'text on the accent');
    assert.ok(contrast(watch.warn, watch.bg) >= 4.5, 'warning text on the page');
    assert.ok(contrast(watch.muted, watch.surface) >= 4.5, 'muted text on a raised surface');
  });
}

test.after(() => applyTheme('dark'));
