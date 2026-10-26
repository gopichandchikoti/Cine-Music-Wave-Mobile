import { Ellipsis, Heart, X } from 'lucide-react-native';
import { useRef, type ComponentRef } from 'react';
import { View, type ViewStyle } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { artistLine, formatTime } from '../../core/musicModel';
import type { MusicTrack } from '../../core/musicTypes';
import { Press } from '../../design/primitives';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useMusic } from './musicContext';
import { useMusicNav, type Anchor, type MenuSource } from './musicNav';
import { Cover, Equalizer, IconButton } from './ui';
import { DragHandle, type Sortable } from './useSortable';

const t = copy.musicView;

/** The "…" button: opens the song menu beside itself on wide screens and as a bottom sheet on phones. */
export function MenuButton({ trackIds, source, size = 38, iconSize = 20, label = t.more }: { trackIds: readonly string[]; source?: MenuSource; size?: number; iconSize?: number; label?: string }) {
  const nav = useMusicNav();
  const box = useRef<ComponentRef<typeof View>>(null);
  const open = (): void => {
    if (nav.compact || !box.current) { nav.openMenu(trackIds, null, source); return; }
    box.current.measureInWindow((x, y, width, height) => nav.openMenu(trackIds, { x, y, width, height } satisfies Anchor, source));
  };
  return <View ref={box} collapsable={false}><IconButton icon={Ellipsis} label={label} onPress={open} size={size} iconSize={iconSize} /></View>;
}

type TrackRowProps = {
  track: MusicTrack;
  /** The song's number in the list; shown instead of the cover when the list is an album. */
  number?: number;
  showAlbum?: boolean;
  showCover?: boolean;
  source?: MenuSource;
  onPlay: () => void;
  /** A visible "remove" button (used in the queue). */
  onRemove?: () => void;
  /** Drag handle, when the list can be re-ordered. */
  sortable?: Sortable;
  position?: number;
  /** Marks the song that is playing even when it appears more than once in the list. */
  current?: boolean;
  /** A song that has already played (dimmed in the queue). */
  past?: boolean;
  /** compact queue layout: no number column */
  queue?: boolean;
  style?: ViewStyle;
};

/** One song in a list: play it, like it, open its menu, and (in the queue and in playlists) drag it to a new place. */
export function TrackRow({ track, number, showAlbum = true, showCover = true, source, onPlay, onRemove, sortable, position = 0, current, past = false, queue = false, style }: TrackRowProps) {
  const music = useMusic();
  const nav = useMusicNav();
  const isCurrent = current ?? music.track?.id === track.id;
  const liked = music.likes.has(track.id);
  const dragging = sortable?.dragging === position;
  const compact = nav.compact;
  return <View
    onLayout={position === 0 && sortable ? (event) => sortable.measureRow(event.nativeEvent.layout.height) : undefined}
    style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 12 }, isCurrent ? { backgroundColor: M.surfaceHover } : null, past ? { opacity: 0.55 } : null, sortable?.rowStyle(position), dragging ? { zIndex: 5 } : null, style]}>
    <Press onPress={onPlay} label={formatContent(t.playSong, { title: track.title })} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: compact ? 8 : 10, padding: 4, borderRadius: 10 }}>
      {!queue ? <View style={{ width: compact ? 26 : 34, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        {isCurrent ? <Equalizer paused={!music.playing} /> : number !== undefined ? <Txt size={14} color={M.muted} num>{number}</Txt> : null}
      </View> : null}
      {showCover ? <View style={{ width: 46 }}><Cover albumId={track.albumId} cover={track.cover} label={track.album} radius={6} maxPx={160} /></View> : null}
      <View style={{ flex: compact ? 1 : 1.4, minWidth: 0, gap: 2 }}>
        <Txt size={15} weight={600} lines={1} color={isCurrent ? M.accent : M.ink}>{track.title}</Txt>
        <Txt size={13} color={M.muted} lines={1}>{artistLine(track) || track.album}</Txt>
      </View>
      {!compact && showAlbum ? <Txt size={13} color={M.muted} lines={1} style={{ flex: 1 }}>{track.album}{track.year ? ` · ${track.year}` : ''}</Txt> : null}
    </Press>
    {!compact ? <IconButton icon={Heart} label={liked ? t.unlike : t.like} onPress={() => music.toggleLike(track.id)} on={liked} fill={liked} iconSize={18} /> : null}
    {!compact ? <Txt size={13} color={M.muted} num align="right" style={{ minWidth: 40 }}>{formatTime(track.duration)}</Txt> : null}
    {onRemove ? <IconButton icon={X} label={t.removeFromQueue} onPress={onRemove} iconSize={18} /> : null}
    <MenuButton trackIds={[track.id]} source={source} label={formatContent(t.moreFor, { title: track.title })} />
    {sortable ? <DragHandle index={position} sortable={sortable} label={t.reorder} /> : null}
  </View>;
}

