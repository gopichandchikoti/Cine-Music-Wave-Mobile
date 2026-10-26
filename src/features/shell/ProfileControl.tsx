import { ChevronDown, FilePlus2, FolderOpen, RefreshCw, Settings, ShieldCheck, X } from 'lucide-react-native';
import { createContext, useContext, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, ScrollView, useWindowDimensions, View } from 'react-native';
import { content as copy } from '../../core/content';
import { useLibrary } from '../../data/LibraryProvider';
import { useSession } from '../../data/session';
import { useTheme } from '../../data/theme';
import { Press } from '../../design/primitives';
import { GREETING_HIDDEN_MAX, music as M, paper as P, theme, watch as W } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { openSettings } from '../../platform/permissions';

const t = copy.profileMenu;

type Panel = 'profile' | 'settings' | null;
const AccountContext = createContext<{ open: (panel: Exclude<Panel, null>) => void } | null>(null);

const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.trim().slice(0, 2)).toUpperCase();
};

const greeting = (hour: number): string => (hour < 12 ? t.goodMorning : hour < 18 ? t.goodAfternoon : t.goodEvening);

/** Hosts the profile and settings dialogs that the account control in either top bar opens. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  return <AccountContext.Provider value={{ open: setPanel }}>
    {children}
    {panel ? <Dialog panel={panel} onClose={() => setPanel(null)} /> : null}
  </AccountContext.Provider>;
}

/**
 * The account chip in the top right: avatar, greeting (wide screens) and a menu. In this offline delivery it shows the device-local
 * profile; "Return to login" replaces "Sign out" and never deletes anything.
 */
export function ProfileControl({ tone = 'music' }: { tone?: 'music' | 'watch' }) {
  const session = useSession();
  const colour = useTheme();
  const account = useContext(AccountContext);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const trigger = useRef<ComponentRef<typeof View>>(null);
  const [hour] = useState(() => new Date().getHours());
  const { width: screenWidth } = useWindowDimensions();
  const showGreeting = screenWidth > GREETING_HIDDEN_MAX;
  if (!session.profile || !account) return null;
  const name = session.profile.name;
  const show = (): void => trigger.current?.measureInWindow((x, y, width, height) => { setBox({ x, y, width, height }); setOpen(true); });
  const choose = (action: () => void) => (): void => { setOpen(false); action(); };
  // The dark chip is the approved look; in the light theme it takes the colours of the screen it sits on.
  const chip = theme.mode === 'dark'
    ? { border: P.line, fill: P.raised, avatar: P.tealSoft, initials: P.teal, ink: P.ink }
    : tone === 'watch'
      ? { border: W.line, fill: W.field, avatar: W.chip, initials: W.accent, ink: W.ink }
      : { border: M.line, fill: M.surface, avatar: M.surfaceHover, initials: M.accent, ink: M.ink };
  return <View>
    <View ref={trigger} collapsable={false}>
      <Press onPress={show} label={`${greeting(hour)}, ${name}. ${t.yourAccount}`} expanded={open} hint="Opens the account menu"
        style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: chip.border, backgroundColor: chip.fill }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: chip.avatar }}>
          <Txt size={11} weight={700} color={chip.initials}>{initialsOf(name)}</Txt>
        </View>
        {showGreeting ? <Txt size={12} color={chip.ink}>{greeting(hour)}{t.text}{name}</Txt> : null}
        <ChevronDown size={14} color={chip.ink} />
      </Press>
    </View>
    <Modal transparent visible={open} animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
      <Press onPress={() => setOpen(false)} label="Close menu" style={{ flex: 1 }}>
        {box ? <View style={{ position: 'absolute', top: box.y + box.height + 8, right: Math.max(8, screenWidth - (box.x + box.width)), width: 210, padding: 7, borderRadius: 9, borderWidth: 1, borderColor: P.lineStrong, backgroundColor: P.raised, boxShadow: P.shadow }}
          accessibilityRole="menu" accessibilityLabel={t.yourAccount}>
          {[
            { label: t.myProfile, action: () => account.open('profile') },
            { label: t.settings, action: () => account.open('settings') },
            { label: colour.mode === 'light' ? t.switchToDark : t.switchToLight, action: colour.toggle },
            { label: 'Return to login', action: () => { void session.returnToLogin(); } },
          ].map((item) => <Press key={item.label} role="menuitem" label={item.label} onPress={choose(item.action)} pressedStyle={{ backgroundColor: P.tealSoft }} style={{ minHeight: 44, justifyContent: 'center', padding: 9, borderRadius: 5 }}>
            <Txt size={16} color={P.ink}>{item.label}</Txt>
          </Press>)}
        </View> : null}
      </Press>
    </Modal>
  </View>;
}

function Row({ icon: Icon, label, onPress }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; onPress: () => void }) {
  return <Press onPress={onPress} label={label} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: P.lineStrong, borderRadius: 7, backgroundColor: P.paper }}>
    <Icon size={17} color={P.ink} /><Txt size={14} color={P.ink}>{label}</Txt>
  </Press>;
}

/** Dark or light, as two choices side by side; the picked one is outlined. */
function ThemeChoice() {
  const { mode, setMode } = useTheme();
  return <View accessibilityRole="radiogroup" accessibilityLabel={copy.settingsView.theme} style={{ flexDirection: 'row', gap: 10 }}>
    {([['dark', copy.settingsView.dark], ['light', copy.settingsView.light]] as const).map(([value, label]) => {
      const on = mode === value;
      return <Press key={value} role="radio" checked={on} label={label} onPress={() => setMode(value)}
        style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 2 : 1, borderColor: on ? P.teal : P.lineStrong, borderRadius: 7, backgroundColor: on ? P.tealSoft : P.paper }}>
        <Txt size={14} weight={on ? 700 : 400} color={P.ink}>{label}</Txt>
      </Press>;
    })}
  </View>;
}

const stateText = { unknown: 'Not checked yet', granted: 'Allowed: music and videos', partial: 'Partly allowed', denied: 'Not allowed yet', blocked: 'Turned off in Android settings' } as const;

function Dialog({ panel, onClose }: { panel: Exclude<Panel, null>; onClose: () => void }) {
  const session = useSession();
  const library = useLibrary();
  const profile = session.profile;
  const songs = library.music.tracks.length;
  const films = library.titles.length;
  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', padding: 12 }}>
      <View accessibilityViewIsModal style={{ maxHeight: '92%', width: '100%', maxWidth: 620, alignSelf: 'center', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: P.lineStrong, backgroundColor: P.raised, boxShadow: P.shadow }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
          <Txt family="serif" weight={600} size={28} color={P.ink} accessibilityRole="header">{panel === 'profile' ? copy.profileView.myProfile : copy.settingsView.settings}</Txt>
          <Press onPress={onClose} label={panel === 'profile' ? copy.profileView.closeProfile : copy.settingsView.close} style={{ minHeight: 42, minWidth: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.lineStrong, borderRadius: 7, backgroundColor: P.paper }}><X size={18} color={P.ink} /></Press>
        </View>
        <ScrollView contentContainerStyle={{ gap: 14 }}>
          {panel === 'profile' ? <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: P.tealSoft }}><Txt size={22} weight={700} color={P.teal}>{initialsOf(profile?.name ?? '')}</Txt></View>
              <View style={{ flex: 1 }}>
                <Txt size={20} weight={700} color={P.ink}>{profile?.name}</Txt>
                <Txt size={13} color={P.muted}>Local profile · this phone only</Txt>
              </View>
            </View>
            <Txt size={12} lh={1.6} color={P.muted}>Created {profile ? new Date(profile.createdAt).toLocaleDateString() : ''} · {songs} songs · {films} films and series found on this phone.</Txt>
            <View style={{ padding: 12, borderLeftWidth: 3, borderLeftColor: P.teal, backgroundColor: P.tealSoft }}>
              <Txt size={13} lh={1.5} color={P.ink}>This is not an online account. It has no password, token or server record, and nothing about it leaves the phone. Your likes, playlists and Watch progress are saved on this phone under this profile.</Txt>
            </View>
          </> : <>
            <Txt size={15} weight={700} color={P.ink}>Media on this phone</Txt>
            <Txt size={13} lh={1.6} color={P.muted}>Android access: {stateText[library.access.state]}. Cine Music Wave lists only the files Android lets it see, and never changes or deletes them.</Txt>
            <View style={{ gap: 10 }}>
              {library.access.state === 'blocked' || library.access.state === 'partial'
                ? <Row icon={Settings} label="Open Android settings" onPress={() => { void openSettings(); }} />
                : <Row icon={ShieldCheck} label="Grant media access" onPress={() => { void library.askAccess(); }} />}
              <Row icon={FilePlus2} label="Add files" onPress={() => { void library.pick(false); }} />
              <Row icon={FolderOpen} label="Add a folder" onPress={() => { void library.pick(true); }} />
              <Row icon={RefreshCw} label="Refresh library" onPress={() => { void library.rescan(); }} />
            </View>
            <Txt size={15} weight={700} color={P.ink} style={{ marginTop: 6 }}>{copy.settingsView.theme}</Txt>
            <ThemeChoice />
            <Txt size={13} lh={1.6} color={P.muted}>{copy.settingsView.themeHint} Text follows your phone's font size, up to a comfortable limit.</Txt>
            <Txt size={15} weight={700} color={P.ink} style={{ marginTop: 6 }}>Offline delivery</Txt>
            <Txt size={13} lh={1.6} color={P.muted}>This build has no network permission. Online sign-in, sync and remote libraries are planned for later.</Txt>
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
