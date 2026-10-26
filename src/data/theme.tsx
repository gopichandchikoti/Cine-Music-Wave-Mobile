import * as NavigationBar from 'expo-navigation-bar';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { applyTheme, paper, type ThemeMode } from '../design/tokens';
import { appValue, setAppValue } from './repository';

/*
 * Dark or light for Music and Watch, kept on this phone (app_kv). Dark is the approved design and the default. The choice is read once at
 * start; the sign-in screen is always dark.
 */

const THEME_KEY = 'theme';

type ThemeValue = { mode: ThemeMode; setMode: (mode: ThemeMode) => void; toggle: () => void };
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode | null>(null);
  useEffect(() => {
    let cancelled = false;
    appValue(THEME_KEY).then(
      (saved) => { if (!cancelled) setModeState(saved === 'light' ? 'light' : 'dark'); },
      () => { if (!cancelled) setModeState('dark'); },
    );
    return () => { cancelled = true; };
  }, []);
  const setMode = useCallback((next: ThemeMode): void => {
    setModeState(next);
    void setAppValue(THEME_KEY, next).catch(() => undefined);
  }, []);
  const toggle = useCallback((): void => setMode(mode === 'light' ? 'dark' : 'light'), [mode, setMode]);
  const value = useMemo<ThemeValue | null>(() => (mode === null ? null : { mode, setMode, toggle }), [mode, setMode, toggle]);
  if (value === null) return <View style={{ flex: 1, backgroundColor: paper.paper }} />;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.');
  return value;
}

/**
 * Makes the chosen theme the live palette while a profile is signed in, and dark otherwise. It runs while the screen renders, before any
 * component reads a colour, and the caller re-renders when the choice changes because it reads the theme context.
 */
export function useAppliedTheme(signedIn: boolean): ThemeMode {
  const { mode } = useTheme();
  const applied: ThemeMode = signedIn ? mode : 'dark';
  applyTheme(applied);
  useEffect(() => {
    // A light navigation bar has dark icons. The bar itself is drawn edge to edge, so it takes the page's colour.
    try { NavigationBar.setStyle(applied); } catch { /* the bar keeps its style where the platform has no such control */ }
  }, [applied]);
  return applied;
}
