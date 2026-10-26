# Cine Music Wave (mobile)

The Cine Music Wave web app, as a real Android/iOS app. Same design, same pages, same behaviour: the liquid-glass Music player, the green Watch library, the sign-in page. Everything is native React Native (no WebView) and works fully offline on what is already on the phone.

- **Watch**: films and series found on the device, billboard, rails, title pages, episodes, resume, My List, and a video player with audio and subtitle tracks, picture crop modes, speed and fullscreen.
- **Music**: Home shelves, Search with filters, Library (playlists, albums, singers, songs, radios), album/singer/playlist pages, queue, lyrics, related songs, radio and autoplay, sleep timer, crossfade, likes and playlists. It keeps playing with the screen off.
- **Skip Login**: one tap on the login screen opens the app as the device-local profile "Chendu". No account, password, server or network is involved.

This is the second implementation of the mobile app. It replaces the earlier attempt (`Cine Music Wave Mobile`), which did not look like the web app. Every screen here is ported from the web CSS and compared with it at the same width (`FEATURE_PARITY.md`, `VALIDATION.md`).

## Where things are

```text
App.tsx, index.ts          entry: fonts, safe area, session, library, music, shell
src/core                   portable rules vendored from the web (grouping, search, queue, radio, resume, picture crop) + tests
src/data                   SQLite schema/repository, device catalog provider, local profile session
src/platform               scanner, permissions, audio engine, artwork cache (native adapters)
src/design                 tokens, fonts, glass, grid and small controls
src/features               auth (login), music, watch, shell (profile menu, dock, access panel)
modules/wave-media         Kotlin (Android) and Swift (iOS) native module
plugins/withOffline.js     Expo config plugin: no INTERNET permission in release, CMake path settings
scripts                    build, install, fixture seeding
docs                       the handoff documents this build followed
```

## Commands

```powershell
pnpm install                 # once (hoisted layout, see ANDROID_SETUP.md)
pnpm typecheck; pnpm lint; pnpm test
pnpm build:android           # release APK with bundled JavaScript  -> artifacts\CineMusicWave-x86_64-release.apk
pnpm build:android -- -Variant debug    # debug APK that loads JavaScript from Metro
pnpm install:android         # adb install -r + launch on emulator-5554
pnpm start                   # Metro for the debug build (then: adb reverse tcp:8081 tcp:8081)
node scripts/seed-fixtures.mjs          # copy a small authorized media sample into the emulator
```

Requirements: Node 22.13+, pnpm 11, a JDK 17 and the Android command-line SDK (see `ANDROID_SETUP.md`; this workstation's existing SDK and JDK are reused). iOS needs a Mac or cloud macOS build (`IOS_SETUP.md`).

## Documents

`AGENTS.md` (rules for agents), `system_design.md` (architecture and decisions), `FEATURE_PARITY.md` (every web capability and its native status), `VALIDATION.md` (what was run and what was seen), `OPERATIONS.md`, `ANDROID_SETUP.md`, `IOS_SETUP.md`, `SOURCE_REFERENCE.md`, `FEATURE_LOG.md`, and `THIRD_PARTY_NOTICES.md` is generated from the installed dependencies' licenses when releasing.

## Security

The security policy is [`SECURITY.md`](SECURITY.md), the design record is the "Security model" in [`system_design.md`](system_design.md), and the evidence is [`SECURITY_VALIDATION.md`](SECURITY_VALIDATION.md). The rules every change must meet are in [`AGENTS.md`](AGENTS.md) (Section 3, SEC-01 to SEC-52; Section 13 for audits).

```powershell
node_modules\.bin\tsx.CMD --test tests\*.test.ts     # includes tests\security.test.ts (offline, backup, permissions, native module)
node scripts\audit-standards.mjs                      # secrets, Android backup and permissions, native-module path confinement, docs, .gitignore
pnpm audit --prod                                     # advisories (two build-tool advisories are recorded and are not in the app)
```

After any `app.json`, plugin or native change, rebuild with `pnpm build:android` and read the APK's merged manifest with `aapt2 dump permissions` and `aapt2 dump xmltree --file AndroidManifest.xml`.

## Publication rules

Maintainer feature logs stay local and are excluded from source control. Do not
force-add or publish them. Enable the repository's push guard after cloning:

```sh
git config core.hooksPath .githooks
```

Run `node --test scripts/publish-guard.checks.mjs` to verify the guard. It checks
the complete history being pushed, including files deleted by later commits.
