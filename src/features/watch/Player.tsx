import { useEvent } from 'expo';
import { VideoView, useVideoPlayer, type AudioTrack, type SubtitleTrack } from 'expo-video';
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { setStatusBarHidden } from 'expo-status-bar';
import { AudioLines, Captions, ChevronLeft, CircleAlert, Crop, Gauge, Maximize, Minimize, Pause, Play, RotateCcw, SkipBack, SkipForward, StepForward, Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Animated, BackHandler, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy, formatContent } from '../../core/content';
import { isPictureId, layoutPicture, PICTURE_PRESETS, type FrameRect, type PictureId, type Size } from '../../core/picture';
import { episodeAfter, episodeLabel, formatClock, isCompleted } from '../../core/watchModel';
import type { ProgressEntry, WatchFile, WatchTitle } from '../../core/watchTypes';
import { useLibrary } from '../../data/LibraryProvider';
import { Glass } from '../../design/Glass';
import { Press, RangeSlider, Spinner } from '../../design/primitives';
import { clamp, WATCH_PHONE_MAX, watchDarkPalette as W } from '../../design/tokens';
import { DarkTxt as Txt } from '../../design/Txt';
import Wave from '../../../modules/wave-media';
import { glassLook, WatchButton } from './ui';

type PlayerProps = {
  title: WatchTitle;
  file: WatchFile;
  startAt: number;
  onClose: () => void;
  onPlayFile: (file: WatchFile) => void;
  onProgress: (entry: ProgressEntry) => void;
};

type Menu = 'audio' | 'subtitles' | 'speed' | 'picture' | null;
type Icon = ComponentType<{ size?: number; color?: string; fill?: string }>;

const RATES = [0.75, 1, 1.25, 1.5, 2];
const SAVE_EVERY_MS = 10_000;
const HIDE_CONTROLS_MS = 3200;
const HUD_MS = 1700;

const PICTURE_COPY: Record<PictureId, { label: string; hint: string }> = {
  auto: { label: copy.watchView.pictureAuto, hint: copy.watchView.pictureAutoHint },
  frame: { label: copy.watchView.pictureFrame, hint: copy.watchView.pictureFrameHint },
  fill: { label: copy.watchView.pictureFill, hint: copy.watchView.pictureFillHint },
  'crop-1.33': { label: copy.watchView.picture43, hint: copy.watchView.picture43Hint },
  'crop-1.43': { label: copy.watchView.picture143, hint: copy.watchView.picture143Hint },
  'crop-1.78': { label: copy.watchView.picture169, hint: copy.watchView.picture169Hint },
  'crop-1.85': { label: copy.watchView.picture185, hint: copy.watchView.picture185Hint },
  'crop-1.9': { label: copy.watchView.picture190, hint: copy.watchView.picture190Hint },
  'crop-2.39': { label: copy.watchView.picture239, hint: copy.watchView.picture239Hint },
};

/** A round glass button on the player (web: .watch-player-button). */
function PlayerButton({ icon: IconComponent, label, onPress, on, disabled, fill }: { icon: Icon; label: string; onPress: () => void; on?: boolean; disabled?: boolean; fill?: boolean }) {
  const tint = on ? W.accent : '#fff';
  return <Press onPress={onPress} label={label} disabled={disabled} expanded={undefined} pressScale={0.94} style={[glassLook(true), { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }]}>
    <IconComponent size={22} color={tint} fill={fill ? tint : 'none'} />
  </Press>;
}

const glassTint = [190, 255, 220] as const;

/** The panel the audio, subtitle, picture and speed buttons open above the control bar. */
function MenuPanel({ children, wide, title }: { children: ReactNode; wide?: boolean; title: string }) {
  const { height } = useWindowDimensions();
  return <View accessibilityViewIsModal accessibilityLabel={title} style={{ position: 'absolute', right: 14, bottom: '100%', marginBottom: 10, minWidth: wide ? 300 : 190, maxWidth: '92%', maxHeight: Math.min(height * 0.5, height - 200) }}>
    <View style={{ padding: 6, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(190, 255, 220, 0.22)', backgroundColor: 'rgba(4, 24, 14, 0.95)', backgroundImage: 'linear-gradient(140deg, rgba(190, 255, 220, 0.16), rgba(190, 255, 220, 0.04) 60%, rgba(190, 255, 220, 0.08))', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 18px 50px rgba(0, 0, 0, 0.6)' }}>
      <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </View>
  </View>;
}

function MenuItem({ label, hint, checked, onPress }: { label: string; hint?: string; checked: boolean; onPress: () => void }) {
  return <Press role="radio" checked={checked} label={hint ? `${label}. ${hint}` : label} onPress={onPress} pressedStyle={{ backgroundColor: W.surface2 }}
    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 11 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: checked ? W.accent : 'transparent' }} />
    <Txt size={14} weight={checked ? 700 : 400}>{label}</Txt>
    {hint ? <Txt size={12} color={W.muted} style={{ marginLeft: 'auto', paddingLeft: 16 }}>{hint}</Txt> : null}
  </Press>;
}

export function Player({ title, file, startAt, onClose, onPlayFile, onProgress }: PlayerProps) {
  const library = useLibrary();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const phone = width <= WATCH_PHONE_MAX;
  const record = library.recordOf(file.id);
  const repo = library.repo;
  const next = episodeAfter(title, file);
  const duration = file.duration ?? record?.duration ?? 0;
  const natural = useMemo<Size | null>(() => (record && record.width > 0 && record.height > 0 ? { width: record.width, height: record.height } : null), [record]);

  const player = useVideoPlayer(record ? { uri: record.uri } : null, (instance) => {
    instance.timeUpdateEventInterval = 0.5;
    instance.keepScreenOnWhilePlaying = true;
    instance.loop = false;
  });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: undefined });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { audioTrack } = useEvent(player, 'audioTrackChange', { audioTrack: player.audioTrack });
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', { subtitleTrack: player.subtitleTrack });

  const [position, setPosition] = useState(startAt);
  const [buffered, setBuffered] = useState(0);
  const [length, setLength] = useState(duration);
  const [scrub, setScrub] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [menu, setMenu] = useState<Menu>(null);
  const [awake, setAwake] = useState(true);
  const [activity, setActivity] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [picture, setPicture] = useState<PictureId>('auto');
  const [content, setContent] = useState<FrameRect | null>(record?.tags?.contentRect ?? null);
  const [hud, setHud] = useState<{ text: string; id: number } | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [failed, setFailed] = useState(false);
  const positionRef = useRef(startAt);
  const lastSaved = useRef(-1);
  const hudCount = useRef(0);
  const started = useRef(false);

  const ready = status === 'readyToPlay';
  const waiting = !failed && (status === 'loading' || (status === 'idle' && !started.current));
  const shown = scrub ?? position;
  const idle = isPlaying && menu === null && !awake;
  const isAudioOnly = title.kind === 'album';

  const showHud = (text: string): void => { hudCount.current += 1; setHud({ text, id: hudCount.current }); };
  const wake = useCallback((): void => { setAwake(true); setActivity((value) => value + 1); }, []);

  // --- saved preferences -------------------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!repo) return;
    void repo.value('watch-picture').then((value) => { if (isPictureId(value)) setPicture(value); });
    void repo.value('watch-volume').then((value) => { const level = Number(value); if (value !== null && Number.isFinite(level) && level >= 0 && level <= 1) setVolume(level); });
  }, [repo]);

  // --- the picture inside baked-in black bars -----------------------------------------------------------------------------------------
  useEffect(() => {
    if (!record || isAudioOnly || record.tags?.contentRect !== undefined) return;
    let cancelled = false;
    void Wave.contentRect(record.uri).then((rect) => {
      if (cancelled) return;
      setContent(rect);
      if (repo) void repo.setContentRect(record.id, { ...record.tags, contentRect: rect });
    }, () => undefined);
    return () => { cancelled = true; };
  }, [record, repo, isAudioOnly]);

  // --- source loaded: resume, tracks ----------------------------------------------------------------------------------------------------
  useEffect(() => {
    const load = player.addListener('sourceLoad', (payload) => {
      setLength(payload.duration > 0 ? payload.duration : duration);
      setAudioTracks(payload.availableAudioTracks);
      setSubtitleTracks(payload.availableSubtitleTracks);
      if (!started.current) {
        started.current = true;
        if (startAt > 0) player.currentTime = startAt;
        player.play();
      }
    });
    const time = player.addListener('timeUpdate', (payload) => {
      positionRef.current = payload.currentTime;
      setPosition(payload.currentTime);
      setBuffered(payload.bufferedPosition);
    });
    const end = player.addListener('playToEnd', () => {
      positionRef.current = player.duration || length;
      lastSaved.current = -1;
      persist();
      if (next) onPlayFile(next);
    });
    const tracks = player.addListener('availableAudioTracksChange', (payload) => setAudioTracks(payload.availableAudioTracks));
    const subs = player.addListener('availableSubtitleTracksChange', (payload) => setSubtitleTracks(payload.availableSubtitleTracks));
    return () => { load.remove(); time.remove(); end.remove(); tracks.remove(); subs.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, next, startAt]);

  useEffect(() => { if (status === 'error') setFailed(true); }, [status]);

  // --- keeping the user's place ---------------------------------------------------------------------------------------------------------
  const persist = useCallback((): void => {
    const total = player.duration > 0 ? player.duration : length;
    const at = Math.floor(positionRef.current);
    if (total <= 0 || at < 5 || at === lastSaved.current) return;
    lastSaved.current = at;
    onProgress({ fileId: file.id, titleId: title.id, position: at, duration: total, completed: isCompleted(at, total), updatedAt: new Date().toISOString() });
  }, [player, length, onProgress, file.id, title.id]);
  const persistLatest = useRef(persist);
  useEffect(() => { persistLatest.current = persist; });
  useEffect(() => {
    const timer = setInterval(() => { if (player.playing) persistLatest.current(); }, SAVE_EVERY_MS);
    return () => { clearInterval(timer); persistLatest.current(); };
  }, [player]);
  useEffect(() => { if (!isPlaying) persistLatest.current(); }, [isPlaying]);

  // --- controls fade away while playing ---------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying || menu !== null) return;
    const timer = setTimeout(() => setAwake(false), HIDE_CONTROLS_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, menu, activity]);
  useEffect(() => { if (!hud) return; const timer = setTimeout(() => setHud(null), HUD_MS); return () => clearTimeout(timer); }, [hud]);

  // --- fullscreen: landscape and no system bars --------------------------------------------------------------------------------------------
  const enterFullscreen = useCallback(async (): Promise<void> => {
    setFullscreen(true);
    setStatusBarHidden(true, 'fade');
    await NavigationBar.setVisibilityAsync('hidden').catch(() => undefined);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
  }, []);
  const leaveFullscreen = useCallback(async (): Promise<void> => {
    setFullscreen(false);
    setStatusBarHidden(false, 'fade');
    await NavigationBar.setVisibilityAsync('visible').catch(() => undefined);
    await ScreenOrientation.unlockAsync().catch(() => undefined);
  }, []);
  useEffect(() => () => {
    setStatusBarHidden(false, 'fade');
    void NavigationBar.setVisibilityAsync('visible').catch(() => undefined);
    void ScreenOrientation.unlockAsync().catch(() => undefined);
  }, []);

  // --- actions ---------------------------------------------------------------------------------------------------------------------------------
  const togglePlay = (): void => { if (player.playing) player.pause(); else player.play(); };
  const seekTo = (seconds: number): void => {
    const total = player.duration > 0 ? player.duration : length;
    const time = clamp(seconds, 0, Math.max(0, total - 0.5));
    positionRef.current = time;
    setPosition(time);
    player.currentTime = time;
  };
  const skip = (seconds: number): void => seekTo(positionRef.current + seconds);
  const closeMenu = (): void => setMenu(null);
  const toggleMenu = (name: Exclude<Menu, null>): void => setMenu(menu === name ? null : name);
  const labelFor = (index: number, fallback: string): string => file.audio.length === audioTracks.length ? file.audio[index]?.label ?? fallback : fallback;
  const chooseAudio = (index: number): void => {
    const track = audioTracks[index];
    if (!track) return;
    player.audioTrack = track;
    closeMenu();
    showHud(formatContent(copy.watchView.audioChanged, { track: labelFor(index, track.label) }));
    if (repo && track.language) void repo.setValue('watch-audio-language', track.language);
  };
  const chooseSubtitle = (track: SubtitleTrack | null): void => {
    player.subtitleTrack = track;
    closeMenu();
    if (repo) void repo.setValue('watch-subtitle-language', track === null ? 'off' : track.language);
  };
  const choosePicture = (id: PictureId): void => {
    setPicture(id);
    closeMenu();
    showHud(formatContent(copy.watchView.pictureChanged, { mode: PICTURE_COPY[id].label }));
    if (repo) void repo.setValue('watch-picture', id);
  };
  const changeVolume = (value: number): void => {
    const level = clamp(value, 0, 1);
    setVolume(level);
    setMuted(level === 0);
    player.volume = level;
    player.muted = level === 0;
    if (repo) void repo.setValue('watch-volume', String(level));
  };
  const toggleMute = (): void => { const value = !muted; setMuted(value); player.muted = value; };
  const chooseRate = (value: number): void => { setRate(value); player.playbackRate = value; closeMenu(); };
  const retry = (): void => { setFailed(false); started.current = false; if (record) void player.replaceAsync({ uri: record.uri }); };
  const close = (): void => { persistLatest.current(); void leaveFullscreen(); onClose(); };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (menu !== null) setMenu(null); else if (fullscreen) void leaveFullscreen(); else close(); return true; });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, fullscreen]);

  // --- layout of the picture on screen --------------------------------------------------------------------------------------------------------
  const layout = !isAudioOnly && natural ? layoutPicture(picture, { width, height }, natural, content) : null;
  const heading = title.kind === 'movie' ? title.title : `${title.title}${episodeLabel(file) ? ` · ${episodeLabel(file)}` : ''}${file.title ? ` · ${file.title}` : ''}`;
  const busy = waiting || (ready && !isPlaying && !started.current);
  const activeAudio = audioTracks.findIndex((track) => track.id === audioTrack?.id && track.label === audioTrack?.label);
  const bottom = Math.max(clamp(10, width * 0.02, 22), insets.bottom);
  const edge = clamp(10, width * 0.022, 28);

  return <View accessibilityViewIsModal accessibilityLabel={`${copy.watchView.playerLabel}: ${heading}`} style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: '#010a05', overflow: 'hidden' }]}>
    <Press label={isPlaying ? copy.watchView.pause : copy.watchView.play} onPress={() => { if (!awake) wake(); else { togglePlay(); wake(); } }} style={StyleSheet.absoluteFill}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {layout ? (layout.trim
          ? <View style={{ position: 'absolute', left: layout.left + layout.trim.left, top: layout.top + layout.trim.top, width: layout.width - layout.trim.left - layout.trim.right, height: layout.height - layout.trim.top - layout.trim.bottom, overflow: 'hidden' }}>
            <VideoView player={player} nativeControls={false} contentFit="fill" surfaceType="textureView" style={{ position: 'absolute', left: -layout.trim.left, top: -layout.trim.top, width: layout.width, height: layout.height }} />
          </View>
          : <VideoView player={player} nativeControls={false} contentFit="fill" style={{ position: 'absolute', left: layout.left, top: layout.top, width: layout.width, height: layout.height }} />)
          : <VideoView player={player} nativeControls={false} contentFit="contain" style={StyleSheet.absoluteFill} />}
      </View>
    </Press>

    {hud ? <View key={hud.id} pointerEvents="none" style={{ position: 'absolute', top: 88 + insets.top, alignSelf: 'center', maxWidth: width - 32, zIndex: 6 }}>
      <Glass dark tint={glassTint} base="rgba(3, 20, 12, 0.46)" border="rgba(190, 255, 220, 0.24)" radius={999} blur={0} style={{ paddingVertical: 9, paddingHorizontal: 18 }}><Txt size={15} weight={700} align="center">{hud.text}</Txt></Glass>
    </View> : null}

    <Animated.View pointerEvents={idle ? 'none' : 'box-none'} style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: idle ? 0 : 1, zIndex: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 16 + insets.top, paddingHorizontal: 22, paddingBottom: 46, backgroundImage: 'linear-gradient(to bottom, rgba(1, 10, 5, 0.85), rgba(1, 10, 5, 0))' }}>
        <Press onPress={close} label={copy.watchView.backToLibrary} pressScale={0.94} style={[glassLook(true), { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(190, 255, 220, 0.12)' }]}><ChevronLeft size={24} color={W.ink} /></Press>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt family="mono" weight={500} size={10} ls={0.14} upper color={W.muted}>{copy.watchView.nowPlaying}</Txt>
          <Txt size={clamp(15, width * 0.016, 20)} weight={700} lines={1} style={{ marginTop: 4 }}>{heading}</Txt>
        </View>
      </View>
    </Animated.View>

    {busy && !failed ? <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center', gap: 12, marginTop: -40, zIndex: 2 }}>
      <Spinner size={38} border={3} color={W.accent} track="rgba(236, 253, 243, 0.25)" />
      <Txt size={15} color={W.ink} style={{ textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowRadius: 10 }}>{waiting ? copy.watchView.preparingVideo : copy.watchView.buffering}</Txt>
    </View> : null}

    {failed || !record ? <View accessibilityRole="alert" style={{ position: 'absolute', top: '50%', alignSelf: 'center', width: Math.min(440, width - 32), marginTop: -110, alignItems: 'center', gap: 10, padding: 26, borderRadius: 12, backgroundColor: W.raised, boxShadow: `0 24px 70px rgba(0, 0, 0, 0.7), 0 0 0 1px ${W.line}`, zIndex: 4 }}>
      <CircleAlert size={30} color={W.ink} />
      <Txt size={16} weight={700}>{record ? copy.watchView.playbackFailed : 'This file is no longer available.'}</Txt>
      <Txt size={14} lh={1.5} color={W.muted} align="center" style={{ marginBottom: 6 }}>{error?.message && record ? `${copy.watchView.playbackFailedHelp} (${error.message})` : record ? copy.watchView.playbackFailedHelp : 'It was moved, removed, or Android no longer lets this app see it. Other titles are not affected.'}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        {record ? <WatchButton dark primary icon={RotateCcw} label={copy.watchView.tryAgain} onPress={retry} /> : null}
        <WatchButton dark label={copy.watchView.backToLibrary} onPress={close} />
      </View>
    </View> : null}

    <Animated.View pointerEvents={idle ? 'none' : 'box-none'} style={{ position: 'absolute', left: edge, right: edge, bottom, opacity: idle ? 0 : 1, zIndex: 3 }}>
      <Glass dark tint={glassTint} alphas={[0.17, 0.04, 0.09]} base="rgba(3, 20, 12, 0.46)" border="rgba(190, 255, 220, 0.24)" radius={phone ? 22 : 28} blur={0} style={{ paddingTop: phone ? 10 : 12, paddingHorizontal: phone ? 12 : 22, paddingBottom: phone ? 6 : 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Txt family="mono" weight={500} size={12} num style={{ minWidth: 42 }}>{formatClock(shown)}</Txt>
          <RangeSlider style={{ flex: 1 }} label={copy.watchView.seekMedia} value={clamp(shown, 0, Math.max(length, 1))} max={Math.max(length, 1)} step={1} fill={W.accent} track="rgba(236, 253, 243, 0.2)" thumb={W.accent} thumbSize={14}
            buffered={buffered} bufferedColor="rgba(236, 253, 243, 0.35)" disabled={!ready} onChange={(value) => { setScrub(value); wake(); }} onCommit={(value) => { seekTo(value); setScrub(null); }} />
          <Txt family="mono" weight={500} size={12} num align="right" style={{ minWidth: 52 }}>{formatClock(Math.max(0, length - shown))}</Txt>
        </View>
        <View style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', justifyContent: 'space-between', gap: phone ? 8 : 16, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: phone ? 'space-between' : 'flex-start', gap: 4 }}>
            <PlayerButton icon={isPlaying ? Pause : Play} fill label={isPlaying ? copy.watchView.pause : copy.watchView.play} onPress={() => { togglePlay(); wake(); }} />
            <PlayerButton icon={SkipBack} label={copy.watchView.back10Seconds} onPress={() => { skip(-10); wake(); }} />
            <PlayerButton icon={SkipForward} label={copy.watchView.forward10Seconds} onPress={() => { skip(10); wake(); }} />
            <PlayerButton icon={muted || volume === 0 ? VolumeX : Volume2} label={muted || volume === 0 ? copy.watchView.unmute : copy.watchView.mute} onPress={() => { toggleMute(); wake(); }} />
            {!phone ? <RangeSlider style={{ width: 84 }} label={copy.watchView.volume} value={muted ? 0 : volume} max={1} step={0.05} fill="rgba(236, 253, 243, 0.3)" track="rgba(236, 253, 243, 0.3)" thumb={W.accent} thumbSize={14} onChange={changeVolume} /> : null}
          </View>
          {!phone ? <Txt size={14} weight={600} color={W.muted} lines={1} style={{ flex: 1, textAlign: 'center' }}>{heading}</Txt> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: phone ? 'space-between' : 'flex-end', gap: 4 }}>
            {next ? <PlayerButton icon={StepForward} label={copy.watchView.nextEpisode} onPress={() => onPlayFile(next)} /> : null}
            {audioTracks.length > 0 ? <PlayerButton icon={AudioLines} label={copy.watchView.audioTracks} on={menu === 'audio'} onPress={() => { toggleMenu('audio'); wake(); }} /> : null}
            {subtitleTracks.length > 0 ? <PlayerButton icon={Captions} label={copy.watchView.subtitles} on={subtitleTrack !== null || menu === 'subtitles'} onPress={() => { toggleMenu('subtitles'); wake(); }} /> : null}
            {!isAudioOnly ? <PlayerButton icon={Crop} label={copy.watchView.pictureMenu} on={picture !== 'auto' || menu === 'picture'} onPress={() => { toggleMenu('picture'); wake(); }} /> : null}
            <PlayerButton icon={Gauge} label={copy.watchView.playbackSpeed} on={rate !== 1 || menu === 'speed'} onPress={() => { toggleMenu('speed'); wake(); }} />
            <PlayerButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? copy.watchView.exitFullscreen : copy.watchView.fullscreen} onPress={() => { if (fullscreen) void leaveFullscreen(); else void enterFullscreen(); wake(); }} />
          </View>
        </View>
      </Glass>
      {menu === 'audio' ? <MenuPanel title={copy.watchView.audioTracks} wide>
        <Txt family="mono" weight={500} size={10} ls={0.14} upper color={W.muted} style={{ marginTop: 6, marginBottom: 4, paddingHorizontal: 12 }}>{copy.watchView.audioLanguage}</Txt>
        {audioTracks.length > 1
          ? audioTracks.map((track, index) => <MenuItem key={`${track.id ?? index}`} checked={index === Math.max(0, activeAudio)} label={labelFor(index, track.label)} hint={index === 0 ? copy.watchView.audioDefaultTag : undefined} onPress={() => chooseAudio(index)} />)
          : <Txt size={13} lh={1.5} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>{labelFor(0, audioTracks[0]?.label ?? '')}</Txt>}
      </MenuPanel> : null}
      {menu === 'subtitles' ? <MenuPanel title={copy.watchView.subtitles}>
        <MenuItem checked={subtitleTrack === null} label={copy.watchView.subtitlesOff} onPress={() => chooseSubtitle(null)} />
        {subtitleTracks.map((track, index) => <MenuItem key={`${track.id ?? index}`} checked={subtitleTrack?.id === track.id && subtitleTrack?.label === track.label} label={track.label || track.language || `${copy.watchView.subtitles} ${index + 1}`} onPress={() => chooseSubtitle(track)} />)}
      </MenuPanel> : null}
      {menu === 'picture' ? <MenuPanel title={copy.watchView.pictureMenu} wide>
        {PICTURE_PRESETS.map((preset) => <MenuItem key={preset.id} checked={picture === preset.id} label={PICTURE_COPY[preset.id].label} hint={PICTURE_COPY[preset.id].hint} onPress={() => choosePicture(preset.id)} />)}
      </MenuPanel> : null}
      {menu === 'speed' ? <MenuPanel title={copy.watchView.playbackSpeed}>
        {RATES.map((value) => <MenuItem key={value} checked={value === rate} label={`${value}×`} onPress={() => chooseRate(value)} />)}
      </MenuPanel> : null}
    </Animated.View>
  </View>;
}

