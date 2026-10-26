# Android setup, build, install

No Android Studio. Existing command-line tools are reused (the SDK, JDK and emulator were installed earlier for this project and are shared with the previous attempt).

| Item | Value |
| --- | --- |
| JDK | `C:\Users\chand\Documents\Codex\tools\jdk\jdk-17.0.19+10` (`JAVA_HOME`) |
| Android SDK | `C:\Users\chand\Documents\Codex\android-sdk` (`ANDROID_HOME`): platform-tools, emulator, build-tools, NDK, CMake 3.31.6 |
| Emulator | AVD `CineMusicWave_TestPhone`: Google APIs, API 35, x86_64, profile `pixel_9_pro_xl`, 1344x2992 at 480 dpi (448x997 dp). The SDK has no Pixel 10 profile, so this is a Pixel 9 Pro XL stand-in. It does not validate Pixel or Samsung hardware behaviour. |
| Package | `com.cinemusicwave.mobile` (same id as the earlier attempt, so installing replaces that app) |
| Gradle / JS | Gradle 9.4.1 wrapper, React Native 0.88, Expo SDK 58, Hermes |

`scripts/build-android.ps1` and `install-android.ps1` default to those paths when `JAVA_HOME`/`ANDROID_HOME` are unset.

## Build and install

```powershell
pnpm install
pnpm build:android                      # release, bundled JS  -> artifacts\CineMusicWave-x86_64-release.apk
pnpm build:android -- -Variant debug    # debug, loads JS from Metro
pnpm install:android                    # adb install -r, then launches
```

First build is slow (React Native's native libraries compile, several minutes); later builds take seconds to a minute.

The script mirrors `src`, `modules`, `plugins`, `assets` and the config files into `E:\cmwm`, installs the frozen lockfile there with `nodeLinker: hoisted` (set in `pnpm-workspace.yaml`; pnpm 11 ignores `.npmrc` for this), runs `expo prebuild --clean` when `app.json`, the plugin or the dependencies changed, then Gradle. It refuses to use a folder it did not create (marker `.cmw-mobile-stage`) and never deletes outside it.

Both APKs are signed with the generated debug key (a test build, not a production release). An APK built earlier by the other project with the same key installs over this one; anything else needs `adb uninstall com.cinemusicwave.mobile` first, which deletes the app's own data only.

## Developing with Metro (debug build)

```powershell
pnpm start                                   # Metro on 8081 (keep it running; do not set CI=1 or reloads are disabled)
adb -s emulator-5554 reverse tcp:8081 tcp:8081
```

Two emulator facts: airplane mode blocks the emulator's 10.0.2.2 route, and the debug app's default host on emulators is 10.0.2.2. Point it at the tunnel once:

```powershell
adb -s emulator-5554 shell "run-as com.cinemusicwave.mobile sh -c \"printf '<?xml version=\\\"1.0\\\" encoding=\\\"utf-8\\\" standalone=\\\"yes\\\" ?>\n<map><string name=\\\"debug_http_host\\\">localhost:8081</string></map>\n' > shared_prefs/com.cinemusicwave.mobile_preferences.xml\""
```

The release APK needs none of this: JavaScript is inside the APK, there is no INTERNET permission, and Metro and `adb reverse` are not used.

## Test media and permissions

```powershell
node scripts\seed-fixtures.mjs --music-only      # 15 songs from 6 albums of the owner's library -> /sdcard/Music/<album>/
node scripts\seed-fixtures.mjs --video-only      # five short 360p excerpts -> /sdcard/Movies/
node scripts\seed-fixtures.mjs --clean           # removes only what this script copied
```

Sources are read only. Provenance (source names and SHA-256) goes to `fixtures-private\manifest.json`, which is git-ignored. The script asks MediaStore to index the new files (`content call --uri content://media/ --method scan_volume --arg external_primary`); the app then finds them through its normal scan.

Grant, revoke and inspect permissions with `adb shell pm grant|revoke com.cinemusicwave.mobile android.permission.READ_MEDIA_AUDIO` (and `READ_MEDIA_VIDEO`), or through the app's own "Grant media access" button.

## Native generation

`android/` is generated and git-ignored. Custom native work lives in `modules/wave-media` (autolinked from `modules/`) and `plugins/withOffline.js`; `expo prebuild --clean` can erase anything else.
