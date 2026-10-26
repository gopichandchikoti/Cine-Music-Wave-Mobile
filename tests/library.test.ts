import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMusic, buildTitles, languageName } from '../src/core/library';
import { cleanTags } from '../src/core/musicMetadata';
import { buildIndex, radioTracks, searchLibrary, seededRandom } from '../src/core/musicModel';
import { append, insertNext, makeQueue, move, nextIndex, removeAt, restoreOrder, shuffleUpcoming } from '../src/core/queue';
import { nextToPlay } from '../src/core/watchModel';
import type { MediaRecord } from '../src/data/types';

const record = (overrides: Partial<MediaRecord> & Pick<MediaRecord, 'id' | 'kind' | 'name' | 'folder'>): MediaRecord => ({
  uri: `content://media/external/${overrides.kind}/media/${overrides.id}`, size: 1000, modified: 1_700_000_000_000, added: 1_700_000_000_000, seenAt: 1_700_000_000_000,
  duration: 200, width: 0, height: 0, mime: overrides.kind === 'audio' ? 'audio/mpeg' : 'video/mp4', tags: null, cover: false, lyrics: false, readAt: 1, missing: false, ...overrides,
});

test('site names, numbers and uploader tags never reach the screen', () => {
  const clean = cleanTags({ title: '[iSongs.info] 01 - Aakupachhani Chandamaamalaa', artist: 'Karthik, Ramya Behara, [UrsTelugu.Net]', albumArtist: null, album: 'Jyo Achyutananda - (2016)', genre: 'www.AtoZmp3.in', date: null, track: '1/9', disc: null, composer: null, language: null, bpm: null, hasLyrics: false }, 'Music/Jyo Achyutananda (2016)/01.mp3');
  assert.equal(clean.title, 'Aakupachhani Chandamaamalaa');
  assert.deepEqual(clean.artists, ['Karthik', 'Ramya Behara']);
  assert.equal(clean.album, 'Jyo Achyutananda');
  assert.equal(clean.year, 2016);
  assert.equal(clean.genre, null);
  assert.equal(clean.track, 1);
});

test('songs without tags fall back to their file name and folder, and say so honestly', () => {
  const { tracks } = buildMusic([record({ id: 'audio:1', kind: 'audio', name: '03 - Fugly - Banjarey [DJMaza.Info].mp3', folder: 'Music/Fugly (2014)' })]);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, 'Fugly - Banjarey');
  assert.equal(tracks[0].album, 'Fugly');
  assert.equal(tracks[0].year, 2014);
  assert.deepEqual(tracks[0].artists, []);
});

test('songs whose tags have not been read yet are pending, not shown', () => {
  const built = buildMusic([record({ id: 'audio:1', kind: 'audio', name: 'a.mp3', folder: 'Music', readAt: 0 }), record({ id: 'audio:2', kind: 'audio', name: 'b.mp3', folder: 'Music' }), record({ id: 'audio:3', kind: 'audio', name: 'c.mp3', folder: 'Music', missing: true })]);
  assert.equal(built.tracks.length, 1);
  assert.equal(built.pending, 1);
});

test('one album per film, singers spelled one way, covers found per album', () => {
  const tags = (title: string, artist: string): MediaRecord['tags'] => ({ title, artist, album: 'Tillu Square', year: '2023' });
  const built = buildMusic([
    record({ id: 'audio:1', kind: 'audio', name: 'a.mp3', folder: 'Music/Tillu Square (2023)', tags: tags('Radhika', 'Ram Miriyala'), cover: true }),
    record({ id: 'audio:2', kind: 'audio', name: 'b.mp3', folder: 'Music/Tillu Square (2023)', tags: tags('Oh My Lily', 'Sreeramachandra') }),
    record({ id: 'audio:3', kind: 'audio', name: 'c.mp3', folder: 'Music/Tillu Square (2023)', tags: tags('Ticket Eh Konakunda', 'Ram  Miriyala') }),
  ]);
  const index = buildIndex(built.tracks);
  assert.equal(index.albums.length, 1);
  assert.equal(index.albums[0].trackIds.length, 3);
  assert.equal(index.artists.length, 2);
  assert.equal(built.coverSources.size, 1);
  assert.ok(built.tracks.every((track) => track.cover));
});

test('search finds songs by singer and film, radio starts with the seed song', () => {
  const built = buildMusic([
    record({ id: 'audio:1', kind: 'audio', name: 'a.mp3', folder: 'Music/A', tags: { title: 'Radhika', artist: 'Ram Miriyala', album: 'Tillu Square' } }),
    record({ id: 'audio:2', kind: 'audio', name: 'b.mp3', folder: 'Music/B', tags: { title: 'Amma Song', artist: 'Thaman S', album: 'Guntur Kaaram' } }),
  ]);
  const index = buildIndex(built.tracks);
  assert.equal(searchLibrary(index, 'miriyala').tracks.length, 1);
  assert.equal(searchLibrary(index, 'guntur').albums.length, 1);
  const radio = radioTracks(index, { kind: 'track', value: 'audio:1' }, { count: 5, random: seededRandom('x') });
  assert.equal(radio[0].id, 'audio:1');
});

test('series are grouped by show, movies by title and year, languages come from the file', () => {
  const titles = buildTitles([
    record({ id: 'video:1', kind: 'video', name: 'Mumbai Diaries (2021) S01E01 Hindi.mp4', folder: 'Movies', height: 360, duration: 45 }),
    record({ id: 'video:2', kind: 'video', name: 'Mumbai Diaries (2021) S01E02 Hindi.mp4', folder: 'Movies', height: 360, duration: 45 }),
    record({ id: 'video:3', kind: 'video', name: 'Raabta (2017) Hindi 720p.mp4', folder: 'Movies', height: 720, duration: 8000, tags: { audioTracks: [{ mime: 'audio/mp4a-latm', language: 'tel', channels: 2 }] } }),
  ]);
  assert.equal(titles.length, 2);
  const series = titles.find((title) => title.kind === 'series');
  assert.equal(series?.files.length, 2);
  assert.equal(series?.files[0].episode, 1);
  const movie = titles.find((title) => title.kind === 'movie');
  assert.equal(movie?.year, 2017);
  assert.equal(movie?.files[0].quality, 'HD');
  assert.equal(movie?.files[0].audio[0].label, 'Telugu · AAC Stereo');
  assert.equal(languageName('und'), null);
});

test('resume picks the next episode after a finished one, and the place inside an unfinished one', () => {
  const [series] = buildTitles([
    record({ id: 'video:1', kind: 'video', name: 'Show S01E01.mp4', folder: 'TV', duration: 600 }),
    record({ id: 'video:2', kind: 'video', name: 'Show S01E02.mp4', folder: 'TV', duration: 600 }),
  ]);
  const done = nextToPlay(series, [{ fileId: 'video:1', titleId: series.id, position: 590, duration: 600, completed: true, updatedAt: '2026-01-01T00:00:00Z' }]);
  assert.equal(done.file.id, 'video:2');
  const part = nextToPlay(series, [{ fileId: 'video:1', titleId: series.id, position: 120, duration: 600, completed: false, updatedAt: '2026-01-01T00:00:00Z' }]);
  assert.equal(part.file.id, 'video:1');
  assert.equal(part.startAt, 120);
});

test('queue rules: play next, add, reorder, remove, shuffle and restore', () => {
  let queue = makeQueue(['a', 'b', 'c', 'd'], 0);
  queue = insertNext(queue, ['x']);
  assert.deepEqual(queue.items.map((item) => item.trackId), ['a', 'x', 'b', 'c', 'd']);
  queue = append(queue, ['y']);
  queue = move(queue, 5, 1);
  assert.equal(queue.items[1].trackId, 'y');
  queue = removeAt(queue, 1);
  const shuffled = shuffleUpcoming(queue, seededRandom('q'));
  assert.equal(shuffled.items[0].trackId, 'a');
  assert.deepEqual(restoreOrder(shuffled).items.map((item) => item.trackId), queue.items.map((item) => item.trackId));
  assert.equal(nextIndex(makeQueue(['a'], 0), 'off', false), null);
  assert.equal(nextIndex(makeQueue(['a'], 0), 'all', false), 0);
});
