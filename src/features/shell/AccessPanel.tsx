import { FolderOpen, Music2, Film, ShieldCheck, Settings, FilePlus2, RefreshCw } from 'lucide-react-native';
import { useState, type ComponentType, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useLibrary } from '../../data/LibraryProvider';
import { Press, Spinner } from '../../design/primitives';
import { music as M, watch as W } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { openSettings } from '../../platform/permissions';

type Palette = { ink: string; muted: string; line: string; surface: string; accent: string; accentInk: string };

// Read when drawn, not when loaded: the palettes change with the theme.
const palettes = (kind: 'music' | 'watch'): Palette => (kind === 'music'
  ? { ink: M.ink, muted: M.muted, line: M.line, surface: M.surface, accent: M.ink, accentInk: M.accentInk }
  : { ink: W.ink, muted: W.muted, line: W.line, surface: W.fillSoft, accent: W.accent, accentInk: W.accentInk });

function Action({ icon: Icon, label, onPress, primary, palette, busy }: { icon: ComponentType<{ size?: number; color?: string }>; label: string; onPress: () => void; primary?: boolean; palette: Palette; busy?: boolean }) {
  const ink = primary ? palette.accentInk : palette.ink;
  return <Press onPress={onPress} disabled={busy} label={label} pressScale={0.97}
    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: primary ? palette.accent : palette.surface, borderWidth: primary ? 0 : 1, borderColor: palette.line }}>
    {busy ? <Spinner size={16} border={2} color={ink} /> : <Icon size={17} color={ink} />}
    <Txt size={14} weight={700} color={ink}>{label}</Txt>
  </Press>;
}

/**
 * Shown above a catalog that is still listed (kept in the profile database) while Android no longer shares the files: the rows stay so
 * history and playlists survive, but they cannot play, and a toast alone does not say why.
 */
export function AccessNotice({ kind, style }: { kind: 'music' | 'watch'; style?: StyleProp<ViewStyle> }) {
  const library = useLibrary();
  const palette = palettes(kind);
  const { access } = library;
  const shared = kind === 'music' ? access.audio : access.video;
  // Files from the phone's library that were seen before; ones the user picked by hand keep their own access and are not counted.
  const hidden = library.records.some((record) => record.kind === (kind === 'music' ? 'audio' : 'video') && !record.id.startsWith('doc:'));
  if (!library.loaded || shared || !hidden || access.state === 'unknown') return null;
  const noun = kind === 'music' ? 'music' : 'videos';
  const settings = access.state === 'blocked' || access.state === 'partial';
  return <View accessibilityRole="alert" style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface }, style]}>
    <Txt size={13} lh={1.5} color={palette.muted} style={{ flexShrink: 1, flexGrow: 1, flexBasis: 200 }}>{`Android is not sharing your ${noun} with this app, so ${kind === 'music' ? 'songs' : 'titles'} from your phone's library are hidden until you allow access.`}</Txt>
    <Action palette={palette} primary icon={settings ? Settings : ShieldCheck} label={settings ? 'Open settings' : 'Allow access'} onPress={() => { void (settings ? openSettings() : library.askAccess()); }} />
  </View>;
}

/**
 * What to show when no songs/videos are on screen: why (permission, still reading, nothing found) and what to do about it. Signing in
 * never skips the operating system's permission, and the app only ever lists what the system lets it see.
 */
export function AccessPanel({ kind }: { kind: 'music' | 'watch' }) {
  const library = useLibrary();
  const palette = palettes(kind);
  const [busy, setBusy] = useState(false);
  const { access, scan } = library;
  const Hero = kind === 'music' ? Music2 : Film;
  const run = async (action: () => Promise<void>): Promise<void> => { setBusy(true); try { await action(); } finally { setBusy(false); } };
  const noun = kind === 'music' ? 'songs' : 'films and series';

  let title: string;
  let body: ReactNode;
  let actions: ReactNode;
  const common = <>
    <Action palette={palette} icon={FilePlus2} label="Add files" onPress={() => { void library.pick(false); }} />
    <Action palette={palette} icon={FolderOpen} label="Add a folder" onPress={() => { void library.pick(true); }} />
  </>;

  if (!library.loaded || (scan.phase === 'listing' && library.records.length === 0)) {
    title = 'Looking at your phone…';
    body = 'Finding the files Android lets this app see.';
    actions = <Spinner size={28} color={palette.ink} />;
  } else if (access.state === 'denied' || access.state === 'unknown') {
    title = `Allow access to your ${noun}`;
    body = `Cine Music Wave plays what is already on this phone. Android asks first: nothing is read until you allow it, and nothing leaves the device.`;
    actions = <>
      <Action palette={palette} primary icon={ShieldCheck} label="Grant media access" busy={busy} onPress={() => { void run(library.askAccess); }} />
      {common}
    </>;
  } else if (access.state === 'blocked') {
    title = 'Media access is turned off';
    body = 'Android will not ask again. Open Settings → Permissions and allow music and video, or pick files and folders by hand.';
    actions = <>
      <Action palette={palette} primary icon={Settings} label="Open settings" onPress={() => { void openSettings(); }} />
      {common}
    </>;
  } else if (library.records.some((record) => record.kind === (kind === 'music' ? 'audio' : 'video') && !record.missing) || (scan.phase === 'reading' && scan.total > 0)) {
    title = kind === 'music' ? `Reading ${Math.max(0, scan.total - scan.done)} songs…` : 'Getting your library ready…';
    body = 'Tags and covers are being read from the files. They appear here as soon as they are ready.';
    actions = <Spinner size={28} color={palette.ink} />;
  } else {
    const partialHint = access.state === 'partial' && !access.video && kind === 'watch' ? ' Android is only sharing the videos you selected: allow all videos in Settings for the rest.' : access.state === 'partial' && !access.audio && kind === 'music' ? ' Music access is off: allow it in Settings.' : '';
    title = kind === 'music' ? 'No music yet' : 'Nothing to watch yet';
    body = `Android did not show any ${noun} to this app.${partialHint} Put audio or video on the phone, then refresh.`;
    actions = <>
      <Action palette={palette} primary icon={RefreshCw} label="Refresh" busy={busy} onPress={() => { void run(library.rescan); }} />
      {common}
      {access.state === 'partial' ? <Action palette={palette} icon={Settings} label="Open settings" onPress={() => { void openSettings(); }} /> : null}
    </>;
  }

  return <View style={{ minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 40, paddingHorizontal: 20 }} accessibilityRole="summary">
    <Hero size={40} color={palette.muted} />
    <Txt size={24} weight={700} color={palette.ink} align="center" accessibilityRole="header">{title}</Txt>
    <Txt size={15} color={palette.muted} lh={1.55} align="center" style={{ maxWidth: 480 }}>{body}</Txt>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 }}>{actions}</View>
  </View>;
}
