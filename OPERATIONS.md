# Operations

There is no server. Operating the app means building it, installing it, keeping test media on the emulator and looking after the phone's own data.

## Routine tasks

| Task | Command or place |
| --- | --- |
| Build the offline APK | `pnpm build:android` (log: `validation\build-android-release-*.log`) |
| Install and open | `pnpm install:android` |
| Run checks | `pnpm typecheck; pnpm lint; pnpm test` |
| Reopen the emulator | `& "$env:ANDROID_HOME\emulator\emulator.exe" -avd CineMusicWave_TestPhone` in its own window; never create a second AVD to reopen this one, never wipe it |
| Seed or clear test media | `node scripts\seed-fixtures.mjs` / `--clean` |
| Take a screenshot | `adb -s emulator-5554 exec-out screencap -p > shot.png` |
| Cold-start offline test | stop Metro, `adb shell cmd connectivity airplane-mode enable`, `adb shell am force-stop com.cinemusicwave.mobile`, `adb shell am start -n com.cinemusicwave.mobile/.MainActivity` |
| See app logs | `adb logcat -s ReactNativeJS:V` and `adb logcat --pid=<pid>` |

## Data on the phone

- Database: the app's private storage (`cine-music-wave.db`, WAL mode). It holds the catalog, likes, plays, playlists, radios, Watch progress and My List for the local profile, plus the saved queue and place. Backups are Android's own (the manifest allows normal app backup); nothing is uploaded by the app.
- Cover and poster images: `files/artwork/*.jpg` in the app's private storage, rebuilt on demand. Safe to delete.
- Originals are never written, renamed or deleted by the app.
- Removing the profile data: Android Settings, Apps, Cine Music Wave, Storage, Clear storage. "Return to login" does not clear anything.
- Emulator: `adb uninstall com.cinemusicwave.mobile` deletes only this app's data. Seeded test files live under `/sdcard/Music/<album>/` and `/sdcard/Movies/`; `seed-fixtures.mjs --clean` removes exactly those listed in `fixtures-private\manifest.json`.

## Privacy and security

- The release APK has no INTERNET permission, so it cannot send data. The debug APK has it only to reach Metro.
- No analytics, crash reporting, update service or remote fonts. Fonts and icons are bundled.
- Do not commit `fixtures-private/`, `validation/` (screenshots can show private titles), `artifacts/`, `.env*`, keystores or provisioning profiles; `.gitignore` already excludes them.
- Third-party notices: run a license listing of the installed runtime dependencies before sharing the APK and keep their notices with it.
- **No device backup.** The app is excluded from Android backups (`allowBackup=false`), so `adb backup` and cloud restore do not copy its database. The cost: moving to a new phone does not carry likes, playlists or Watch progress; they start empty there.
- **Signing key.** Every APK this project builds is signed with Android's public debug key. That is fine on your own phone and emulator, but anyone holding the same public key could build an APK that Android treats as an update to this one. **Before giving the APK to anyone**, create a private release keystore (`keytool -genkeypair`), keep it and its password outside the repository (`*.keystore` and `*.jks` are ignored), point the Gradle release signing at it, and store a backup of it: losing it means users must uninstall to update.
- **Known build-tool advisories.** `pnpm audit --prod` reports two high advisories, `node-forge` (no patched release exists) and `zod` (the fix is a new major version that Expo's command-line tool cannot use). Both arrive only through `@expo/cli`, which runs on your computer at build time; neither is in the app's JavaScript bundle (checked by searching the release bundle for them). Recheck after each Expo upgrade.
- The `cinemusicwave://` link opens the app (Android lists it as a browsable link). The app does not read what the link carries, so it only brings the app to the front. It is kept because the development build uses the same scheme.

## When something is wrong

| Symptom | Likely cause and fix |
| --- | --- |
| Red screen "Unable to load script" (debug build) | Metro not running, `adb reverse` missing, airplane mode on, or the debug host preference not set (see `ANDROID_SETUP.md`). The release APK does not use Metro. |
| "Cannot find native module 'WaveMedia'" | The APK was built before the module existed or the staging copy missed it: rebuild with `pnpm build:android`. |
| Build fails with "mkdir ... No such file" or paths over 260 characters | `node_modules` in `E:\cmwm` is not hoisted: delete only `E:\cmwm\node_modules`, `android` and the two `.cmw-*-signature` files, rebuild. |
| No songs although files exist | The permission is off or partial (the app says so), or MediaStore has not indexed copied files: `adb shell content call --uri content://media/ --method scan_volume --arg external_primary`. |
| Video plays with no picture, or errors | Unsupported codec for this device or emulator image (the player says "could not be played" and offers retry). Try the same file on a physical phone. |
