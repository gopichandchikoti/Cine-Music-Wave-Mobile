import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LibraryProvider } from './src/data/LibraryProvider';
import { SessionProvider, useSession } from './src/data/session';
import { ThemeProvider, useAppliedTheme } from './src/data/theme';
import { fontAssets } from './src/design/fonts';
import { paper } from './src/design/tokens';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { Shell } from './src/features/shell/Shell';
import { MusicProvider } from './src/features/music/MusicProvider';

function Gate() {
  const session = useSession();
  const signedIn = session.status === 'local' && session.profile !== null;
  const mode = useAppliedTheme(signedIn);
  if (session.status === 'loading') return <View style={{ flex: 1, backgroundColor: paper.paper }} />;
  if (session.status === 'signed-out' || !session.profile) return <LoginScreen />;
  // Keyed by profile: switching profiles unmounts everything that holds that profile's playback and data.
  return <LibraryProvider key={session.profile.id} profileId={session.profile.id}>
    <MusicProvider>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Shell />
    </MusicProvider>
  </LibraryProvider>;
}

export default function App() {
  const [fontsReady] = useFonts(fontAssets);
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: paper.paper }} />;
  return <SafeAreaProvider>
    <StatusBar style="light" />
    <ThemeProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </ThemeProvider>
  </SafeAreaProvider>;
}
