# Security validation - 2026-10-26

What was reviewed in Cine Music Wave Mobile, what was found, what was changed, how each change was proved, and what is still open.
The app is offline and has no server, so most web-security items (CSRF, CORS, rate limits, sessions, passwords) do not apply; the
review concentrated on what other software and other people can reach on the phone, and on whether the app claims more than it does.
This is a list of what was checked and what happened, not a promise that the app cannot be broken.

## Method

The configuration (`app.json`, the config plugin), the JavaScript, the Kotlin module, the generated manifest and the built APK were
read. Secrets were searched by pattern in the working tree and in the repository's one commit (values never printed; not an entropy
scanner). Each new control got a test, and the packaging claims were checked on the **built** APK with `aapt2`, not only in the config.

## Results at a glance

| Check | Result |
| --- | --- |
| Secrets in tree and history | None found (one placeholder in the agent instructions). `.env*`, keystores, `artifacts/`, `validation/`, `fixtures-private/` are ignored |
| `pnpm audit --prod` | 2 high advisories, both through `@expo/cli` (build tool only); see M5 |
| Tests | 25 pass (18 earlier, 7 in `tests/security.test.ts`) |
| `tsc --noEmit`, `oxlint` | Clean |
| `node scripts/audit-standards.mjs` | 0 errors; remaining warnings are not security findings |
| Built release APK (`aapt2`) | No `INTERNET`; `allowBackup=false`; no `debuggable`; exported: launcher activity and AndroidX `ProfileInstallReceiver` only |
| On the emulator | Installed over the existing app without wiping data; opened with data intact; no crash; package flags lost `ALLOW_BACKUP`; the player's cover tint still works |
| Strix, iOS, a physical phone | **Not run** |

## Findings and fixes

| ID | Severity | Finding and evidence | Fix | Proof |
| --- | --- | --- | --- | --- |
| M1 | Medium | `android:allowBackup="true"` in the generated manifest: `adb backup` or a cloud restore could copy the app's SQLite database (likes, playlists, progress, the addresses of media files). | `android.allowBackup: false` in `app.json` | merged manifest of the built APK; device package flags; `tests/security.test.ts` |
| M2 | Low | The native module's `localUri` accepted any `file:` path from JavaScript, including the app's own database. Not reachable from outside the app (no network, no link handling), but the module should take only what it needs. | A `file:` address is accepted only directly inside the artwork cache after links and `..` are resolved (SEC-50). | source test; on-device check that the cover tint (which reads a cached `file:` picture) still works |
| M3 | Low | The sign-in screen said "Passwords are hashed." No password exists on the phone. | "No password is stored or sent from this phone." (copy only, no layout change) | content test |
| M4 | Medium (repository) | `.gitignore` had a bare `android/` and `ios/`, which also matched `modules/wave-media/android` and `ios`: the app's own native module sources (Kotlin, Swift, `build.gradle`) were **not in the first commit**, so a clone could not build, and the audit could not see them. | Anchored to `/android/` and `/ios/` (generated folders stay ignored), plus scratch, tool-config and database patterns | `git ls-files --others --exclude-standard -- modules` now lists the sources; the SEC-50 audit rule fires when the confinement is removed |
| M5 | Info | `node-forge` (no patched release) and `zod` (fix is a new major version) reach the project only through `@expo/cli`. | Recorded, not overridden (an override would break Expo's tooling). | searched the release JavaScript bundle for `node-forge`, `ZodError`, `@expo/cli`, `devcert`: none, while `react-native` (24) and `WaveMedia` (1) were found, so the search works |
| M6 | Info (open) | Every APK is signed with Android's public debug key. | Not changed: a private keystore is the owner's to create and keep. | `build.gradle` signing config read |
| M7 | Info | The `cinemusicwave://` link is a registered, browsable scheme. | Documented: the app does not read what a link carries, so it only brings the app forward. | the app uses `Linking` only to open system settings |

## Checked and found sound

No network code in `src`, `App.tsx`, `index.ts` or the module wrapper, no embedded addresses, no analytics or networking dependency
(the bundle's `fetch` and `XMLHttpRequest` strings are React Native's own runtime), no `eval` or WebView; media-read permissions only
with camera, microphone and overlay blocked; no secret anywhere; SQL parameterised; the module never writes, renames or deletes an
original and bounds its inputs; `updates.enabled=false` (no over-the-air code); only the launcher activity is exported by the app.

## Not fixed, and why

1. **Signing key (M6).** Until a private keystore exists, the APK must not leave your own devices.
2. **Backup off means a new phone starts empty.** That is the cost of M1, and it is documented in `OPERATIONS.md`.
3. **iOS** has not been built (it cannot be on Windows); nothing here says it is secure.
4. **No formatter** is configured (a new dependency needs your go-ahead).

## Deployment actions

Reinstall the new APK (`pnpm install:android` keeps data). Before sharing an APK with anyone: create a private release keystore
outside the repository, sign with it, and keep a backup.

## Not covered

Strix; a physical device; the debug build; running `adb backup` itself (the manifest flag and the device's package flags were
checked, the command was not); iOS.

## How to re-run

```
node_modules/.bin/tsx.CMD --test tests/*.test.ts
node_modules/.bin/tsc.CMD --noEmit
node_modules/.bin/oxlint.CMD src modules App.tsx index.ts
node scripts/audit-standards.mjs
pnpm audit --prod
pnpm build:android      # then aapt2 dump permissions / xmltree on the APK
```
