# Builds the Android APK for the emulator without Android Studio.
#
# The canonical folder name is long and contains spaces; generated CMake/Ninja paths for React Native's native libraries then exceed
# Windows' 260 character limit. This script mirrors only source and configuration into a short, marker-owned staging folder, installs the
# frozen lockfile there and builds there. It never deletes anything outside the staging folder and refuses a folder it did not create.
#
#   pnpm build:android                       release APK with bundled JavaScript (offline acceptance build)
#   pnpm build:android -- -Variant debug      debug APK that loads JavaScript from Metro (adb reverse tcp:8081 tcp:8081)
param(
  [ValidateSet('release', 'debug')][string]$Variant = 'release',
  [string]$Architecture = 'x86_64',
  [string]$StageRoot = 'E:\cmwm'
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot

if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Users\chand\Documents\Codex\tools\jdk\jdk-17.0.19+10' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'C:\Users\chand\Documents\Codex\android-sdk' }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
if (-not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { throw "JAVA_HOME is not a JDK: $env:JAVA_HOME (see ANDROID_SETUP.md)" }
if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw "ANDROID_HOME does not exist: $env:ANDROID_HOME (see ANDROID_SETUP.md)" }
$env:EXPO_NO_TELEMETRY = '1'
$env:CI = '1'
$env:EXPO_NO_GIT_STATUS = '1'

$stage = [IO.Path]::GetFullPath($StageRoot)
$marker = Join-Path $stage '.cmw-mobile-stage'
if ((Test-Path -LiteralPath $stage) -and -not (Test-Path -LiteralPath $marker)) { throw "Existing folder $stage was not created by this script; refusing to use it." }
if ((Test-Path -LiteralPath $marker) -and ([IO.File]::ReadAllText($marker).Trim() -ne $project)) { throw "Staging folder belongs to another source root; refusing to overwrite." }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
[IO.File]::WriteAllText($marker, $project)

# 1. Mirror source and configuration (never node_modules, native build output or secrets). Only src, modules, plugins and assets are mirrored, so the
#    native modules' own android/ and ios/ folders are included while the generated top-level android/ project is left alone.
$excludeDirs = @('node_modules', '.expo', '.git', 'build', '.gradle', '.cxx', 'Pods')
foreach ($folder in @('src', 'modules', 'plugins', 'assets')) {
  & robocopy (Join-Path $project $folder) (Join-Path $stage $folder) /MIR /XD @excludeDirs /XF '.env*' '*.keystore' '*.jks' '*.sqlite' /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $folder (exit $LASTEXITCODE)" }
}
foreach ($file in @('App.tsx', 'index.ts', 'app.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'tsconfig.json')) {
  Copy-Item -LiteralPath (Join-Path $project $file) -Destination (Join-Path $stage $file) -Force
}

Push-Location $stage
try {
  # 2. Dependencies, only when the manifest or lockfile changed.
  $depsSignature = (Get-FileHash -LiteralPath 'package.json' -Algorithm SHA256).Hash + (Get-FileHash -LiteralPath 'pnpm-lock.yaml' -Algorithm SHA256).Hash
  $depsPath = Join-Path $stage '.cmw-deps-signature'
  if (-not (Test-Path -LiteralPath 'node_modules') -or -not (Test-Path -LiteralPath $depsPath) -or [IO.File]::ReadAllText($depsPath) -ne $depsSignature) {
    & pnpm.cmd install --frozen-lockfile --node-linker=hoisted
    if ($LASTEXITCODE -ne 0) { throw 'Staging dependency installation failed.' }
    # A hoisted layout has real folders at the top of node_modules; links into .pnpm would push generated CMake paths past 260 characters.
    if ((Get-Item -LiteralPath 'node_modules\react-native').LinkType) {
      Remove-Item -LiteralPath 'node_modules' -Recurse -Force
      & pnpm.cmd install --frozen-lockfile --node-linker=hoisted
      if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath 'node_modules\react-native').LinkType) { throw 'Could not create a hoisted node_modules in the staging folder.' }
    }
    [IO.File]::WriteAllText($depsPath, $depsSignature)
  }
  # 3. Generate the native Android project when app configuration or config plugins changed.
  $configSignature = (Get-FileHash -LiteralPath 'app.json' -Algorithm SHA256).Hash + (Get-FileHash -LiteralPath 'plugins\withOffline.js' -Algorithm SHA256).Hash + $depsSignature
  $nativePath = Join-Path $stage '.cmw-native-signature'
  if (-not (Test-Path -LiteralPath 'android\gradlew.bat') -or -not (Test-Path -LiteralPath $nativePath) -or [IO.File]::ReadAllText($nativePath) -ne $configSignature) {
    & pnpm.cmd exec expo prebuild --platform android --no-install --clean
    if ($LASTEXITCODE -ne 0) { throw 'Android project generation failed.' }
    [IO.File]::WriteAllText($nativePath, $configSignature)
  }
} finally { Pop-Location }

# 4. Gradle build.
$reports = Join-Path $project 'validation'
New-Item -ItemType Directory -Force -Path $reports | Out-Null
$task = if ($Variant -eq 'release') { ':app:assembleRelease' } else { ':app:assembleDebug' }
Push-Location (Join-Path $stage 'android')
try {
  $ErrorActionPreference = 'Continue'
  & .\gradlew.bat $task "-PreactNativeArchitectures=$Architecture" '--console=plain' '--max-workers=4' 2>&1 | Tee-Object -FilePath (Join-Path $reports "build-android-$Variant-$(Get-Date -Format yyyyMMdd-HHmmss).log")
  $exit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($exit -ne 0) { throw "Gradle build failed with exit code $exit (see validation\build-android-$Variant.log)" }
} finally { Pop-Location }

$artifacts = Join-Path $project 'artifacts'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$built = Join-Path $stage "android\app\build\outputs\apk\$Variant\app-$Variant.apk"
$target = Join-Path $artifacts "CineMusicWave-$Architecture-$Variant.apk"
Copy-Item -LiteralPath $built -Destination $target -Force
Write-Output "APK: $target (debug-key signed test build; not a production release)"
