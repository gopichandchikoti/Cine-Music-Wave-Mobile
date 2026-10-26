// Copies a SMALL sample of the owner's own, authorized media into the emulator's shared storage, so the app's real MediaStore scan has
// something to find (no catalog rows are ever inserted by hand). Originals are only read. Private source paths and hashes go to the
// git-ignored fixtures-private/manifest.json, never to Git, screenshots or reports.
//
//   node scripts/seed-fixtures.mjs                 music albums + short video clips
//   node scripts/seed-fixtures.mjs --music-only
//   node scripts/seed-fixtures.mjs --video-only
//   node scripts/seed-fixtures.mjs --clean         removes only the files this script put on the emulator (listed in the manifest)
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateDir = path.join(root, 'fixtures-private');
const manifestPath = path.join(privateDir, 'manifest.json');
const sdk = process.env.ANDROID_HOME ?? 'C:\\Users\\chand\\Documents\\Codex\\android-sdk';
const adb = path.join(sdk, 'platform-tools', 'adb.exe');
const device = process.env.CMW_DEVICE ?? 'emulator-5554';
const ffmpeg = process.env.CMW_FFMPEG ?? 'E:\\New repos for portfolio\\Study-entertain-library\\.tools\\ffmpeg\\bin\\ffmpeg.exe';
const audioRoot = process.env.CMW_AUDIO_SOURCE ?? 'G:\\Telegram movies\\audios';
const videoRoot = process.env.CMW_VIDEO_SOURCE ?? 'G:\\Telegram movies';

const args = new Set(process.argv.slice(2));
const MUSIC_ALBUMS = ['Tillu Square (2023)', 'A Aa (2016)', '3 (2012)', 'Hi Nanna (2023)', 'Guntur Kaaram (2023)', 'Pandaga Chesko (2015)'];
const SONGS_PER_ALBUM = 3;
const CLIPS = [
  { match: 'Raabta (2017)', name: 'Raabta (2017) Hindi 720p.mp4', start: 600, audio: 1 },
  { match: 'Chhichhore (2019)', name: 'Chhichhore (2019) Hindi 720p.mp4', start: 900, audio: 1 },
  { match: 'MUMBAI_DIARIES_2021_720p_S01_EP01', name: 'Mumbai Diaries (2021) S01E01 Hindi.mp4', start: 300 },
  { match: 'MUMBAI_DIARIES_2021_720p_S01_EP02', name: 'Mumbai Diaries (2021) S01E02 Hindi.mp4', start: 300 },
  { match: 'Casino Royale (2006)', name: 'Casino Royale (2006) English 720p.mp4', start: 1200 },
];
const CLIP_SECONDS = 45;

const run = (command, commandArgs, options = {}) => spawnSync(command, commandArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
const adbRun = (...commandArgs) => run(adb, ['-s', device, ...commandArgs]);

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });
}

mkdirSync(privateDir, { recursive: true });
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { device: [], created: new Date().toISOString() };

if (args.has('--clean')) {
  for (const entry of manifest.device) adbRun('shell', 'rm', '-f', entry.dest);
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, device: [] }, null, 2));
  console.log(`Removed ${manifest.device.length} files that this script had copied.`);
  process.exit(0);
}

const record = async (source, dest, size) => {
  manifest.device = manifest.device.filter((entry) => entry.dest !== dest);
  manifest.device.push({ dest, size, sourceSha256: await sha256(source), source: path.basename(source), copiedAt: new Date().toISOString() });
};

if (!args.has('--video-only')) {
  for (const album of MUSIC_ALBUMS) {
    const folder = path.join(audioRoot, album);
    if (!existsSync(folder)) { console.log(`skip (not found): ${album}`); continue; }
    const songs = readdirSync(folder).filter((name) => /\.(mp3|m4a|flac)$/i.test(name)).sort().slice(0, SONGS_PER_ALBUM);
    for (const song of songs) {
      const source = path.join(folder, song);
      const dest = `/sdcard/Music/${album}/${song}`;
      const result = adbRun('push', source, dest);
      if (result.status !== 0) { console.log(`push failed: ${album}/${song}: ${result.stderr.trim()}`); continue; }
      await record(source, dest, statSync(source).size);
      console.log(`music  ${album}/${song}`);
    }
  }
}

if (!args.has('--music-only')) {
  const clipDir = path.join(privateDir, 'clips');
  mkdirSync(clipDir, { recursive: true });
  const films = readdirSync(videoRoot).filter((name) => /\.(mkv|mp4)$/i.test(name));
  for (const clip of CLIPS) {
    const found = films.find((name) => name.includes(clip.match));
    if (!found) { console.log(`skip (not found): ${clip.match}`); continue; }
    const source = path.join(videoRoot, found);
    const output = path.join(clipDir, clip.name);
    if (!existsSync(output)) {
      // A short 360p H.264/AAC excerpt (two audio tracks kept where the film has them, so the audio menu has something to show).
      const made = run(ffmpeg, ['-y', '-v', 'error', '-ss', String(clip.start), '-t', String(CLIP_SECONDS), '-i', source, '-map', '0:v:0', '-map', '0:a:0', ...(clip.audio === 1 ? [] : ['-map', '0:a:1?']), '-dn', '-sn',
        '-vf', 'scale=-2:360', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-c:a', 'aac', '-ac', '2', '-b:a', '96k', '-movflags', '+faststart', output]);
      if (made.status !== 0) { console.log(`ffmpeg failed for ${clip.name}: ${made.stderr.trim().split('\n').pop()}`); continue; }
    }
    const dest = `/sdcard/Movies/${clip.name}`;
    const result = adbRun('push', output, dest);
    if (result.status !== 0) { console.log(`push failed: ${clip.name}: ${result.stderr.trim()}`); continue; }
    await record(output, dest, statSync(output).size);
    console.log(`video  ${clip.name}`);
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
// Ask Android to index what was just copied (the same thing a file manager does), then show what MediaStore now knows.
adbRun('shell', 'content', 'call', '--uri', 'content://media/', '--method', 'scan_volume', '--arg', 'external_primary');
console.log(`Done: ${manifest.device.length} files on the emulator. Manifest: fixtures-private/manifest.json (git-ignored).`);
