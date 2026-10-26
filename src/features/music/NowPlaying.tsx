import { ChevronDown, Ellipsis, Layers, ListMusic, Mic2, Radio, SlidersHorizontal } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Animated, Image, PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy, formatContent } from '../../core/content';
import { keyOf } from '../../core/musicModel';
import { BlurLayer, Glass } from '../../design/Glass';
import { Presence, usePresencePhase, useSpringEnterExit } from '../../design/Presence';
import { Press } from '../../design/primitives';
import { SlidingTabs } from '../../design/SlidingTabs';
import { between, opacityOf } from '../../design/spring';
import { clamp, music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import Wave from '../../../modules/wave-media';
import { useArt } from '../../platform/artwork';
import { useMusic, type Sheet } from './musicContext';
import { useMusicNav } from './musicNav';
import { OverlayOutlet, OverlayProvider } from './overlays';
import { LikeButton, PlaybackMenu, SeekBar, Transport, Volume } from './PlayerParts';
import { LyricsSheet, QueueSheet, RelatedSheet } from './Sheets';
import { Cover, IconButton } from './ui';

const t = copy.musicView;
const TABS: readonly { id: Exclude<Sheet, null>; label: string; icon: ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'queue', label: t.upNext, icon: ListMusic }, { id: 'lyrics', label: t.lyrics, icon: Mic2 }, { id: 'related', label: t.related, icon: Layers },
];
const SWIPE_TO_CLOSE = 90;
/** How far below its resting place the player starts when it opens, and sinks to when it is minimised, in dp. */
const RISE_FROM = 64;
const DEFAULT_TINT = [52, 120, 90] as const;

const tints = new Map<string, readonly [number, number, number] | null>();

/** The colour that stands out most in the cover, for tinting the backdrop (null until it is known). */
function useDominantColor(albumId: string | null): readonly [number, number, number] | null {
  const uri = useArt(albumId ? `cover:${albumId}` : null, null);
  const [found, setFound] = useState<{ key: string; color: readonly [number, number, number] | null } | null>(null);
  useEffect(() => {
    if (!uri || tints.has(uri)) return;
    let cancelled = false;
    Wave.dominantColor(uri).then((rgb) => {
      const color = rgb && rgb.length === 3 ? [rgb[0], rgb[1], rgb[2]] as const : null;
      tints.set(uri, color);
      if (!cancelled) setFound({ key: uri, color });
    }, () => { tints.set(uri, null); });
    return () => { cancelled = true; };
  }, [uri]);
  if (!uri) return null;
  return tints.has(uri) ? tints.get(uri) ?? null : found?.key === uri ? found.color : null;
}

/** A small round glass button (web: .glass-button). */
function GlassButton({ icon, label, onPress }: { icon: ComponentType<{ size?: number; color?: string }>; label: string; onPress: () => void }) {
  const Icon = icon;
  return <Press onPress={onPress} label={label} pressScale={0.92} style={{ width: 44, height: 44 }}>
    <Glass radius={22} alphas={[0.12, 0.12, 0.12]} border="rgba(255, 255, 255, 0.18)" rim={0.3} glow={false} shadow={false} blur={14} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={24} color={M.muted} />
    </Glass>
  </Press>;
}

/**
 * The full-screen player. The cover is centred with the song, singers and film under it; Up next, Lyrics and Related sit along the
 * bottom. Opening one lifts the player to the top and slides the list up from the bottom, the way YouTube Music does. The backdrop takes
 * its colour from the cover, and the glass panels float over it.
 */
export function NowPlaying() {
  const music = useMusic();
  const track = music.track;
  const tint = useDominantColor(track?.cover ? track.albumId : null) ?? DEFAULT_TINT;
  const rise = useRef(new Animated.Value(0)).current;
  const leaving = usePresencePhase() === 'exit';
  useSpringEnterExit(rise, 'smooth');
  if (!track) return null;
  return <Animated.View pointerEvents={leaving ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, { zIndex: 80, backgroundColor: '#07070b', opacity: opacityOf(rise), transform: [{ translateY: between(rise, RISE_FROM, 0) }] }]}>
    <OverlayProvider>
      <BlurLayer overlay={<><NowContent /><OverlayOutlet /></>}>
        <Backdrop albumId={track.albumId} hasCover={track.cover} tint={tint} />
      </BlurLayer>
    </OverlayProvider>
  </Animated.View>;
}

function Backdrop({ albumId, hasCover, tint }: { albumId: string; hasCover: boolean; tint: readonly [number, number, number] }) {
  const uri = useArt(hasCover ? `cover:${albumId}` : null, null);
  const { width, height } = useWindowDimensions();
  return <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundImage: `linear-gradient(165deg, rgba(${tint.join(', ')}, 0.95), #07070b 72%)` }]}>
    {uri ? <Image source={{ uri }} resizeMode="cover" style={{ position: 'absolute', left: -width * 0.25, top: -height * 0.25, width: width * 1.5, height: height * 1.5, opacity: 0.5, filter: [{ blur: 80 }, { saturate: 1.7 }] }} /> : null}
  </View>;
}

function NowContent() {
  const music = useMusic();
  const nav = useMusicNav();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [settings, setSettings] = useState(false);
  const track = music.track;
  const sheetOpen = music.sheet !== null;
  const swipe = useRef({ sheet: music.sheet });
  useEffect(() => { swipe.current = { sheet: music.sheet }; });
  const grab = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > SWIPE_TO_CLOSE) { if (swipe.current.sheet) music.setSheet(null); else music.setExpanded(false); }
    },
  })).current;
  const closeNow = useMemo(() => () => music.setExpanded(false), [music]);
  if (!track) return null;

  const wide = width >= 900;
  const narrow = width <= 480;
  const side = clamp(18, width * 0.05, 28);
  const art = narrow ? Math.min(width * 0.8, height * 0.4) : Math.min(width * 0.74, height * 0.44, 440);
  const gap = clamp(12, height * 0.024, 22);
  const sheetStage = sheetOpen;
  const titleSize = sheetStage ? 18 : clamp(22, width * 0.046, 30);
  const artists = track.artists.length === 0
    ? <Txt size={sheetStage ? 14 : 16} color="rgba(255, 255, 255, 0.78)" lines={1}>{t.unknownSinger}</Txt>
    : <Txt size={sheetStage ? 14 : 16} color="rgba(255, 255, 255, 0.78)" lines={1}>{track.artists.map((name, position) => <Txt key={name} size={sheetStage ? 14 : 16} color="rgba(255, 255, 255, 0.78)" onPress={() => { music.setExpanded(false); nav.go({ page: 'artist', key: keyOf(name) }); }}>{position > 0 ? ', ' : ''}{name}</Txt>)}</Txt>;
  const tabs = <Glass radius={999} style={{ marginTop: 8, marginHorizontal: 12, marginBottom: Math.max(12, insets.bottom + 10), padding: 6, alignSelf: 'center', width: Math.min(520, width - 24) }}>
    <SlidingTabs count={TABS.length} index={TABS.findIndex((tab) => tab.id === music.sheet)} gap={6} color="#fff" radius={999}>
      {TABS.map((tab) => {
        const on = music.sheet === tab.id;
        const count = music.queue.items.length - music.queue.index - 1;
        return <Press key={tab.id} onPress={() => music.setSheet(on ? null : tab.id)} label={tab.label} selected={on} role="tab"
          style={{ flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: narrow ? 5 : 6, paddingHorizontal: narrow ? 6 : 8, borderRadius: 999 }}>
          <tab.icon size={16} color={on ? '#1a0610' : 'rgba(255, 255, 255, 0.75)'} />
          <Txt size={narrow ? 13 : 14} weight={700} color={on ? '#1a0610' : 'rgba(255, 255, 255, 0.75)'} lines={1}>{tab.label}</Txt>
          {tab.id === 'queue' && count > 0 ? <View style={{ minWidth: narrow ? 18 : 20, paddingHorizontal: narrow ? 5 : 6, borderRadius: 99, backgroundColor: on ? '#1a0610' : M.ink }}><Txt size={narrow ? 10 : 11} weight={800} color={on ? '#fff' : M.accentInk}>{count}</Txt></View> : null}
        </Press>;
      })}
    </SlidingTabs>
  </Glass>;

  const meta = <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Txt size={titleSize} weight={800} ls={-0.02} lines={1} accessibilityRole="header">{track.title}</Txt>
      {artists}
      {!sheetStage ? <Txt size={14} color="rgba(255, 255, 255, 0.6)" lines={1}><Txt size={14} color="rgba(255, 255, 255, 0.6)" onPress={() => { music.setExpanded(false); nav.go({ page: 'album', id: track.albumId }); }}>{track.album}</Txt>{track.year ? ` · ${track.year}` : ''}</Txt> : null}
    </View>
    <LikeButton trackId={track.id} size={26} />
  </View>;

  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <View {...grab.panHandlers} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: insets.top + 10, paddingHorizontal: 14, paddingBottom: 6 }}>
      <GlassButton icon={ChevronDown} label={t.minimize} onPress={closeNow} />
      <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
        <Txt family="mono" weight={500} size={10} ls={0.14} upper color="rgba(255, 255, 255, 0.7)" lines={1}>{music.context?.kind === 'radio' ? t.radioPlaying : t.playingFromLabel}</Txt>
        <Txt size={14} weight={700} lines={1} style={{ marginTop: 4 }}>{music.context?.label ?? t.yourQueue}</Txt>
      </View>
      <MoreButton trackId={track.id} />
    </View>

    {sheetStage ? <>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: side, paddingTop: 2, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 56, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)', borderRadius: 10 }}><Cover albumId={track.albumId} cover={track.cover} label={track.album} radius={10} maxPx={240} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>{meta}</View>
        </View>
        <SeekBar />
        <Transport large sheet />
      </View>
      <View style={{ flex: 1, minHeight: 0, width: Math.min(760, width - 20), alignSelf: 'center', marginTop: 4 }}>
        <Glass radius={26} style={{ flex: 1 }}>
          <Press onPress={() => music.setSheet(null)} label={t.closeSheet} style={{ height: 22, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.4)' }} />
          </Press>
          {music.sheet === 'queue' ? <QueueSheet /> : music.sheet === 'lyrics' ? <LyricsSheet /> : <RelatedSheet />}
        </Glass>
      </View>
    </> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: Math.min(560, width), paddingHorizontal: side, alignItems: 'center', gap }}>
        <View style={{ width: art, borderRadius: 18, boxShadow: '0 30px 80px rgba(0, 0, 0, 0.6)' }}><Cover albumId={track.albumId} cover={track.cover} label={track.album} radius={18} /></View>
        {meta}
        <View style={{ width: '100%', paddingHorizontal: 2 }}><SeekBar /></View>
        <Transport large />
        <Glass radius={999} style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: wide ? 'center' : 'space-between', gap: wide ? 14 : 6, paddingVertical: narrow ? 4 : 6, paddingHorizontal: narrow ? 8 : 12 }}>
          <IconButton icon={Layers} label={t.addToPlaylist} onPress={() => nav.pickPlaylist([track.id])} color={M.ink} />
          <IconButton icon={Radio} label={t.startRadio} onPress={() => music.startRadio({ kind: 'track', value: track.id })} color={M.ink} />
          {wide ? <Volume /> : null}
          <IconButton icon={SlidersHorizontal} label={t.playbackSettings} on={Boolean(music.sleep.endsAt || music.sleep.endOfTrack || music.crossfade > 0)} color={M.ink} onPress={() => setSettings(true)} />
        </Glass>
      </View>
    </View>}
    {tabs}
    <Presence show={settings}><PlaybackMenu onClose={() => setSettings(false)} /></Presence>
    <Hidden>{formatContent(t.sheetOpened, { name: TABS.find((tab) => tab.id === music.sheet)?.label ?? '' })}</Hidden>
  </View>;
}

/** The "…" button of the full-screen player: opens the song menu over the player. */
function MoreButton({ trackId }: { trackId: string }) {
  const nav = useMusicNav();
  return <GlassButton icon={Ellipsis} label={t.more} onPress={() => nav.openMenu([trackId], null)} />;
}

/** Text only screen readers announce (web: .sr-only role=status). */
function Hidden({ children }: { children: ReactNode }) {
  return <View accessibilityLiveRegion="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}><Txt size={1}>{children}</Txt></View>;
}

