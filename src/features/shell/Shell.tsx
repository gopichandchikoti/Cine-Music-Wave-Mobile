import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSession } from '../../data/session';
import { music as M, watch as W } from '../../design/tokens';
import { MusicView } from '../music/MusicView';
import { WatchView } from '../watch/WatchView';
import { MusicDock } from './MusicDock';
import { AccountProvider } from './ProfileControl';

/** The app once a profile is selected: only Watch and Music, remembering the last one used. */
export function Shell() {
  const session = useSession();
  const music = session.mode === 'music';
  return <AccountProvider>
    <View style={{ flex: 1, backgroundColor: music ? M.bg : W.bg }}>
      <StatusBar style="light" />
      {music
        ? <MusicView onWatch={() => session.setMode('watch')} />
        : <>
          <WatchView onMusic={() => session.setMode('music')} />
          <MusicDock onOpen={() => session.setMode('music')} />
        </>}
    </View>
  </AccountProvider>;
}
