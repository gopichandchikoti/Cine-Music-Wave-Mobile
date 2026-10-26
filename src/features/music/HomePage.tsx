import { Brain, Car, Dumbbell, Waves, Zap } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { content as copy, formatContent } from '../../core/content';
import { MOOD_LABEL } from '../../core/moodLabels';
import { buildShelves, MOODS, type MoodId, type Shelf as ShelfData } from '../../core/musicModel';
import { Grid } from '../../design/Grid';
import { AccessNotice, AccessPanel } from '../shell/AccessPanel';
import { AlbumCard, ArtistCard, MixCard, RadioCard, Shelf, SpeedDialTile, TrackColumns } from './Cards';
import { useMusic } from './musicContext';
import { useMusicNav } from './musicNav';
import { Page, PageTitle, SectionHead } from './pageui';
import { Chip, Note } from './ui';

const t = copy.musicView;

const MOOD_ICON = { energise: Zap, relax: Waves, workout: Dumbbell, commute: Car, focus: Brain } as const;

const greeting = (hour: number): string => (hour < 5 ? t.greetingNight : hour < 12 ? t.greetingMorning : hour < 18 ? t.greetingAfternoon : t.greetingEvening);

function ShelfView({ shelf }: { shelf: ShelfData }) {
  const music = useMusic();
  const nav = useMusicNav();
  if (shelf.type === 'tiles' && shelf.id === 'speed-dial') {
    return <View style={{ gap: 12 }}>
      <SectionHead title={shelf.title} small={shelf.subtitle} />
      <Grid columns={nav.compact ? 2 : 3} gap={nav.compact ? 8 : 10}>
        {shelf.tiles.map((tile, position) => <SpeedDialTile key={`${tile.kind}:${position}`} tile={tile} />)}
      </Grid>
    </View>;
  }
  if (shelf.type === 'tiles') {
    return <Shelf title={shelf.title} subtitle={shelf.subtitle}>
      {shelf.tiles.flatMap((tile, position) => (tile.kind === 'radio'
        ? [<RadioCard key={`${tile.radio.id}:${position}`} id={tile.radio.id} label={tile.radio.label} seedKind={tile.radio.seedKind} seedValue={tile.radio.seedValue} onRemove={tile.radio.id.startsWith('suggested:') ? undefined : () => { void music.deleteRadio(tile.radio.id); }} />]
        : []))}
    </Shelf>;
  }
  if (shelf.type === 'tracks') return <Shelf title={shelf.title} subtitle={shelf.subtitle} columns><TrackColumns trackIds={shelf.trackIds} context={{ kind: 'mix', id: shelf.id, label: shelf.title }} /></Shelf>;
  if (shelf.type === 'albums') return <Shelf title={shelf.title} subtitle={shelf.subtitle}>{shelf.albumIds.flatMap((id) => { const album = music.index.albumById.get(id); return album ? [<AlbumCard key={id} album={album} />] : []; })}</Shelf>;
  if (shelf.type === 'artists') return <Shelf title={shelf.title} subtitle={shelf.subtitle}>{shelf.keys.flatMap((key) => { const artist = music.index.artistByKey.get(key); return artist ? [<ArtistCard key={key} artist={artist} />] : []; })}</Shelf>;
  return <Shelf title={shelf.title} subtitle={shelf.subtitle}>{shelf.mixes.map((mix) => <MixCard key={mix.id} mix={mix} />)}</Shelf>;
}

export function HomePage() {
  const music = useMusic();
  const nav = useMusicNav();
  const [now] = useState(() => new Date());
  const shelves = useMemo(() => buildShelves({ index: music.index, state: music.user, films: music.films, now }), [music.index, music.user, music.films, now]);

  if (music.index.tracks.length === 0) return <Page><AccessPanel kind="music" /></Page>;

  return <Page>
    <View style={{ gap: 14 }}>
      <PageTitle>{greeting(now.getHours())}</PageTitle>
      <View accessibilityRole="toolbar" accessibilityLabel={t.moods} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MOODS.map((mood: MoodId) => <Chip key={mood} icon={MOOD_ICON[mood]} label={MOOD_LABEL[mood]} onPress={() => nav.go({ page: 'mood', id: mood })} />)}
      </View>
      <AccessNotice kind="music" />
      {music.pending > 0 ? <Note spinner>{formatContent(t.readingSongs, { count: music.pending })}</Note> : null}
    </View>
    {shelves.map((shelf) => <ShelfView key={shelf.id} shelf={shelf} />)}
  </Page>;
}
