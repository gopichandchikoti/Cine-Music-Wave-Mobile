import { Check, Disc3, Heart, ListEnd, ListPlus, ListStart, Plus, Radio, Trash2, UserRound, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Animated, BackHandler, Keyboard, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy, formatContent } from '../../core/content';
import { artistLine, keyOf } from '../../core/musicModel';
import type { PlaylistSummary } from '../../core/musicTypes';
import { Glass } from '../../design/Glass';
import { usePresencePhase, useSpringEnterExit } from '../../design/Presence';
import { Press } from '../../design/primitives';
import { between, opacityOf } from '../../design/spring';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useMusic } from './musicContext';
import { useMusicNav, type Anchor, type MenuSource } from './musicNav';
import { Cover, IconButton, Mosaic, Note, Pill } from './ui';

const t = copy.musicView;
const MARGIN = 10;
/** How far a bottom sheet rises from, in dp. It also sinks this far when it closes. */
const SHEET_TRAVEL = 48;
/** The size a floating menu or dialog grows from. */
const POP_FROM = 0.9;
const DIALOG_FROM = 0.92;

export type MenuState = { trackIds: readonly string[]; anchor: Anchor | null; source: MenuSource | undefined };

type Icon = ComponentType<{ size?: number; color?: string; fill?: string }>;

/** The dark glass of menus, dialogs and popovers (web: .music-menu, .music-dialog, .music-popover). */
export const menuGlass = { alphas: [0.14, 0.03, 0.07] as const, base: 'rgba(16, 18, 28, 0.58)', solid: 'rgba(28, 30, 40, 0.97)' };

/** A full-screen dimmer; pressing it outside the pane closes. `light` shows no dimming (menus), otherwise the page dims (dialogs). */
export function Scrim({ onClose, light, children, align = 'center' }: { onClose: () => void; light?: boolean; children: ReactNode; align?: 'center' | 'end' | 'start' }) {
  const fade = useRef(new Animated.Value(0)).current;
  const leaving = usePresencePhase() === 'exit';
  useSpringEnterExit(fade, 'snappy');
  // The Android back button closes the topmost menu or dialog first. A menu on its way out has already been closed.
  useEffect(() => {
    if (leaving) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose, leaving]);
  return <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents={leaving ? 'none' : 'box-none'}>
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityOf(fade), backgroundColor: light ? 'transparent' : 'rgba(4, 4, 10, 0.55)' }]}>
      <Press onPress={onClose} label={t.close} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { padding: align === 'center' ? 16 : 0, justifyContent: align === 'end' ? 'flex-end' : align === 'start' ? 'flex-start' : 'center', alignItems: 'center' }]}>{children}</View>
  </View>;
}

function MenuItem({ icon: IconComponent, label, onPress, danger, fillIcon }: { icon: Icon; label: string; onPress: () => void; danger?: boolean; fillIcon?: boolean }) {
  const nav = useMusicNav();
  const ink = danger ? '#ff8a9c' : M.ink;
  return <Press role="menuitem" onPress={onPress} label={label} pressedStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.14)' }}
    style={{ minHeight: nav.compact ? 50 : 42, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 10 }}>
    <IconComponent size={18} color={ink} fill={fillIcon ? ink : 'none'} />
    <Txt size={nav.compact ? 16 : 14} color={ink}>{label}</Txt>
  </Press>;
}

/** Lifts what it wraps up from the bottom edge on a smooth spring (no overshoot, so it never lifts off the edge) and sinks it on close. */
export function SheetRise({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const rise = useRef(new Animated.Value(0)).current;
  useSpringEnterExit(rise, 'smooth');
  return <Animated.View style={[style, { opacity: opacityOf(rise), transform: [{ translateY: between(rise, SHEET_TRAVEL, 0) }] }]}>{children}</Animated.View>;
}

/** A pane that rises from the bottom on phones, or floats beside its button on wide screens, growing out of the button with a bounce. */
function MenuPane({ children, anchor, width = 250 }: { children: ReactNode; anchor: Anchor | null; width?: number }) {
  const nav = useMusicNav();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (nav.compact || !anchor) {
    return <SheetRise style={{ width: '100%', maxHeight: screenHeight - 24 }}>
      <Glass {...menuGlass} radius={[24, 24, 0, 0]} style={{ padding: 10, paddingBottom: 10 + insets.bottom }}>{children}</Glass>
    </SheetRise>;
  }
  return <FloatingPane anchor={anchor} width={width}>{children}</FloatingPane>;
}

/** A menu beside its button: it grows out of the button's corner with a bounce, and flips above the button when there is no room below. */
function FloatingPane({ children, anchor, width }: { children: ReactNode; anchor: Anchor; width: number }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);
  useSpringEnterExit(pop, 'bouncy');
  const w = Math.min(340, screenWidth - 20, Math.max(width, 250));
  const left = Math.min(Math.max(MARGIN, anchor.x + anchor.width - w), screenWidth - w - MARGIN);
  const below = anchor.y + anchor.height + 6;
  const flipped = height > 0 && below + height > screenHeight - MARGIN;
  const top = flipped ? Math.max(MARGIN, anchor.y - height - 6) : below;
  return <Animated.View onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    style={{ position: 'absolute', left, top, width: w, maxHeight: screenHeight - 24, opacity: height > 0 ? opacityOf(pop) : 0, transformOrigin: flipped ? 'bottom right' : 'top right', transform: [{ scale: between(pop, POP_FROM, 1) }] }}>
    <Glass {...menuGlass} radius={16} style={{ padding: 6 }}>{children}</Glass>
  </Animated.View>;
}

/** A dialog's card: it grows in with a bounce and shrinks away on close, like an iOS alert. */
function DialogPane({ children, maxHeight }: { children: ReactNode; maxHeight?: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  useSpringEnterExit(pop, 'bouncy');
  return <Animated.View style={{ width: '100%', maxWidth: 440, maxHeight, opacity: opacityOf(pop), transform: [{ scale: between(pop, DIALOG_FROM, 1) }] }}>
    <Glass {...menuGlass} radius={22} style={{ width: '100%', maxHeight, padding: 20, gap: 14 }}>{children}</Glass>
  </Animated.View>;
}

/** The "…" menu for one or more songs. On a phone it rises from the bottom like an app sheet. */
export function TrackMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const music = useMusic();
  const nav = useMusicNav();
  const tracks = menu.trackIds.flatMap((id) => music.index.byId.get(id) ?? []);
  const single = tracks.length === 1 ? tracks[0] : null;
  if (tracks.length === 0) return null;
  const ids = tracks.map((track) => track.id);
  const act = (action: () => void) => (): void => { onClose(); action(); };
  const albumId = single?.albumId ?? (new Set(tracks.map((track) => track.albumId)).size === 1 ? tracks[0].albumId : null);
  const artists = single?.artists ?? [];
  const liked = single ? music.likes.has(single.id) : false;
  const source = menu.source;
  return <Scrim onClose={onClose} light align={nav.compact || !menu.anchor ? 'end' : 'start'}>
    <MenuPane anchor={menu.anchor}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 640 }}>
        {single ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: M.line }}>
          <View style={{ width: 44 }}><Cover albumId={single.albumId} cover={single.cover} label={single.album} radius={6} maxPx={160} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt size={14} weight={700} lines={1}>{single.title}</Txt>
            <Txt size={12} color={M.muted} lines={1}>{artistLine(single) || single.album}</Txt>
          </View>
        </View> : null}
        <MenuItem icon={ListStart} label={t.playNext} onPress={act(() => music.playNext(ids))} />
        <MenuItem icon={ListEnd} label={t.addToQueue} onPress={act(() => music.addToQueue(ids))} />
        <MenuItem icon={ListPlus} label={t.addToPlaylist} onPress={act(() => nav.pickPlaylist(ids))} />
        {single ? <MenuItem icon={Heart} fillIcon={liked} label={liked ? t.unlike : t.like} onPress={act(() => music.toggleLike(single.id))} /> : null}
        {single ? <MenuItem icon={Radio} label={t.startRadio} onPress={act(() => music.startRadio({ kind: 'track', value: single.id }))} /> : null}
        {albumId ? <MenuItem icon={Disc3} label={t.goToAlbum} onPress={act(() => nav.go({ page: 'album', id: albumId }))} /> : null}
        {artists.map((name) => <MenuItem key={name} icon={UserRound} label={formatContent(t.goToArtist, { name })} onPress={act(() => nav.go({ page: 'artist', key: keyOf(name) }))} />)}
        {source?.playlistId && source.playlistPosition !== undefined && single ? <MenuItem icon={Trash2} danger label={t.removeFromPlaylist} onPress={act(() => {
          const playlist = music.user.playlists.find((entry) => entry.id === source.playlistId);
          if (playlist) void music.setPlaylistTracks(playlist.id, playlist.trackIds.filter((_id, position) => position !== source.playlistPosition));
        })} /> : null}
        {source?.queuePosition !== undefined ? <MenuItem icon={X} danger label={t.removeFromQueue} onPress={act(() => music.removeFromQueue(source.queuePosition!))} /> : null}
        {nav.compact ? <Press role="menuitem" onPress={onClose} label={t.close} style={{ minHeight: 50, marginTop: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}><Txt size={16} weight={700}>{t.close}</Txt></Press> : null}
      </ScrollView>
    </MenuPane>
  </Scrim>;
}

function PlaylistOption({ playlist, onPick }: { playlist: PlaylistSummary; onPick: () => void }) {
  const music = useMusic();
  const covers = [...new Set(playlist.trackIds.map((id) => music.index.byId.get(id)?.albumId).filter((id): id is string => Boolean(id)))].slice(0, 4)
    .map((albumId) => { const track = music.index.tracks.find((entry) => entry.albumId === albumId)!; return { albumId, cover: track.cover, label: track.album }; });
  return <Press onPress={onPick} label={playlist.name} pressedStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6, borderRadius: 12 }}>
    <View style={{ width: 48 }}><Mosaic covers={covers} label={playlist.name} radius={8} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Txt size={14} weight={700} lines={1}>{playlist.name}</Txt>
      <Txt size={12} color={M.muted} lines={1} style={{ marginTop: 2 }}>{formatContent(playlist.trackCount === 1 ? t.oneSong : t.manySongs, { count: playlist.trackCount })}</Txt>
    </View>
  </Press>;
}

function DialogInput({ value, onChange, onSubmit, placeholder, label }: { value: string; onChange: (value: string) => void; onSubmit: () => void; placeholder: string; label: string }) {
  return <TextInput value={value} onChangeText={onChange} onSubmitEditing={onSubmit} placeholder={placeholder} placeholderTextColor={M.muted} accessibilityLabel={label} maxLength={80} autoFocus returnKeyType="done"
    style={{ flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 14, paddingVertical: 0, borderWidth: 1, borderColor: M.line, borderRadius: 12, backgroundColor: 'rgba(0, 0, 0, 0.25)', color: M.ink, fontFamily: 'DMSans_400Regular', fontSize: 16 }} />;
}

/** Choose a playlist for some songs, or make a new one. */
export function PlaylistPicker({ trackIds, onClose }: { trackIds: readonly string[]; onClose: () => void }) {
  const music = useMusic();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async (): Promise<void> => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await music.createPlaylist(name.trim(), trackIds);
    setBusy(false);
    if (created) { Keyboard.dismiss(); music.toast(formatContent(t.addedToNamedPlaylist, { name: created.name })); onClose(); }
  };
  const { height } = useWindowDimensions();
  return <Scrim onClose={onClose}>
    <DialogPane maxHeight={height - 32}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt size={20} weight={700} accessibilityRole="header">{t.addToPlaylist}</Txt>
        <IconButton icon={X} label={t.close} onPress={onClose} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <DialogInput value={name} onChange={setName} onSubmit={() => { void create(); }} placeholder={t.newPlaylistName} label={t.newPlaylistName} />
        <Pill primary icon={Plus} disabled={!name.trim() || busy} onPress={() => { void create(); }}>{t.createPlaylist}</Pill>
      </View>
      <ScrollView style={{ maxHeight: height * 0.4 }} keyboardShouldPersistTaps="handled">
        {music.user.playlists.length === 0 ? <Note>{t.noPlaylistsYet}</Note> : null}
        {music.user.playlists.map((playlist) => <PlaylistOption key={playlist.id} playlist={playlist} onPick={() => { void music.addToPlaylist(playlist.id, trackIds); onClose(); }} />)}
      </ScrollView>
    </DialogPane>
  </Scrim>;
}

/** A small "name your playlist" dialog, used from the library page and the sidebar. */
export function CreatePlaylistDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (playlist: PlaylistSummary) => void }) {
  const music = useMusic();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await music.createPlaylist(name.trim());
    setBusy(false);
    if (created) { Keyboard.dismiss(); onCreated(created); onClose(); }
  };
  return <Scrim onClose={onClose}>
    <DialogPane>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt size={20} weight={700} accessibilityRole="header">{t.createPlaylist}</Txt>
        <IconButton icon={X} label={t.close} onPress={onClose} />
      </View>
      <View style={{ flexDirection: 'row' }}><DialogInput value={name} onChange={setName} onSubmit={() => { void submit(); }} placeholder={t.newPlaylistName} label={t.newPlaylistName} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Pill onPress={onClose}>{t.cancel}</Pill>
        <Pill primary icon={Check} disabled={!name.trim() || busy} onPress={() => { void submit(); }}>{t.create}</Pill>
      </View>
    </DialogPane>
  </Scrim>;
}

/** The list a filter or sort control opens (the phone's counterpart of a <select>). */
export function OptionSheet({ title, options, value, onPick, onClose }: { title: string; options: { value: string; label: string }[]; value: string; onPick: (value: string) => void; onClose: () => void }) {
  const { height } = useWindowDimensions();
  return <Scrim onClose={onClose} light align="end">
    <MenuPane anchor={null}>
      <Txt size={12} weight={700} ls={0.08} upper color={M.muted} style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}>{title}</Txt>
      <ScrollView style={{ maxHeight: height * 0.55 }} showsVerticalScrollIndicator={false}>
        {options.map((option) => <Press key={option.value || 'all'} role="radio" checked={option.value === value} label={option.label} onPress={() => { onPick(option.value); onClose(); }}
          pressedStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.14)' }} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, borderRadius: 10 }}>
          <Txt size={16} weight={option.value === value ? 700 : 400} lines={1} style={{ flex: 1 }}>{option.label}</Txt>
          {option.value === value ? <Check size={18} color={M.accent} /> : null}
        </Press>)}
      </ScrollView>
      <Press role="menuitem" onPress={onClose} label={t.close} style={{ minHeight: 50, marginTop: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}><Txt size={16} weight={700}>{t.close}</Txt></Press>
    </MenuPane>
  </Scrim>;
}
