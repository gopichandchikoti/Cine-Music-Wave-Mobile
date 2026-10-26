# Installs the built APK on the running emulator and opens the app. Never wipes app data unless -Fresh is given.
param(
  [ValidateSet('release', 'debug')][string]$Variant = 'release',
  [string]$Architecture = 'x86_64',
  [string]$Device = 'emulator-5554',
  [switch]$Fresh
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'C:\Users\chand\Documents\Codex\android-sdk' }
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$apk = Join-Path $project "artifacts\CineMusicWave-$Architecture-$Variant.apk"
if (-not (Test-Path -LiteralPath $apk)) { throw "Build first: $apk does not exist." }
& $adb -s $Device wait-for-device
if ($Fresh) { & $adb -s $Device uninstall com.cinemusicwave.mobile | Out-Null }
& $adb -s $Device install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'adb install failed. If the signature differs from the installed app, rerun with -Fresh (this deletes only the app data of com.cinemusicwave.mobile).' }
if ($Variant -eq 'debug') { & $adb -s $Device reverse tcp:8081 tcp:8081 | Out-Null }
& $adb -s $Device shell am start -n com.cinemusicwave.mobile/.MainActivity
