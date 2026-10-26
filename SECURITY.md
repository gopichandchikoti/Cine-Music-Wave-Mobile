# Security policy

## Reporting a vulnerability

Please report a security problem privately to the repository owner. When this repository is on GitHub, use **Report a
vulnerability** under the Security tab; otherwise contact the owner directly. Do not post details publicly until the problem is
fixed. Say what you found, how to reproduce it, and what it lets someone do.

Only the current `main` branch is supported.

## What this project protects

Cine Music Wave Mobile is an offline Android and iOS app. It has no server, no account, no password and no network code; the
release build has no network permission. What it keeps is the person's likes, playlists, play history and Watch progress in its own
private SQLite database, and the addresses of media files the system lets it see. It never changes the original media files.

## What is in place

The controls are written in [`AGENTS.md`](AGENTS.md) (Section 3, SEC-01 to SEC-52) and described in
[`system_design.md`](system_design.md) ("Security model"). In short: no `INTERNET` permission in the release build; media-read
permissions only, with camera, microphone and overlay blocked; Android backup switched off (`allowBackup=false`); only the launcher
activity and AndroidX's profile receiver are exported; the native media module accepts `content:` addresses and a `file:` address
only inside its own picture cache; SQL is parameterised; the sign-in screen does not claim password handling the app does not do.
`tests/security.test.ts` guards these claims, and the merged manifest of the built APK is read after each change. The evidence is
in [`SECURITY_VALIDATION.md`](SECURITY_VALIDATION.md) and `VALIDATION.md`.

## How to check it yourself

```
node_modules/.bin/tsx.CMD --test tests/*.test.ts
node_modules/.bin/tsc.CMD --noEmit
node_modules/.bin/oxlint.CMD src modules App.tsx index.ts
node scripts/audit-standards.mjs
pnpm audit --prod
```

After a configuration or native change, rebuild (`pnpm build:android`) and run `aapt2 dump permissions` and
`aapt2 dump xmltree --file AndroidManifest.xml` on the APK.

## Known limits

Every APK this project builds is signed with Android's public debug key; it is for the owner's own devices until a private
keystore exists. Two build-tool advisories (`node-forge`, `zod`, through `@expo/cli`) are recorded and are not in the shipped app.
iOS has not been built (it cannot be on Windows), and no automated penetration test has been run. The full list is in
`SECURITY_VALIDATION.md`.
