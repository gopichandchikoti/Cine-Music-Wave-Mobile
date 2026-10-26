import { Linking, PermissionsAndroid, Platform, type Permission } from 'react-native';

/**
 * Whether Android lets this app list the user's audio and video. Skipping sign-in never skips this: the operating system decides.
 *   granted  - music and videos are both allowed
 *   partial  - some of it (music only, videos only, or "selected videos" on Android 14+)
 *   denied   - nothing yet (or the user said no; we may ask again)
 *   blocked  - the user said "don't ask again": only Settings can change it
 */
export type AccessState = 'unknown' | 'granted' | 'partial' | 'denied' | 'blocked';

export type AccessDetail = { state: AccessState; audio: boolean; video: boolean; selectedVideo: boolean };

const apiLevel = (): number => (typeof Platform.Version === 'number' ? Platform.Version : Number.parseInt(String(Platform.Version), 10) || 0);

const AUDIO: Permission = apiLevel() >= 33 ? 'android.permission.READ_MEDIA_AUDIO' : 'android.permission.READ_EXTERNAL_STORAGE';
const VIDEO: Permission = apiLevel() >= 33 ? 'android.permission.READ_MEDIA_VIDEO' : 'android.permission.READ_EXTERNAL_STORAGE';
const SELECTED: Permission = 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED';

const summarise = (audio: boolean, video: boolean, selectedVideo: boolean, blocked: boolean): AccessDetail => {
  const state: AccessState = audio && video ? 'granted' : audio || video || selectedVideo ? 'partial' : blocked ? 'blocked' : 'denied';
  return { state, audio, video, selectedVideo };
};

let neverAsk = false;

export async function checkAccess(): Promise<AccessDetail> {
  if (Platform.OS !== 'android') return { state: 'unknown', audio: false, video: false, selectedVideo: false };
  const audio = await PermissionsAndroid.check(AUDIO);
  const video = await PermissionsAndroid.check(VIDEO);
  const selected = apiLevel() >= 34 ? await PermissionsAndroid.check(SELECTED) : false;
  return summarise(audio, video, !video && selected, neverAsk && !audio && !video && !selected);
}

/** Shows Android's own permission dialog. The result is read back from the system, never assumed. */
export async function requestAccess(): Promise<AccessDetail> {
  if (Platform.OS !== 'android') return { state: 'unknown', audio: false, video: false, selectedVideo: false };
  const wanted: Permission[] = apiLevel() >= 33 ? [AUDIO, VIDEO] : [AUDIO];
  if (apiLevel() >= 34) wanted.push(SELECTED);
  const results = await PermissionsAndroid.requestMultiple(wanted);
  neverAsk = Object.values(results).some((value) => value === 'never_ask_again');
  return checkAccess();
}

export const openSettings = (): Promise<void> => Linking.openSettings();
