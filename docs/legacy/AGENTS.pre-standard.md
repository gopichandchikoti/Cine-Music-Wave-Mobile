# Cine Music Wave (mobile) repository instructions

Standalone React Native (Expo, custom development build) Android/iOS product. The installed app is named **Cine Music Wave**. The sibling web app (`E:\New repos for portfolio\Cine Music Wave Web`) is the source and visual reference; the separate `Study-entertain-library` project must not be touched.

## Required context

Read `docs/MOBILE_REPLICATION_GUIDE.md` (the handoff), `SOURCE_REFERENCE.md`, `FEATURE_PARITY.md`, `system_design.md` and `FEATURE_LOG.md` before substantial work. Inspect the implementation and its callers before editing. Current source and the scripts in `package.json` take precedence over any legacy bundle. No WebView wrapper, and no Study, Markdown or Learning routes.

## The one rule that defines this app

The screens must look and behave like the web app: same colours, fonts (DM Sans, DM Mono, Fraunces), spacing, liquid-glass panes, layouts and breakpoints. When changing UI, port the web CSS value for value (`Cine Music Wave Web/src/Music.css`, `Watch.css`, `Glass.css`, `Entertainment.css`, `features/auth/Auth.css`) and compare an emulator screenshot with the web at the same width (`scripts/` and `docs/` explain how). Do not restyle for "native feel". The one deliberate deviation is listed in `SOURCE_REFERENCE.md`.

## Current offline scope

- Login screen: bottom **Skip Login** with "Continue offline as Chendu". One tap selects the device-local profile `local-test-chendu` and opens Watch/Music with no credentials, no network request and no server record. This is profile selection, not authentication: never set an authenticated flag or fake a session. "Chendu" is only the test profile name; branding stays Cine Music Wave.
- Skip Login never skips Android/iOS permissions. The app lists only what the OS shows it (MediaStore on Android; picked files/folders on iOS) plus files the user picks by hand. No demo catalog, no remote PC library, no fetch, upload or analytics. The release APK carries no INTERNET permission (`plugins/withOffline.js`).
- Return to login stops playback and clears the active profile; it never deletes media or saved collections. Signing in again restores the same profile.
- Online accounts, hosting and sync are deferred (`docs/FUTURE_ONLINE_BACKEND_PLAN.md`). Do not invent OAuth, email, token or sync contracts. Keep the web app's authentication unchanged.

## Implementation standards

- Use `pnpm` and strict TypeScript. Avoid `any`, unsafe casts, unhandled promises, debug logging, dead or mock product controls and suppression-only fixes. Use parameterized SQL (`src/data/repository.ts`). Validate and bound native, picker and parsing input.
- Layers: `src/core` (portable rules vendored from the web with matching tests, no React Native imports), `src/data` (SQLite, catalog, session), `src/platform` (native adapters: scanner, permissions, audio engine, artwork), `src/design` (tokens, glass, controls), `src/features` (screens), `modules/wave-media` (Kotlin/Swift). Keep them separate.
- `android/` and `ios/` are **generated** by `expo prebuild` and git-ignored. Never hand-edit them: custom native work belongs in `modules/` and `plugins/`, or the next prebuild erases it.
- Add a dependency only when needed; check maintenance, licenses and native compatibility; keep notices. No private media, artwork, paths, hashes or signing keys in Git, screenshots or cloud builds (`fixtures-private/` is ignored).
- Keep loading, empty, denied, partial, unavailable, error and success states, safe areas, touch targets, accessibility labels and reduced motion. Support landscape and tablets (the Music layout switches at 860 dp, Watch at 640 and 1000 dp, as on the web).
- Do not overwrite unrelated work, wipe an AVD, initialize Git remotes, or publish without authorization. Do not install Android Studio.

## Commands (all defined in `package.json`)

`pnpm typecheck`, `pnpm lint`, `pnpm test` (portable-rules tests), `pnpm start` (Metro for the debug build), `pnpm build:android` (release APK with bundled JavaScript; add `-- -Variant debug` for the Metro-loading debug APK), `pnpm install:android`. There is no formatter, coverage, Sonar or CodeQL gate; do not claim one ran. See `ANDROID_SETUP.md`, `IOS_SETUP.md` and `OPERATIONS.md`.

## Validation and documentation

Run the focused checks and record commands and exit codes in `VALIDATION.md`. Permission, scanning, playback, background and lifecycle behaviour needs the emulator or a device; web test totals are not mobile evidence. Never label an unexecuted test as passed. Android and iOS status are reported separately: iOS cannot be built or signed on this Windows machine.

Update `FEATURE_LOG.md` for every feature, fix, refactor, configuration or documentation change. Design decisions go in `system_design.md`, operating procedures in `OPERATIONS.md`, evidence and limits in `VALIDATION.md`, and `FEATURE_PARITY.md` must stay current so no web capability silently disappears.
