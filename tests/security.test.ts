import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/*
 * Guards for the claims this app makes about itself: it is offline (no network permission in the release build, no network code), it keeps its
 * data to itself (no backup, no accounts, no secrets) and its native module reads only what the system lets it see. They read the shipped
 * configuration and source, so a change that quietly breaks a claim fails here before it reaches a phone.
 */

const root = process.cwd();
const read = (relative: string): string => readFileSync(path.join(root, relative), 'utf8');
const config = JSON.parse(read('app.json')) as { expo: { android: Record<string, unknown>; updates: { enabled: boolean }; plugins: unknown[] } };

const sourceFiles = (directory: string): string[] =>
  readdirSync(path.join(root, directory)).flatMap((name) => {
    const relative = path.join(directory, name);
    if (statSync(path.join(root, relative)).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(relative);
    return /\.(ts|tsx|js|kt)$/.test(name) ? [relative] : [];
  });

test('the installed app is excluded from device backups, so its database cannot be pulled out through adb backup or cloud restore', () => {
  assert.equal(config.expo.android.allowBackup, false);
});

test('the permissions are media reading only, and the sensitive ones are blocked outright', () => {
  const requested = config.expo.android.permissions as string[];
  assert.ok(requested.length > 0);
  for (const permission of requested) assert.match(permission, /READ_MEDIA_|READ_EXTERNAL_STORAGE/, `${permission} is not a media-read permission`);
  assert.ok(!requested.some((permission) => /INTERNET|CAMERA|RECORD_AUDIO|LOCATION|CONTACTS|SMS|SYSTEM_ALERT_WINDOW/.test(permission)));
  const blocked = config.expo.android.blockedPermissions as string[];
  for (const permission of ['RECORD_AUDIO', 'CAMERA', 'SYSTEM_ALERT_WINDOW']) {
    assert.ok(blocked.includes(`android.permission.${permission}`), `${permission} is blocked`);
  }
  assert.equal(config.expo.updates.enabled, false, 'no over-the-air code updates');
});

test('the release build removes the network permission that development tooling adds', () => {
  const plugin = read('plugins/withOffline.js');
  assert.match(plugin, /android\.permission\.INTERNET" tools:node="remove"/);
  assert.match(plugin, /'src', 'release'/, 'the override lives in the release source set only, so debug builds can still reach Metro');
  assert.ok(config.expo.plugins.includes('./plugins/withOffline.js'), 'the plugin is registered');
});

test('the JavaScript has no network code, no embedded address and no dynamic code', () => {
  const files = [...sourceFiles('src'), 'App.tsx', 'index.ts', 'modules/wave-media/index.ts'];
  for (const file of files) {
    const text = read(file);
    assert.doesNotMatch(text, /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, `${file} uses the network`);
    assert.doesNotMatch(text, /\beval\(|new Function\(|dangerouslySetInnerHTML/, `${file} runs dynamic code`);
    assert.doesNotMatch(text, /https?:\/\//, `${file} embeds an address`);
  }
});

test('no key, token, password or private key is written into the source or the configuration', () => {
  const secret = /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.|(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9+/_-]{16,}['"])/i;
  for (const file of [...sourceFiles('src'), ...sourceFiles('modules'), ...sourceFiles('plugins'), 'App.tsx', 'app.json']) {
    assert.doesNotMatch(read(file), secret, `${file} looks like it holds a secret`);
  }
});

test('the sign-in screen does not claim password handling the app does not do', () => {
  const content = read('src/core/content.model.json');
  assert.doesNotMatch(content, /Passwords are hashed/i, 'no password is ever stored on this phone, so there is nothing to hash');
  assert.match(content, /No password is stored or sent from this phone/);
});

test('the native media module reads what the system shows it and writes nothing but its own picture cache', () => {
  const kotlin = read('modules/wave-media/android/src/main/java/com/cinemusicwave/media/WaveMediaModule.kt');
  assert.doesNotMatch(kotlin, /openOutputStream|contentResolver\.(delete|update|insert)\(|DocumentsContract\.(deleteDocument|renameDocument)/, 'originals are never changed');
  assert.match(kotlin, /require\(uri\.scheme == "content" \|\| uri\.scheme == "file"\)/, 'only local addresses');
  assert.match(kotlin, /if \(uri\.scheme == "file"\) require\(isCachedArtwork\(uri\)\)/, 'a path address may only name a cached picture');
  assert.match(kotlin, /canonicalFile\.parentFile == artDirectory\(\)\.canonicalFile/, 'links and ".." are resolved before the folder is compared');
  assert.match(kotlin, /require\(maxPx in 64\.\.1600\)/, 'picture sizes are bounded');
  assert.match(kotlin, /require\(uris\.size <= 64\)/, 'batch sizes are bounded');
});
