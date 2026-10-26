# System design

## What this is

A native React Native app that reproduces the Cine Music Wave web app on a phone, working only from media that is already on the device. There is no server in this delivery.

```text
                 +---------------------------- React Native (TypeScript) ----------------------------+
 Login ──Skip──▶ | SessionProvider ─▶ LibraryProvider ─▶ MusicProvider ─▶ Shell ─▶ MusicView | WatchView |
                 |   (local profile)    (device catalog)   (queue, likes,        (profile menu, dock)  |
                 |                                          playlists, engine)                         |
                 +---------┬---------------------┬---------------------┬------------------------------+
                            │                     │                     │
                 expo-sqlite (app-private)   wave-media module   expo-audio / expo-video
                 profile-scoped tables       MediaStore, tags,   OS media players, lock-screen
                                             covers, pickers     controls, background audio
```

## Decisions

1. **Native screens, not a WebView.** Every screen is React Native. To keep the web's look, the CSS is ported value for value (`src/design/tokens.ts`, `Glass.tsx`, and inline styles beside each component), including gradients and inset shadows, which React Native 0.88 supports as CSS strings (`backgroundImage`, `boxShadow`, `filter`). Screens were compared with web screenshots at the emulator's width (448 dp).
2. **Reuse the web's rules, not its code paths.** Grouping (albums by folder/tags, series by name), search, filters, daily mixes, radio, queue, resume and picture-crop maths are copied unchanged from the web into `src/core` and covered by tests, so the same files produce the same shelves. Only the data source changed: Android's MediaStore instead of a folder walk and ffprobe.
3. **Liquid glass on Android** needs a view to blur. `expo-blur` blurs a `BlurTargetView`, so each layer is built as `<BlurLayer overlay={glass}>content</BlurLayer>`; glass in `overlay` blurs `content`. The page, the full-screen player, and each menu host are separate layers so a menu opened in the player blurs the player. Decorative panes that sit over a flat backdrop skip the blur (`blur={0}`) to save GPU time. Below Android 12 a solid dark pane replaces the blur (the web does the same when `backdrop-filter` is missing).
4. **The catalog is Android's own index.** The scanner (`src/platform/scanner.ts`) pages MediaStore (so only files the OS permits are ever visible, with no all-files workaround), reads tags/covers/track lists only for new or changed files, marks vanished files unavailable, and keeps them in SQLite so history survives. Files the user picks by hand (document picker, folders with persisted permission) join the same catalog.
5. **Local profile, not authentication.** `skipLogin()` loads or creates the profile `local-test-chendu`, remembered in `app_kv`. All user tables (`media`, `likes`, `plays`, `recent`, `playlists`, `radios`, `watch_progress`, `watch_list`, `profile_kv`) carry `profile_id`. No token, cookie or server role exists, and the release binary has no INTERNET permission.
6. **Playback uses the OS players.** Music: two `expo-audio` players (one plays, the other only for crossfade), lock-screen card with seek buttons, background playback. Watch: `expo-video` with the app's own control bar; audio and subtitle tracks are the container's own; picture modes position the video surface from the same `layoutPicture` maths as the web.
7. **Windows build path.** Native libraries generate paths over Windows' 260-character limit when the project sits in a long folder. `scripts/build-android.ps1` mirrors source into a short, marker-owned staging folder (`E:\cmwm`) with a hoisted `node_modules`, and builds there. The canonical folder stays where it is.

## Data model (SQLite `cine-music-wave.db`)

`app_kv(key,value)`, `profile_kv(profile_id,key,value)` for settings and the saved queue/place; `media(profile_id,id,kind,uri,name,folder,size,modified,added,seen_at,duration,width,height,mime,tags,cover,lyrics,read_at,missing)`; `likes`, `plays`, `recent`, `playlists`, `playlist_tracks`, `radios`, `watch_progress`, `watch_list`. All statements are parameterized. Migrations run by `PRAGMA user_version`.

IDs: `audio:<MediaStore id>` / `video:<id>` / `doc:<hash>` for catalog rows, `a_<hash>` albums, `t_<hash>` titles, `r_<hash>` saved radios.

## Failure behaviour

Permission denied/blocked/partial, still reading, nothing found (`AccessPanel`), file moved or no longer visible (player says so; the row is hidden from lists but kept), unsupported codec (player error card with retry), native read failure (file keeps MediaStore facts and fallback names).

When access is revoked after a library was read, the rows from the phone's library are marked unavailable and hidden but kept (history, likes and playlists survive); files the user picked by hand stay. `AccessNotice` explains this on Music Home and Watch, and the rows return on the next scan after access is granted. Starting the app never starts playback: a remembered song is put back paused, and if it cannot be opened the player says so and waits.

## Not in scope (deferred)

Online accounts and sync (`docs/FUTURE_ONLINE_BACKEND_PLAN.md`), iOS build and device validation (`IOS_SETUP.md`), black-bar detection quality on unusual films, audio-sync delay and loudness analysis (needs a transcoding server or a native audio chain).

## Design record and motion (2026-10-26)

This is the design record that `AGENTS.md` (UI-01) requires. The dark look is the web app's and is frozen: tokens in
`src/design/tokens.ts` are copied value for value from `Cine Music Wave Web` (see `SOURCE_REFERENCE.md` for the deliberate
differences). Do not restyle for "native feel". The owner has since approved a light theme and the new Music screens; those are
recorded in the next section and the dark theme itself did not change.

- **Palette.** As on the web: the dark paper palette for sign-in and the profile menu, a dark and colourful Music palette
  (`#090a10` background, `#ff5c8a` accent) and an all-green Watch palette (`#03110a` background, `#34e58a` accent). Measured
  contrast (WCAG, 2026-10-26): Music ink 18.4, muted 7.7, accent 6.7; Watch ink 18.3, muted 10.0, accent 11.7; all above 4.5.
- **Type.** DM Sans, DM Mono and Fraunces, bundled from `@expo-google-fonts/*` (nothing is fetched at run time).
- **Icons.** lucide (`lucide-react-native`).
- **Glass.** `src/design/Glass.tsx` reproduces the web's panes with `expo-blur` (Android blur has no saturate or brightness, so
  panes over very colourful content look slightly less vivid).
- **Motion.** The same three springs as the web (UI-21): `snappy` 0.32 s and 0.86, `smooth` 0.50 s and 1.00, `bouncy` 0.45 s
  and 0.70. `src/design/springPhysics.ts` holds the table and the physics (stiffness = (2π / response)², damping =
  4π × dampingFraction / response, mass 1); `src/design/spring.ts` hands them to `Animated.spring` with the native driver and reads
  the system "remove animations" setting. Overlays leave through `src/design/Presence.tsx` (kept mounted for the exit, then
  removed), `src/design/SlidingTabs.tsx` slides one highlight between the player's tabs, and reduced motion makes every change
  instant. Bottom sheets and the full-screen player use `smooth` (no overshoot, so nothing lifts off the screen edge), floating
  menus and dialogs use `bouncy`, switches, tab highlights and the dimming layer use `snappy`.
- **Not done.** Dragging the player down with the finger does not yet hand its release speed to the spring (UI-23); the existing
  swipe closes it past a distance threshold and the exit then plays. Watch's section tabs scroll sideways at different widths, so
  they do not have a sliding highlight.

## Themes and the new Music screens (2026-10-26)

The owner asked for a dark and light switch for Music and Watch and for new Music screens (floating dock, Library with section
buttons, immersive singer and film pages). This departs from "look like the web app" on purpose and by request; the dark theme is
unchanged (`tests/theme.test.ts` pins its values).

- **Themes.** `music`, `watch` and `glass` in `src/design/tokens.ts` are live objects. `applyTheme(mode)` copies the dark or light
  palette into them before the tree renders (`useAppliedTheme` in `src/data/theme.tsx`, called from `Gate`), every component reads
  them while it renders, and a change of choice re-renders the tree from `Gate` without remounting anything (playback, scroll and
  the queue survive). Never read a token at module load (that captures one theme); use a function or read it in render. The one
  `memo` (`TitleCard`) takes a `scheme` prop so it redraws. The choice lives in `app_kv` under `theme`; the default is dark; the
  sign-in screen is always dark. The status bar and the Android navigation bar icons follow the theme. No "follow the phone"
  option: `app.json` pins `userInterfaceStyle` to dark and changing it regenerates the native project.
- **Light palette.** Music: page `#f4f4f8` (never pure white), ink `#14151f`, muted ink at 66%, accent `#d6215d`, glass white at
  82% to 62%. Watch: page `#eef5f0`, ink `#0b2417`, muted `#456554`, accent `#0b7a42`, raised `#fbfdfb`. Measured contrast
  (WCAG, `tests/theme.test.ts` fails below these): Music light ink 16.6, muted 5.6, accent 4.5, text on accent 4.8, danger 5.4;
  Watch light ink 14.8, muted 5.9, accent 4.9, text on accent 5.4, warning 5.0. Dark (unchanged): Music ink 18.4, muted 7.7,
  accent 6.7; Watch ink 18.3, muted 10.0, accent 11.7.
- **Always dark.** Surfaces over video or posters: Watch's player, title page and poster cards read `watchDarkPalette`, `DarkTxt`
  and `Glass dark`. The full-screen music player follows the theme (light: a pastel, artwork-tinted player with dark text). The
  sign-in screen and the account menu and dialogs keep the dark paper palette.
- **Dock (phones, up to 860 dp).** `src/features/music/Dock.tsx`: a 56 dp round glass button for Home and Your Library (opens a
  menu that grows out of it on the bouncy spring), the mini player as a rounded pill, and a round Search button. Accent icons.
- **Hero pages (phones).** `Hero.tsx` and `HeroPages.tsx`: a full-bleed 1080 px picture under the status bar (its own cache key,
  because the picture cache is keyed by name alone), dark scrim at the top for the status bar and buttons, a fade to the page at
  the foot. The page takes `TINT_STRENGTH` (32% dark, 20% light) of the cover's dominant colour (`coverTint.ts`, native
  `dominantColor` on a 96 px copy) and eases back to the plain page over 520 dp. Back and "…" are pinned dark glass; after the
  hero scrolls away the status bar gets a fade of the page colour (and dark icons in the light theme). Touch targets are 44 dp or more.
- **Library.** `SectionPills.tsx`: the chosen section is an accent pill with its name, the others are 44 dp round icon buttons;
  the change runs as a `LayoutAnimation` spring using the snappy response and damping (instant with reduced motion).
- **Gradients are dithered.** Android draws gradients without dithering, which shows as bands in dark backgrounds. `Dither.tsx`
  lays a fine noise tile (`assets/dither@3x.png`, alpha 0 to 2.4%) over the Music and Watch backdrops, the hero pages and the
  full-screen player. It is a grid of plain images because `resizeMode="repeat"` drew nothing here. Put `<Dither />` as the last
  child of any new view that holds a slow gradient.
- **Not done.** Music Moments (needs accounts and a server). Favourite artist, download and add-to-library buttons (no such
  stores; the star saves the singer's radio). Following the phone's theme. Light styling for sign-in, the account menu and
  Settings. Tablet layouts keep the earlier headers.


## Security model

Added 2026-10-26. The rules are in `AGENTS.md` (Section 3, SEC-01 to SEC-52); this is the design record. Evidence is in `SECURITY_VALIDATION.md`.

**This app is offline by construction.** It has no server, no account, no password, no network code and, in the release build, no network permission. Its security is about what the phone's other software and the person holding the phone can reach, and about not claiming more than it does.

| Boundary | What crosses it | Controls |
| --- | --- | --- |
| Android to app | Media-store rows, picker results, deep links | Media-read permissions only, camera, microphone and overlay blocked (SEC-49); the app reads only what the system shows it, never writes originals; `cinemusicwave://` only brings the app forward, the app ignores what a link carries |
| JavaScript to native module | URIs, sizes, counts | Only `content:` addresses, and a `file:` address only directly inside the module's artwork cache after links and `..` are resolved (SEC-50); picture sizes and batch sizes are bounded |
| App to other apps and backups | The app's private storage | `allowBackup=false`, so Android backup and cloud restore do not copy the database; the database is in app-private storage; SQL is parameterised; no secret, key or token exists in the app |
| Build to device | The APK | Release has no `INTERNET` permission and no `debuggable` flag; the only exported components are the launcher and AndroidX's profile receiver; a test guards each claim and the merged manifest of the built APK is read (TEST-17); signed with the public debug key until the owner creates a private keystore |

**Decisions and limits.** "Skip Login" selects a device-local profile; it is not authentication and the screen says so (UI-14). Build-tool advisories (`node-forge`, `zod` via `@expo/cli`) do not ship. The release APK must not leave the owner's own devices until it has a private signing key. The native module's source is tracked because `.gitignore` anchors `/android/` and `/ios/` (GIT-07).
