import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { appValue, loadProfile, saveProfile, setAppValue } from './repository';
import type { LocalProfile } from './types';

/*
 * "Skip Login" selects a profile that lives only on this phone. It is not authentication: no account, password, token, cookie or server
 * entitlement exists, nothing is sent anywhere, and the profile can only see media the operating system lets this app see. Online sign-in
 * is future work (FUTURE_ONLINE_BACKEND_PLAN.md) and would be a different identity that is never merged with this one automatically.
 */

export const LOCAL_PROFILE_ID = 'local-test-chendu';
export const LOCAL_PROFILE_NAME = 'Chendu';

export type AppMode = 'watch' | 'music';
type Status = 'loading' | 'signed-out' | 'local';

type SessionValue = {
  status: Status;
  profile: LocalProfile | null;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  /** one tap: select (or create) the device-local profile */
  skipLogin: () => Promise<void>;
  /** clear the active selection; media and saved collections stay on the phone */
  returnToLogin: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children, onLeave }: { children: ReactNode; onLeave?: () => void }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [mode, setModeState] = useState<AppMode>('watch');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const activeId = await appValue('activeProfile');
      const stored = activeId ? await loadProfile(activeId) : null;
      if (cancelled) return;
      if (stored) {
        const savedMode = await appValue(`mode:${stored.id}`);
        if (cancelled) return;
        setProfile(stored);
        setModeState(savedMode === 'music' ? 'music' : 'watch');
        setStatus('local');
      } else setStatus('signed-out');
    })();
    return () => { cancelled = true; };
  }, []);

  const skipLogin = useCallback(async (): Promise<void> => {
    const existing = await loadProfile(LOCAL_PROFILE_ID);
    const selected = existing ?? { id: LOCAL_PROFILE_ID, name: LOCAL_PROFILE_NAME, createdAt: new Date().toISOString() };
    if (!existing) await saveProfile(selected);
    await setAppValue('activeProfile', selected.id);
    const savedMode = await appValue(`mode:${selected.id}`);
    setProfile(selected);
    setModeState(savedMode === 'music' ? 'music' : 'watch');
    setStatus('local');
  }, []);

  const returnToLogin = useCallback(async (): Promise<void> => {
    onLeave?.();
    await setAppValue('activeProfile', null);
    setProfile(null);
    setStatus('signed-out');
  }, [onLeave]);

  const setMode = useCallback((next: AppMode): void => {
    setModeState(next);
    if (profile) void setAppValue(`mode:${profile.id}`, next);
  }, [profile]);

  const value = useMemo<SessionValue>(() => ({ status, profile, mode, setMode, skipLogin, returnToLogin }), [status, profile, mode, setMode, skipLogin, returnToLogin]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
