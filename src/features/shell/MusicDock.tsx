import { Pause, Play, SkipForward } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content as copy } from '../../core/content';
import { artistLine } from '../../core/musicModel';
import { Glass } from '../../design/Glass';
import { Press } from '../../design/primitives';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useMusic } from '../music/musicContext';
import { Cover, IconButton } from '../music/ui';

const t = copy.musicView;

/**
 * A small glass pill shown over Watch while music is queued, so music you started keeps playing and can be paused or skipped without
 * going back. Pressing it opens the Music screen.
 */
export function MusicDock({ onOpen }: { onOpen: () => void }) {
  const music = useMusic();
  const insets = useSafeAreaInsets();
  const track = music.track;
  if (!track) return null;
  return <View accessibilityRole="summary" accessibilityLabel={t.nowPlaying} style={{ position: 'absolute', right: 14, bottom: 14 + insets.bottom, maxWidth: 340, zIndex: 70 }}>
    <Glass radius={999} blur={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingLeft: 6, paddingRight: 8 }}>
      <Press onPress={onOpen} label={t.openMusic} style={{ flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 }}>
        <View style={{ width: 40 }}><Cover albumId={track.albumId} cover={track.cover} label={track.album} radius={20} maxPx={160} /></View>
        <View style={{ flexShrink: 1, minWidth: 0, maxWidth: 150 }}>
          <Txt size={13} weight={700} lines={1}>{track.title}</Txt>
          <Txt size={11} color={M.muted} lines={1}>{artistLine(track) || track.album}</Txt>
        </View>
      </Press>
      <IconButton icon={music.playing ? Pause : Play} label={music.playing ? t.pause : t.play} onPress={music.toggle} iconSize={22} color={M.ink} fill />
      <IconButton icon={SkipForward} label={t.next} onPress={music.next} iconSize={20} color={M.ink} fill />
    </Glass>
  </View>;
}
