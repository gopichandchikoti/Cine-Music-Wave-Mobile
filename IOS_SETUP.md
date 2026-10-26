# iOS setup (not built or tested)

**Status: blocked.** This project was developed on Windows. iOS apps cannot be compiled, signed or installed from Windows, and no Mac, macOS build service or Apple developer account was available here. Nothing below has been run on a Mac or an iPhone; the Android app is the only validated platform.

## What exists

- Cross-platform screens, SQLite catalog, queue, playlists, Watch progress and player: the same TypeScript runs on iOS. `app.json` carries the iOS identifier `com.cinemusicwave.mobile`, the audio background mode and the usage descriptions.
- `modules/wave-media/ios/WaveMediaModule.swift` and `WaveMedia.podspec`: an **unbuilt** Swift implementation of the same JavaScript contract: Files imports and folders with saved security-scoped bookmarks, downloaded non-DRM songs from the Music library (after permission), AVFoundation tags and covers, video frames. Expect compile fixes on the first Xcode build.

## What iOS can and cannot do

- Files app picks and folders: yes (access restored from bookmarks). Whole-iPhone scan, other apps' folders, streaming-service downloads and DRM-protected media: no, by Apple's rules.
- Photos videos, lyrics in tags, black-bar detection and the audio-delay/sound-check tools are not implemented on iOS yet.
- iCloud files that are not downloaded are unavailable offline; the app shows them as unavailable.

## To build for your iPhone

Pick one:

1. **A Mac with Xcode**: `pnpm install`, `pnpm exec expo prebuild --platform ios`, open `ios/CineMusicWave.xcworkspace`, set your team under Signing and Capabilities, connect and trust the iPhone, enable Developer Mode (Settings, Privacy and Security) and press Run. A free personal team installs for 7 days at a time and has capability limits; a paid Apple Developer Program membership is needed for longer installs and for TestFlight.
2. **Windows plus a cloud macOS build** (Expo EAS): needs an Expo account, a paid Apple Developer Program membership, device registration (`eas device:create`) and `eas build --platform ios --profile development`, then install from the link. Do not put Apple passwords or signing keys in the chat or in Git.

Then run the checks in `VALIDATION.md` on the device: Files import, access after relaunch, offline playback, lock-screen audio, interruptions (call, Siri, headphones removed). Simulators do not replace those.

Expo Go cannot run this app (custom native module); use a development build.
