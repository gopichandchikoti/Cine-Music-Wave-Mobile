import { Heart, Infinity as InfinityIcon, Moon, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy, formatContent } from '../../core/content';
import { formatTime } from '../../core/musicModel';
import { Glass } from '../../design/Glass';
import { Press, RangeSlider, Spinner } from '../../design/primitives';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { MAX_CROSSFADE_SECONDS } from '../../platform/musicEngine';
import { usePlaybackClock, useMusic } from './musicContext';
import { menuGlass, Scrim, SheetRise } from './Menus';
import { Chip, IconButton, MusicSwitch, Note } from './ui';

const t = copy.musicView;

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/** The progress slider with the elapsed and remaining time. Dragging only moves the handle; the song jumps when you let go. */
export function SeekBar({ compact = false, thumb = false }: { compact?: boolean; thumb?: boolean }) {
  const music = useMusic();
  const { position, duration } = usePlaybackClock();
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? position;
  const max = Math.max(duration, 1);
  return <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    {!compact ? <Txt size={12} color={M.muted} num style={{ minWidth: 38 }}>{formatTime(shown)}</Txt> : null}
    <RangeSlider style={{ flex: 1 }} label={t.seek} value={clamp(shown, 0, max)} max={max} step={1} fill={M.ink} track="rgba(255, 255, 255, 0.22)" thumb={thumb ? '#fff' : '#fff'} disabled={!music.track}
      onChange={setScrub} onCommit={(value) => { music.seek(value); setScrub(null); }} />
    {!compact ? <Txt size={12} color={M.muted} num align="right" style={{ minWidth: 38 }}>{formatTime(Math.max(0, duration - shown))}</Txt> : null}
  </View>;
}

/** The big round play/pause button. */
export function PlayButton({ size }: { size: number }) {
  const music = useMusic();
  const glyph = size >= 60 ? 34 : size >= 50 ? 28 : 26;
  return <Press onPress={music.toggle} disabled={!music.track} label={music.playing ? t.pause : t.play} pressScale={0.95}
    style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: M.ink, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)' }}>
    {music.buffering && music.playing ? <Spinner size={22} border={3} color={M.accentInk} track="rgba(26, 6, 16, 0.25)" /> : music.playing ? <Pause size={glyph} color={M.accentInk} fill={M.accentInk} /> : <Play size={glyph} color={M.accentInk} fill={M.accentInk} />}
  </Press>;
}

/** Shuffle, previous, play or pause, next and repeat. */
export function Transport({ large = false, sheet = false }: { large?: boolean; sheet?: boolean }) {
  const music = useMusic();
  const { width } = useWindowDimensions();
  const size = large ? 30 : 22;
  const repeatLabel = music.repeat === 'off' ? t.repeatOff : music.repeat === 'all' ? t.repeatAll : t.repeatOne;
  const buttonSize = large ? (sheet ? 40 : 48) : 38;
  const tint = (on: boolean): string => (on ? M.accent : M.ink);
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: large ? (sheet ? 6 : clamp(8, width * 0.03, 22)) : 8 }}>
    <IconButton icon={Shuffle} label={t.shuffle} onPress={music.toggleShuffle} on={music.shuffle} iconSize={size - 6} size={buttonSize} color={tint(music.shuffle)} />
    <IconButton icon={SkipBack} label={t.previous} onPress={music.previous} disabled={!music.track} iconSize={size} size={buttonSize} color={M.ink} fill />
    <PlayButton size={large ? (sheet ? 52 : 68) : 44} />
    <IconButton icon={SkipForward} label={t.next} onPress={music.next} disabled={!music.track} iconSize={size} size={buttonSize} color={M.ink} fill />
    <IconButton icon={music.repeat === 'one' ? Repeat1 : Repeat} label={repeatLabel} onPress={music.cycleRepeat} on={music.repeat !== 'off'} iconSize={size - 6} size={buttonSize} color={tint(music.repeat !== 'off')} />
  </View>;
}

export function LikeButton({ trackId, size = 22 }: { trackId: string; size?: number }) {
  const music = useMusic();
  const liked = music.likes.has(trackId);
  return <IconButton icon={Heart} label={liked ? t.unlike : t.like} onPress={() => music.toggleLike(trackId)} on={liked} fill={liked} iconSize={size} />;
}

export function Volume() {
  const music = useMusic();
  const level = music.muted ? 0 : music.volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <IconButton icon={Icon} label={music.muted || music.volume === 0 ? t.unmute : t.mute} onPress={music.toggleMute} />
    <RangeSlider style={{ width: 96 }} label={t.volume} value={level} max={1} step={0.02} fill={M.ink} track="rgba(255, 255, 255, 0.22)" onChange={music.setVolume} />
  </View>;
}

const SLEEP_CHOICES = [5, 10, 15, 30, 45, 60];
const RATES = [0.75, 1, 1.25, 1.5, 2];

/** Sleep timer, crossfade, autoplay and speed, in one panel. */
export function PlaybackMenu({ onClose }: { onClose: () => void }) {
  const music = useMusic();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  const remaining = music.sleep.endsAt ? Math.max(1, Math.round((music.sleep.endsAt - now) / 60_000)) : null;
  const heading = (icon: React.ReactNode, text: string): React.ReactNode => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>{icon}<Txt size={12} weight={700} ls={0.08} upper color={M.muted}>{text}</Txt></View>;
  return <Scrim onClose={onClose} light align="end">
    <SheetRise style={{ width: '100%', paddingHorizontal: 8, paddingBottom: 10 + insets.bottom, maxHeight: Math.min(height * 0.7, 560) + 10 }}>
      <Glass {...menuGlass} radius={20} style={{ maxHeight: Math.min(height * 0.7, 560) }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt size={16} weight={700} accessibilityRole="header">{t.playbackSettings}</Txt>
            <IconButton icon={X} label={t.close} onPress={onClose} iconSize={18} />
          </View>
          <View style={{ gap: 8 }}>
            {heading(<Moon size={14} color={M.muted} />, t.sleepTimer)}
            <Note>{music.sleep.endOfTrack ? t.sleepAtEndOfSong : remaining ? formatContent(t.sleepIn, { minutes: remaining }) : t.sleepOff}</Note>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SLEEP_CHOICES.map((minutes) => <Chip key={minutes} label={formatContent(t.minutes, { minutes })} onPress={() => music.setSleep(minutes)} />)}
              <Chip label={t.endOfSong} onPress={() => music.setSleep('track')} />
              {music.sleep.endsAt || music.sleep.endOfTrack ? <Chip label={t.turnOff} clear onPress={() => music.setSleep(null)} /> : null}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {heading(null, t.crossfade)}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <RangeSlider style={{ flex: 1 }} label={t.crossfade} value={music.crossfade} max={MAX_CROSSFADE_SECONDS} step={1} fill={M.ink} track="rgba(255, 255, 255, 0.22)" onChange={music.setCrossfade} />
              <Txt size={13} num align="right" style={{ minWidth: 42 }}>{music.crossfade === 0 ? t.off : formatContent(t.seconds, { seconds: music.crossfade })}</Txt>
            </View>
            <Note>{t.crossfadeHint}</Note>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              {heading(<InfinityIcon size={14} color={M.muted} />, t.autoplay)}
              <Note>{t.autoplayHint}</Note>
            </View>
            <MusicSwitch on={music.autoplay} onChange={music.setAutoplay} label={t.autoplay} />
          </View>
          <View style={{ gap: 8 }}>
            {heading(null, t.speed)}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {RATES.map((rate) => <Chip key={rate} label={`${rate}×`} on={music.rate === rate} onPress={() => music.setRate(rate)} />)}
            </View>
          </View>
        </ScrollView>
      </Glass>
    </SheetRise>
  </Scrim>;
}
