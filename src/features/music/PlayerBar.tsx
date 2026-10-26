import { ChevronUp, ListMusic, Mic2, Pause, Play, SkipForward, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { content as copy } from '../../core/content';
import { artistLine, keyOf } from '../../core/musicModel';
import { Glass } from '../../design/Glass';
import { Presence } from '../../design/Presence';
import { Press, Spinner } from '../../design/primitives';
import { inkAlpha, music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useMusic, usePlaybackClock } from './musicContext';
import { useMusicNav } from './musicNav';
import { LikeButton, PlaybackMenu, SeekBar, Transport, Volume } from './PlayerParts';
import { Cover, IconButton } from './ui';

const t = copy.musicView;

/** The thin progress line along the bottom of the phone's mini player. */
function MiniProgress() {
  const { position, duration } = usePlaybackClock();
  return <View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, bottom: 4, height: 2, borderRadius: 2, backgroundColor: inkAlpha(0.18), overflow: 'hidden' }}>
    <View style={{ width: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%`, height: '100%', backgroundColor: M.ink }} />
  </View>;
}

/** The mini player: a rounded pill in the phone's dock with the song, play or pause, and next. Pressing the song opens the full-screen player. */
export function MiniPlayer() {
  const music = useMusic();
  const track = music.track;
  if (!track) return null;
  const open = (): void => music.setExpanded(true);
  return <View accessibilityRole="summary" accessibilityLabel={t.nowPlaying} style={{ flex: 1, minWidth: 0 }}>
    <Glass radius={28} style={{ height: 56, paddingLeft: 8, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <MiniProgress />
      <Press onPress={open} label={t.expandPlayer} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40 }}><Cover albumId={track.albumId} cover={track.cover} label={track.album} radius={8} maxPx={160} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Txt size={14} weight={700} lines={1}>{track.title}</Txt>
          <Txt size={12} color={M.muted} lines={1}>{artistLine(track) || track.album}</Txt>
        </View>
      </Press>
      <Press onPress={music.toggle} label={music.playing ? t.pause : t.play} pressScale={0.92} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        {music.buffering && music.playing ? <Spinner size={16} border={2} color={M.ink} /> : music.playing ? <Pause size={24} color={M.ink} fill={M.ink} /> : <Play size={24} color={M.ink} fill={M.ink} />}
      </Press>
      <IconButton icon={SkipForward} label={t.next} onPress={music.next} size={44} iconSize={22} color={M.ink} fill />
    </Glass>
  </View>;
}

/** The wide-screen player bar along the bottom: song, transport with progress, and tools. */
export function PlayerBar() {
  const music = useMusic();
  const nav = useMusicNav();
  const [settings, setSettings] = useState(false);
  const track = music.track;
  if (!track) return null;
  const open = (): void => music.setExpanded(true);
  return <Glass radius={22} blur={0} style={{ paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
    <View style={{ flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Press onPress={open} label={t.expandPlayer} style={{ width: 58, borderRadius: 8, overflow: 'hidden' }}><Cover albumId={track.albumId} cover={track.cover} label={track.album} radius={8} maxPx={160} /></Press>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Press onPress={() => nav.go({ page: 'album', id: track.albumId })} label={track.title}><Txt size={15} weight={700} lines={1}>{track.title}</Txt></Press>
        <Txt size={13} color={M.muted} lines={1}>{track.artists.length === 0 ? track.album : track.artists.map((name, position) => <Txt key={name} size={13} color={M.muted} onPress={() => nav.go({ page: 'artist', key: keyOf(name) })}>{position > 0 ? ', ' : ''}{name}</Txt>)}</Txt>
      </View>
      <LikeButton trackId={track.id} size={20} />
    </View>
    <View style={{ flex: 2, minWidth: 320, alignItems: 'center', gap: 4 }}><Transport /><SeekBar /></View>
    <View style={{ flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
      <IconButton icon={Mic2} label={t.lyrics} on={music.sheet === 'lyrics' && music.expanded} onPress={() => { music.setSheet('lyrics'); music.setExpanded(true); }} />
      <IconButton icon={ListMusic} label={t.upNext} onPress={() => { music.setSheet('queue'); music.setExpanded(true); }} />
      <IconButton icon={SlidersHorizontal} label={t.playbackSettings} on={Boolean(music.sleep.endsAt || music.sleep.endOfTrack || music.crossfade > 0)} onPress={() => setSettings(true)} />
      <Volume />
      <IconButton icon={ChevronUp} label={t.expandPlayer} onPress={open} iconSize={22} />
    </View>
    <Presence show={settings}><PlaybackMenu onClose={() => setSettings(false)} /></Presence>
  </Glass>;
}
