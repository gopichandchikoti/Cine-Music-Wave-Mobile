# Validation

What was run, what was seen, and what was not. Nothing here is marked passed unless it was executed. Dated 2026-10-25; the spring-motion section was added 2026-10-26.

## Environment

| Item | Value |
| --- | --- |
| Workstation | Windows 11, Node 22.13.1, pnpm 11.28.3, JDK 17, Gradle 9.4.1 |
| App stack | Expo SDK 58 development build, React Native 0.88 (new architecture, Hermes), React 19, TypeScript 6 strict |
| Device | Android emulator `CineMusicWave_TestPhone`: API 35 (Google APIs), x86_64, 1344x2992 at 480 dpi (448x997 dp), a Pixel 9 Pro XL stand-in. It is not a Pixel 10, not a Samsung phone and not a physical device. |
| Build tested | `artifacts\CineMusicWave-x86_64-release.apk`: release variant, JavaScript bundled, debug-key signed (a test build, not a production release) |
| Test media | A small sample copied by `scripts\seed-fixtures.mjs` (15 songs from six albums, five 45-second 360p video clips; provenance and hashes in the git-ignored `fixtures-private\manifest.json`). The emulator also holds media that was already there (for example the "Wave Test" files, `CineMusicWaveTests`, "Gajab Raat" and "Wave-Video"); this work neither created nor removed them. |
| Sharing | The emulator was used by the owner at the same time. The display size and density were overridden for about ten minutes to emulate tablets and then reset (`wm size reset`, `wm density reset`); airplane mode was on for the offline tests and is off again. |

## Commands

| Command | Result |
| --- | --- |
| `pnpm typecheck` (`tsc --noEmit`) | Exit 0, no diagnostics. Output in `validation\final-typecheck.txt`. |
| `pnpm lint` (`oxlint src modules App.tsx index.ts`) | Exit 0, no diagnostics. `validation\final-lint.txt`. |
| `pnpm test` (`tsx --test tests/*.test.ts`) | Exit 0. 8 tests, 8 pass, 0 fail. `validation\final-test.txt`. These cover the vendored rules (name cleaning, albums, artists, covers, search, radio, series and movie grouping, resume, queue) only. No screen, native module or database code is covered by automated tests. |
| `pnpm build:android` (release) | Exit 0. First build 4 m 25 s; rebuilds with JavaScript changes 57 s and 31 s. Logs in `validation\build-android-release-*.log`. |
| `adb install -r` of the release APK | `Success`, three times (data kept: same signing key). |
| `dumpsys package com.cinemusicwave.mobile` on the release build | Permissions declared: `READ_MEDIA_AUDIO`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`, `ACCESS_NETWORK_STATE`. **No `INTERNET`.** |

No formatter, coverage tool, Sonar gate or CodeQL gate exists in this project, and none was run. `@types/node` is not a declared dependency; the test file uses `node:test`, so `tsconfig.json` lists `"node"` in `types` and relies on the copy that other packages install. Declare it if the lockfile is ever refreshed.

## Offline and profile requirements

All on the release APK, Metro stopped, airplane mode on (status bar shows the airplane icon).

| Requirement | Result | Evidence (`validation\screenshots\`) |
| --- | --- | --- |
| Cold start with no Metro, no backend and no network | Passed: the app opened to Music Home as "CH" (Chendu) with the saved queue (paused), the playlist and likes | `03-release-offline-cold-launch.png` |
| Music plays offline | Passed: media session `PLAYING`, position advancing | (logcat) |
| Video plays offline with a picture | Passed: real frames rendered, controls, time, seek bar | `11-video-playing-offline.png` |
| Audio keeps playing with the screen off | Passed: while `mWakefulness=Asleep`, the app's `AudioTrack` stayed in `state:started` | (dumpsys audio) |
| Return to login stops playback and keeps data | Passed: player went to `paused` with the position kept; the login page showed | `04-return-to-login.png` |
| Skip Login again restores the same profile | Passed: same queue, likes, playlist and history | `05-skip-login-same-profile.png` |
| Skip Login does not skip Android permissions | Passed: after Skip Login the real Android dialog "Allow Cine Music Wave to access music and audio on this device?" appeared from the access button | `10-android-permission-dialog.png` |
| No credentials, API, network or server record for the local profile | Passed by construction and by the permission list above (no `INTERNET`); no network call exists in the code | |

## Device checks

| Check | Result | Evidence |
| --- | --- | --- |
| Create a playlist, rename it inline, add two songs from the track menu, reorder with the drag handle, restart the app, delete with confirmation | Passed. Order and contents survived a restart; delete returned to the empty-playlists note | `01`, `02`, `14`, `15`, `16` |
| Permission denied (revoked with `pm revoke`) | Passed: Watch shows "Allow access to your films and series"; Music Home shows the notice "Android is not sharing your music..." with Allow access; cached rows from the phone's library are hidden, hand-picked files remain | `08`, `09` |
| Permission request from the app | Passed: Android dialog appears; Allow restored the full library without a restart | `10` |
| Partial access (only `READ_MEDIA_VISUAL_USER_SELECTED`) | Passed: Watch explains that only selected videos are shared and offers Open settings | `06` |
| Access recovery then Refresh | Passed: titles, progress ("Resume S1:E2") and Continue Watching returned | `07` |
| Audio track menu on a two-audio file | Passed: Tamil (default) and Telugu listed, selection marker moved to Telugu. Whether the sound switched was not measured | `12` |
| Fullscreen | Passed: landscape (`ROTATION_90`), wide control bar, Back leaves fullscreen (`ROTATION_0`), Back again closes the player | `13` |
| Responsive widths: 744 dp and 1600 dp | Passed after a fix (below): matches the web's layout at 744 dp for Music (tabs, two-column Speed dial, mood chips in one row) and Watch (brand, search, refresh, switch and compact chip); the 1600 dp Watch bar shows the greeting chip | `17`, `18`, `19`, `web-reference-744\*` |
| Logcat crash buffer after the whole session | Empty | |

Earlier in the build (before this report), the same emulator showed the login, Music Home, Search, Library, album, queue, lyrics and related sheets, landscape, Watch Home, title page with episodes and resume against web screenshots taken at the same width. Those screenshots are not in this folder.

## Problems found during validation, and what was done

1. **A failed restore started playing something by itself.** After revoking access and relaunching, the remembered song could not be opened; the error path skipped it, and the skip began playback of the next song about 12 s after launch. Fix: a paused restore that fails now only says so and waits; a failed load is reported once (the engine no longer also reports it through its status listener, which could have skipped two songs). Re-test on the rebuilt APK: cold launch with access revoked; about 25 s later no audio player was `started` and the media session was `PAUSED`.
2. **No explanation when access is revoked and cached songs exist.** The rows were hidden and a toast was the only message. Fix: `AccessNotice` on Music Home and Watch (text plus Allow access or Open settings). Seen in `09`.
3. **Account chip overflowed at 744 dp.** The greeting text showed above 640 dp, but the web hides it at 760 dp and below. Fix: one breakpoint (`GREETING_HIDDEN_MAX = 760`) inside `ProfileControl`. Seen fixed at 744 dp and the greeting present at 1600 dp.
4. **`pnpm typecheck` failed** on `node:test` imports once `tests/` was included. Fix: `"node"` added to `types`.

## Seen and not resolved

- **Account chip missing once.** After playing a video, entering and leaving fullscreen and closing the player, the Watch top bar showed no account chip (also absent from the accessibility tree). Switching to Music and back brought it back. A second identical cycle on the next build did not reproduce it. Cause unknown; the chip's code returns nothing only if the profile or account context is missing, neither of which changed.
- **Native warning** `Unsupported type for radius property: Null` is logged by React Native when the player opens and closes (some view resets a border radius). No visible effect; not traced.
- **Gboard "Try out your stylus" sheet** appeared over the app once after typing into a field. It is a system prompt, not the app.

## Spring motion and rename, 2026-10-26

The folder was renamed to `Cine Music Wave Mobile`. The release APK was rebuilt from it with `scripts\build-android.ps1` (Gradle build successful) and installed over the previous build with `adb install -r` on `CineMusicWave_TestPhone`, so app data was kept.

| Check | Result |
| --- | --- |
| `tsc --noEmit` | exit 0 |
| `oxlint src modules App.tsx index.ts tests` | exit 0 |
| `tsx --test tests/*.test.ts` | 12 of 12 pass: 8 portable-rules tests and 4 spring tests (the physics match response and damping fraction; the smooth spring never overshoots; snappy overshoots by under 2% and bouncy by 3% to 8%; all settle within 1 s) |
| `node scripts/audit-standards.mjs` | 0 errors, 3 warnings (two files over 400 lines; privacy and terms pages, which do not apply to an offline app), 5 notices |
| Cold start of the new build | restored the local profile and showed Watch home; nothing from `ReactNativeJS` or `AndroidRuntime` in the error log |
| Profile menu, Return to login, Skip Login | the login screen showed Skip Login at the bottom; one tap returned to Watch home as profile CH |
| Watch to Music switch | Music home with the mini player |
| Full-screen player | opens from the mini player; the Up next, Lyrics and Related tabs are shown |
| Tab highlight | recording: fades in under Lyrics, slides to Related, slides back to Up next, fades out when the tab is pressed again (`pill-slide.png`, `contact-all.png`) |
| Track menu and add-to-playlist dialog | recording: the menu rises in; the dialog fades in over the dimmed screen and fades out (`contact-menus.png`) |
| Playback settings sheet | opens; the Autoplay switch was checked at rest in both positions and then returned to on |
| Minimise | the player fades and sinks to the Music page (last frames of `spring.mp4`) |

Evidence files are in `validation\screenshots\2026-10-26-springs\`.

Limits of this evidence: the motion was judged from recorded frames on an emulator (the recorder fell back to 720x1280), not by feel on a phone. The recordings did not catch a clear frame of the menu sinking, so the menu exit is evidenced only by the dialog frames. A tab's label colour changes the moment it is chosen, while the highlight needs about a third of a second to arrive: a visible detail, not something a test covers. Reduced motion was not switched on. Strix did not run. iOS was not built.

## Themes and the new Music screens, 2026-10-26

Built with `scripts\build-android.ps1` (Gradle build successful, release APK) and installed over the previous build with `adb install -r` on `CineMusicWave_TestPhone` (app data kept). The tools were called directly from `node_modules\.bin`.

| Check | Result |
| --- | --- |
| `tsc --noEmit` | exit 0 |
| `oxlint src modules App.tsx index.ts` | exit 0 |
| `tsx --test tests/*.test.ts` | 18 of 18 pass: 12 earlier tests plus 6 new in `tests/theme.test.ts` (the dark palette is the approved one; the light palette and the live objects switch and switch back; WCAG AA contrast of ink, muted, accent, text on accent, danger or warning, and muted on a raised surface, for Music and Watch in both themes) |
| `node scripts/audit-standards.mjs` | 0 errors, 3 warnings (two files over 400 lines, and privacy and terms pages, which do not apply to an offline app), 4 notices |
| Dark theme after the change | Music Home, singer page, film page and Watch Home match the approved look; only the bottom bar (now the dock) differs by design (`01`, `02`, `03`, `04`, `13`) |
| Switch to light and back, from the account menu | Music and Watch changed in place with playback and the queue untouched; the status bar icons changed colour; the choice survived an install over the running app and the relaunch that follows (it came up light) |
| Singer page, dark and light | picture under the status bar, tinted page, three round buttons, Featured album, Top songs with the next column showing, albums, all songs (`02`, `06`) |
| Film page, with and without a cover | dark with artwork (`03`); light with no cover, where the hero is the name-coloured tile (`09`) |
| Your Library | section buttons with "All" open, shelves with title chevrons (`08`) |
| Dock | Home and Your Library menu grows out of the button (`07`); mini player pill shows the song and play and next |
| Watch in light | header, tabs, billboard with a pale veil, poster cards still dark with white titles (`10`); the Play button is solid green |
| Title page and player in light | both stay dark; the video played (0:05 of 0:08 on screen) with the dark controls (`11`, `12`) |
| Wide layout (1600x2560 at 280 dpi, then reset) | side list and player bar, dark and light (`14`, `15`); display size and density were reset after |

Evidence files are in `validation\screenshots\2026-10-26-themes-and-music-screens\`.

Problems found and fixed on the device: the Watch "Play" button was washed out in the light theme (the light glass sheen covered its green fill; a filled button now leaves the sheen out); the singer page had an empty column to the left of the song covers (the track-number column; now removed there) and the next Top songs column barely showed (now 16% of the shelf); content scrolling under the status bar collided with the clock (a fade of the page colour now appears once the picture has scrolled away).

Limits of this evidence: one emulator, one library (the owner's test files), Android only; phone and one wide size. Not exercised: the light theme on the wide singer and film pages (they keep the earlier headers), playing a song with the light full-screen player open, TalkBack and reduced motion with the new screens, a library with no covers at all, and a profile with no songs in the light theme. A first attempt to switch themes once showed a frame in which the menu was still fading while the page had not yet changed, and my next adb input pulled down the notification shade; three further switches with proper waits (light to dark, dark to light, light to dark) behaved correctly, but that first frame was not explained. A back-key press after a display-size change also left the app (the size change had reset it to Home), and two adb taps then opened Google Calendar's welcome screen on the emulator; nothing was entered there. Strix did not run. iOS was not built.

## Background banding and the dither layer, 2026-10-26

Measured on a full-resolution emulator screenshot of Music Home (a column of pixels at the left edge, 1,570 px tall): before, 120 colour changes with the longest flat run 130 px and most runs 16 px (steps of 1 to 3 levels, i.e. visible bands); a plain background patch of 30 x 30 px held 12 distinct colours (standard deviation 0.44). After the dither layer the same patch held 39 distinct colours (standard deviation 1.62) and the screen showed no bands and no visible grain. The first version (`resizeMode="repeat"`) changed nothing (identical pixel statistics), so the noise is now a grid of plain images. `tsc` and `oxlint` exit 0, the 18 tests pass, and the release build installed and ran. Not measured: the effect on the Watch backdrop and the full-screen player (they use the same component but were not sampled), other screen densities.

## Not run

- iOS in any form (`IOS_SETUP.md`); a physical Android device; Pixel or Samsung hardware.
- Sleep timer, crossfade, autoplay, radio, shuffle and repeat, speed and picture menus, subtitle tracks (the test clips have none), My List add and remove, season picker, Settings and My profile dialogs.
- Picking files or folders by hand; an unavailable (moved or deleted) file.
- TalkBack, reduced motion (the code reads the system setting; it was not switched on in the emulator), font scaling, following the phone's dark or light setting (not offered), low-memory and long-duration playback, interruptions (calls, headphones removed).
- A signed production release or a Play Store build.
- Automated UI tests: none exist.

## Screenshots

`validation\screenshots\` (git-ignored: they show the owner's media titles). `web-reference-744\` holds the web app at 744x1240 for the responsive comparison.

## Security pass - 2026-10-26

| Check | Result |
| --- | --- |
| Secret search, working tree and the one commit | None found (only a placeholder in `AGENTS.md`'s instructions). `.env*`, keystores, `artifacts/`, `fixtures-private/` and `validation/` are ignored. |
| `pnpm audit --prod` | 2 high advisories, both through `@expo/cli` (build tool): `node-forge` GHSA-86w9-cpqp-85rv (no patched version exists) and `zod` GHSA-mrhx-c7xc-m3w5 (fix is a major version). Searching the release APK's JavaScript bundle for `node-forge`, `forge.pki`, `ZodError`, `@expo/cli` and `devcert` found none, while `react-native` (24) and the app's own `WaveMedia` (1) were found, so the search works. Not reachable from the installed app. |
| Network code | None in `src`, `App.tsx`, `index.ts` or the module wrapper (`tests/security.test.ts` enforces it). The bundle's `fetch` and `XMLHttpRequest` strings come from React Native's own runtime. The release manifest has no `INTERNET` permission. |
| Built release APK (`aapt2 dump permissions` and `xmltree`) | No `INTERNET`; `allowBackup=false`; no `debuggable`; exported: the launcher activity (with the `cinemusicwave://` link) and AndroidX `ProfileInstallReceiver` (system-protected). Permissions: media reading, foreground media playback, audio settings, vibrate, wake lock, network state. |
| `tsx --test tests/*.test.ts` | 25 passed (18 earlier + 7 security) |
| `tsc --noEmit`, `oxlint` | Clean |
| `scripts/audit-standards.mjs` | 0 errors, 3 warnings that were already there (two long files and "no privacy or terms page"; the app has no accounts, uploads, analytics or network, which is when UI-12 requires one) |
| On the emulator | Installed over the existing app without wiping data (`install -r`). Opened with the "CH" profile, library and covers intact. No `FATAL EXCEPTION` and an empty crash buffer. Device package flags lost `ALLOW_BACKUP`. The full-screen player's backdrop was cover-tinted, so the picture colour read still works through the new path confinement. Airplane mode was left off and no display size was changed. |

Not verified: iOS; a physical phone; the debug build; behaviour of `adb backup` itself on the emulator (the manifest flag and package flags were checked, the command was not run); Strix. The release APK is still signed with the public debug key; see `OPERATIONS.md`.
