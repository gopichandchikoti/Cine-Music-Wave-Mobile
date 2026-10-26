# Source reference

What this app was built from, so differences can be traced. Private file names, media paths and secrets are deliberately not recorded here.

## Sources

| Source | Location | Revision |
| --- | --- | --- |
| Web app (visual and behaviour reference) | `E:\New repos for portfolio\Cine Music Wave Web` | Not a Git checkout; working tree of 2026-10-24/25. File hashes below. |
| Original application guidance | `E:\New repos for portfolio\Study-entertain-library\AGENTS.md` | read only; that project was not changed |
| Handoff documents | `docs/` (six files from the Web folder) | copied unchanged |
| Earlier mobile attempt | `E:\New repos for portfolio\Cine Music Wave Mobile` | read for the Windows build workaround and the MediaStore approach only; no UI or logic was reused. Left as it was. |

Files copied from the web (SHA-256, first 16 hex characters) into `src/core`:

| Web file | Mobile file | Hash | Change |
| --- | --- | --- | --- |
| `src/features/music/musicModel.ts` | `musicModel.ts` | `092742e27786f1d4` | none |
| `src/features/music/queue.ts` | `queue.ts` | `54ff30c4ce42732f` | none |
| `src/features/music/musicTypes.ts`, `musicHelpers.ts` | same names | n/a | none |
| `src/features/watch/watchModel.ts` | `watchModel.ts` | `63983295f06e5721` | content import path |
| `src/features/watch/picture.ts`, `captions.ts`, `watchTypes.ts` | same names | `023c090e3f395926`, `71bdc4091bde9405` | none |
| `server/music/metadata.ts` | `musicMetadata.ts` | `67a13a89b986c0b6` | import paths |
| `server/music/lyrics.ts` | `lyrics.ts` | `7f49479ba5db96d7` | none |
| `server/watch/filename.ts` | `filename.ts` | `561b8413f294882c` | none |
| `src/content.model.json`, `content.ts` | same names | `e87a5d412b99a90c` | five strings reworded for a phone (below) |

CSS ported by hand, value for value (hashes of the web files): `Music.css` `b9113e0bc306ab73`, `Watch.css` `0afa4acb8fee29f0`, `Glass.css` `63d5701f3519b223`, `Entertainment.css` `1f51562c126f25e2`, `Auth.css` `c20ef2353a1aeb25`.

## Deliberate differences from the web

- **Copy**: `musicView.emptyBody`, `watchView.emptyBody`, `watchView.noSummary`, `musicView.noLyricsHint` no longer mention the G: drive, `catalog.json` or `.lrc` files that a phone does not have.
- **Album/artist page back arrow**: on phones the web places the back arrow *between* the cover and the title (a flex quirk of `.music-back` in a column layout). The app puts it top-left above the cover, which is what the CSS intends.
- **Profile menu**: "Return to login" replaces "Sign out"; My profile and Settings describe the device-local profile and media access.
- **Login**: "Skip Login / Continue offline as Chendu" is added at the bottom; Sign in, providers and Create an account are disabled with an explanation.
- **Glass**: the web blurs with `backdrop-filter: blur() saturate(1.9) brightness(1.06)`. Android's blur has no saturate/brightness, so panes over very colourful content look a little less vivid.
- **Fonts**: DM Sans, DM Mono and Fraunces are bundled (`@expo-google-fonts/*`) instead of fetched from Google Fonts. The login brand name uses Fraunces (the web falls back to Georgia/serif there).
- **Not ported because a phone has no server for them**: server-side ffmpeg playback plans, audio-sync delay, sound-check meter, preview clips, hover cards, keyboard shortcuts. See `FEATURE_PARITY.md`.

## Tool and dependency versions

Node 22.13.1, pnpm 11.28.3, JDK 17.0.19 (`C:\Users\chand\Documents\Codex\tools\jdk`), Android SDK at `C:\Users\chand\Documents\Codex\android-sdk` (reused, with CMake 3.31.6 and NDK from it), Gradle 9.4.1 (wrapper). Expo 58.0.19, React Native 0.88.0, React 19.3.0, TypeScript 6.0.3, expo-audio 58, expo-video 58, expo-sqlite 58, expo-blur 58, react-native-svg 15.16, lucide-react-native 1.61, react-native-reanimated 4.7 / worklets 0.13 (installed for the Expo template; the UI uses React Native's own animation). All exact versions are in `package.json` and `pnpm-lock.yaml`.
