import { Check, Info, Play, Plus } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { content as copy } from '../../core/content';
import { canResume, episodeLabel, metaParts, nextToPlay } from '../../core/watchModel';
import type { ProgressEntry, WatchTitle } from '../../core/watchTypes';
import { clamp, WATCH_TABLET_MAX, watch as W } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { RoundButton, TitleArt, WatchButton } from './ui';

type BillboardProps = {
  title: WatchTitle;
  progress: readonly ProgressEntry[];
  inList: boolean;
  gutter: number;
  onPlay: (title: WatchTitle) => void;
  onInfo: (title: WatchTitle) => void;
  onToggleList: (title: WatchTitle) => void;
};

/** The large featured title at the top of Home: its picture, name, details and the Play / More info / My List actions. */
export function Billboard({ title, progress, inList, gutter, onPlay, onInfo, onToggleList }: BillboardProps) {
  const { width, height } = useWindowDimensions();
  const wide = width > WATCH_TABLET_MAX;
  const resuming = canResume(title, progress);
  const target = nextToPlay(title, progress);
  const meta = metaParts(title);
  const boardHeight = wide ? clamp(440, height * 0.8, 780) : clamp(420, height * 0.74, 640);
  const bottomPad = wide ? clamp(90, height * 0.14, 150) : 100;
  const parts = [...meta, ...title.languages.slice(0, 3)];
  return <View accessibilityLabel={title.title} style={{ height: boardHeight, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: W.raised }}>
    <TitleArt title={title} kind="backdrop" />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: 'linear-gradient(to right, rgba(3, 17, 10, 0.92) 0%, rgba(3, 17, 10, 0.55) 38%, rgba(3, 17, 10, 0) 70%), linear-gradient(to top, #03110a 2%, rgba(3, 17, 10, 0) 38%)' }]} />
    <View style={{ width: Math.min(640, width), paddingHorizontal: gutter, paddingBottom: bottomPad }}>
      <Txt size={clamp(34, width * 0.054, 74)} weight={800} lh={1} ls={-0.035} accessibilityRole="header" style={{ marginBottom: 10, textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 30 }}>{title.title}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4, marginBottom: 12 }}>
        {parts.map((part, position) => <View key={part} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {position > 0 ? <Txt size={14} weight={600} color={W.muted} style={{ marginHorizontal: 8, opacity: 0.7 }}>·</Txt> : null}
          <Txt size={14} weight={600} color={W.muted}>{part}</Txt>
        </View>)}
      </View>
      {title.overview ? <Txt size={clamp(14, width * 0.013, 18)} lh={1.5} lines={3} color={W.ink} style={{ marginBottom: 18 }}>{title.overview}</Txt> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <WatchButton primary icon={Play} fill label={`${resuming ? copy.watchView.resume : copy.watchView.play}${resuming && title.kind === 'series' && target.file.season !== null ? ` ${episodeLabel(target.file)}` : ''}`} onPress={() => onPlay(title)} />
        <WatchButton icon={Info} label={copy.watchView.moreInfo} onPress={() => onInfo(title)} />
        <RoundButton icon={inList ? Check : Plus} on={inList} label={inList ? copy.watchView.removeFromList : copy.watchView.addToList} onPress={() => onToggleList(title)} />
      </View>
    </View>
  </View>;
}
