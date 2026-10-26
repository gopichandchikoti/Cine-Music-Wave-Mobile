// Config plugin: keeps the installed (release) Android binary offline-only and makes the native build work from long Windows paths.
const fs = require('node:fs');
const path = require('node:path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const RELEASE_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <!-- Cine Music Wave never talks to a server in this delivery: the release build carries no network permission at all.
       (Debug builds keep it, because they load JavaScript from the Metro development server.) -->
  <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
</manifest>
`;

module.exports = (config) => {
  config = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('CMAKE_OBJECT_PATH_MAX=180')) {
      // Shorter generated object paths keep Ninja under the 260 character Windows limit; the CMake version is the SDK's 3.31.x.
      mod.modResults.contents = mod.modResults.contents.replace(
        'android {',
        'android {\n    externalNativeBuild { cmake { version "3.31.6" } }\n    defaultConfig { externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=180" } } }',
      );
    }
    return mod;
  });
  return withDangerousMod(config, ['android', (mod) => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'release');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'AndroidManifest.xml'), RELEASE_MANIFEST);
    return mod;
  }]);
};
