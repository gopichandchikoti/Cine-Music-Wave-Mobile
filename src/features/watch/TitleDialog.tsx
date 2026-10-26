import { Check, ChevronDown, Play, Plus, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Image, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { canResume, episodeLabel, episodesOf, formatClock, metaParts, nextToPlay, progressByFile, seasonsOf } from '../../core/watchModel';
import type { PlayTarget, ProgressEntry, WatchFile, WatchTitle } from '../../core/watchTypes';
import { useLibrary } from '../../data/LibraryProvider';
import { Grid } from '../../design/Grid';
import { Press } from '../../design/primitives';
import { clamp, WATCH_PHONE_MAX, WATCH_TABLET_MAX, watch as W } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import Wave from '../../../modules/wave-media';
import { useArt } from '../../platform/artwork';
import { glassLook, RoundButton, TitleArt, WatchButton } from './ui';

type TitleDialogProps = {
  title: WatchTitle;
  progress: readonly ProgressEntry[];
  inList: boolean;
  similar: readonly WatchTitle[];
  onClose: () => void;
  onPlay: (target: PlayTarget) => void;
  onToggleList: (title: WatchTitle) => void;
  onOpenTitle: (title: WatchTitle) => void;
};

/** A still from one episode (web: the episode thumbnail). */
function FileArt({ file, radius }: { file: WatchFile; radius: number }) {
  const library = useLibrary();
  const record = library.recordOf(file.id);
  const key = record && record.readAt > 0 ? `poster:${record.id}:480` : null;
  const make = useCallback(() => (record ? Wave.artwork(record.uri, 'video', key ?? record.id, 480) : Promise.resolve(null)), [record, key]);
  const uri = useArt(key, key ? make : null);
  return <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', backgroundImage: 'linear-gradient(135deg, #14572f, #072a19 70%)' }]}>
    {uri ? <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
  </View>;
}

function EpisodeRow({ title, file, entry, onPlay, phone }: { title: WatchTitle; file: WatchFile; entry: ProgressEntry | undefined; onPlay: (target: PlayTarget) => void; phone: boolean }) {
  const { width } = useWindowDimensions();
  const number = file.episode ?? 0;
  const name = file.title ?? formatContent(copy.watchView.episodeFallback, { episode: number });
  const fraction = entry && !entry.completed && entry.duration > 0 ? Math.min(1, entry.position / entry.duration) : 0;
  const startAt = entry && !entry.completed && entry.position > 10 ? entry.position : 0;
  const thumb = clamp(112, width * 0.17, 160);
  return <Press onPress={() => onPlay({ title, file, startAt })} label={`${name}`} pressedStyle={{ backgroundColor: W.surface }}
    style={{ flexDirection: 'row', alignItems: 'center', gap: phone ? 10 : 14, paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: W.line, borderRadius: 6 }}>
    <View style={{ width: phone ? 22 : 34, alignItems: 'center' }}><Txt size={20} color={W.muted}>{number || ''}</Txt></View>
    <View style={{ width: thumb, aspectRatio: 16 / 9, borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: W.surface }}>
      <FileArt file={file} radius={6} />
      <Play size={20} color={W.ink} fill={W.ink} />
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Txt size={15} weight={700} lines={1}>{name}</Txt>
      <Txt size={13} color={W.muted}>{[file.duration ? formatClock(file.duration) : null, entry?.completed ? copy.watchView.watched : null].filter(Boolean).join(' · ')}</Txt>
    </View>
    {fraction > 0 ? <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 4, backgroundColor: 'rgba(236, 253, 243, 0.25)' }}><View style={{ width: `${Math.round(fraction * 100)}%`, height: '100%', backgroundColor: W.accent }} /></View> : null}
  </Press>;
}

/** The title page: summary, how to start it, every episode, and what to watch next. */
export function TitleDialog({ title, progress, inList, similar, onClose, onPlay, onToggleList, onOpenTitle }: TitleDialogProps) {
  const { width, height } = useWindowDimensions();
  const phone = width <= WATCH_PHONE_MAX;
  const seasons = seasonsOf(title);
  const target = nextToPlay(title, progress);
  const resuming = canResume(title, progress);
  const byFile = progressByFile(progress);
  const [season, setSeason] = useState(() => target.file.season ?? seasons[0] ?? 1);
  const [choosing, setChoosing] = useState(false);
  const meta = metaParts(title);
  const main = target.file;
  const listed = useMemo(() => (title.kind === 'series' ? episodesOf(title).filter((file) => (file.season ?? 1) === season) : episodesOf(title)), [title, season]);
  const wideBody = width > WATCH_TABLET_MAX;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (choosing) setChoosing(false); else onClose(); return true; });
    return () => subscription.remove();
  }, [onClose, choosing]);

  const side = phone ? 16 : 28;
  const facts = <View style={{ gap: 10 }}>
    {title.languages.length > 0 ? <View><Txt size={13} color={W.muted} style={{ marginBottom: 2 }}>{copy.watchView.languagesLabel}</Txt><Txt size={13} lh={1.45}>{title.languages.join(', ')}</Txt></View> : null}
    {title.genres.length > 0 ? <View><Txt size={13} color={W.muted} style={{ marginBottom: 2 }}>{copy.watchView.genresLabel}</Txt><Txt size={13} lh={1.45}>{title.genres.join(', ')}</Txt></View> : null}
    {main.audio.length > 0 ? <View><Txt size={13} color={W.muted} style={{ marginBottom: 2 }}>{copy.watchView.audioLabel}</Txt><Txt size={13} lh={1.45}>{main.audio.map((track) => track.label).join(' · ')}</Txt></View> : null}
    {main.subtitles.length > 0 ? <View><Txt size={13} color={W.muted} style={{ marginBottom: 2 }}>{copy.watchView.subtitlesLabel}</Txt><Txt size={13} lh={1.45}>{main.subtitles.map((track) => track.label).join(' · ')}</Txt></View> : null}
    {title.kind === 'movie' ? <View><Txt size={13} color={W.muted} style={{ marginBottom: 2 }}>{copy.watchView.qualityLabel}</Txt><Txt size={13} lh={1.45}>{[main.quality, main.hdr ? 'HDR' : null, main.duration ? formatClock(main.duration) : null].filter(Boolean).join(' · ')}</Txt></View> : null}
  </View>;

  return <View style={[StyleSheet.absoluteFill, { zIndex: 70, backgroundColor: 'rgba(1, 10, 6, 0.8)' }]}>
    <Press onPress={onClose} label={copy.watchView.close} style={StyleSheet.absoluteFill} />
    <ScrollView contentContainerStyle={{ paddingVertical: height * 0.04, paddingHorizontal: 12, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 920, overflow: 'hidden', borderRadius: 12, backgroundColor: W.raised, boxShadow: `0 30px 90px rgba(0, 0, 0, 0.75), 0 0 0 1px ${W.line}` }}>
        <View style={{ width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', backgroundColor: W.surface }}>
          <TitleArt title={title} kind="backdrop" />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: 'linear-gradient(to top, #072216, rgba(7, 34, 22, 0) 62%)' }]} />
          <Press onPress={onClose} label={copy.watchView.close} style={{ position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3, 17, 10, 0.78)', zIndex: 3 }}><X size={20} color={W.ink} /></Press>
          <View style={{ position: 'absolute', left: phone ? 16 : 28, right: phone ? 16 : 28, bottom: phone ? 14 : 22 }}>
            <Txt size={clamp(26, width * 0.044, 48)} weight={800} lh={1.02} ls={-0.03} accessibilityRole="header" style={{ textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 22 }}>{title.title}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <WatchButton primary icon={Play} fill label={`${resuming ? copy.watchView.resume : copy.watchView.play}${resuming && title.kind === 'series' && main.season !== null ? ` ${episodeLabel(main)}` : ''}`} onPress={() => onPlay(target)} />
              <RoundButton icon={inList ? Check : Plus} on={inList} label={inList ? copy.watchView.removeFromList : copy.watchView.addToList} onPress={() => onToggleList(title)} />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: wideBody ? 'row' : 'column', gap: wideBody ? 28 : 16, paddingTop: 6, paddingHorizontal: side, paddingBottom: 24 }}>
          <View style={{ flex: wideBody ? 2 : undefined }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4, marginBottom: 12, marginTop: 12 }}>
              {meta.map((part, position) => <View key={part} style={{ flexDirection: 'row', alignItems: 'center' }}>
                {position > 0 ? <Txt size={14} weight={600} color={W.muted} style={{ marginHorizontal: 8, opacity: 0.7 }}>·</Txt> : null}
                <Txt size={14} weight={600} color={W.muted}>{part}</Txt>
              </View>)}
              {title.rating ? <View style={{ marginLeft: 8, paddingVertical: 1, paddingHorizontal: 7, borderWidth: 1, borderColor: W.muted, borderRadius: 4 }}><Txt size={12} color={W.muted}>{title.rating}</Txt></View> : null}
            </View>
            <Txt size={16} lh={1.6}>{title.overview || copy.watchView.noSummary}</Txt>
          </View>
          <View style={{ flex: wideBody ? 1 : undefined }}>{facts}</View>
        </View>

        {title.kind !== 'movie' ? <View style={{ paddingHorizontal: side, paddingBottom: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
            <Txt size={21} weight={700} accessibilityRole="header">{copy.watchView.episodes}</Txt>
            {title.kind === 'series' && seasons.length > 1 ? <Press onPress={() => setChoosing(true)} label={`${copy.watchView.episodes}: ${formatContent(copy.watchView.seasonLabel, { season })}`} hint="Opens a list"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: W.line, borderRadius: 6, backgroundColor: W.surface }}>
              <Txt size={14}>{formatContent(copy.watchView.seasonLabel, { season })}</Txt><ChevronDown size={14} color={W.ink} />
            </Press> : null}
          </View>
          <View>{listed.map((file) => <EpisodeRow key={file.id} title={title} file={file} entry={byFile.get(file.id)} onPlay={onPlay} phone={phone} />)}</View>
        </View> : null}

        {similar.length > 0 ? <View style={{ paddingHorizontal: side, paddingBottom: 26 }}>
          <Txt size={21} weight={700} accessibilityRole="header">{copy.watchView.moreLikeThis}</Txt>
          <Grid columns={phone ? 2 : 'auto'} minWidth={190} gap={10} style={{ marginTop: 12 }}>
            {similar.map((item) => <Press key={item.id} onPress={() => onOpenTitle(item)} label={item.title} style={[glassLook, { width: '100%', aspectRatio: 16 / 9, borderRadius: 6, overflow: 'hidden', backgroundColor: W.surface }]}>
              <TitleArt title={item} kind="card" />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: 'linear-gradient(to top, rgba(3, 17, 10, 0.88), rgba(3, 17, 10, 0) 58%)' }]} />
              <View style={{ position: 'absolute', left: 10, right: 10, bottom: 9 }}><Txt size={12} weight={700} lh={1.2} lines={2}>{item.title}</Txt></View>
            </Press>)}
          </Grid>
        </View> : null}
      </View>
    </ScrollView>
    <Modal transparent visible={choosing} animationType="fade" statusBarTranslucent onRequestClose={() => setChoosing(false)}>
      <Press onPress={() => setChoosing(false)} label={copy.watchView.close} style={{ flex: 1, backgroundColor: 'rgba(1, 10, 6, 0.6)', justifyContent: 'flex-end' }}>
        <View style={{ margin: 8, padding: 6, borderRadius: 18, borderWidth: 1, borderColor: W.line, backgroundColor: W.raised }}>
          {seasons.map((value) => <Press key={value} role="radio" checked={value === season} label={formatContent(copy.watchView.seasonLabel, { season: value })} onPress={() => { setSeason(value); setChoosing(false); }}
            style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 11, backgroundColor: value === season ? W.surface2 : 'transparent' }}>
            <Txt size={16} weight={value === season ? 700 : 400}>{formatContent(copy.watchView.seasonLabel, { season: value })}</Txt>
          </Press>)}
        </View>
      </Press>
    </Modal>
  </View>;
}
