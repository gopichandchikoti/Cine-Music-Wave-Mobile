import { ArrowUpRight, Eye, EyeOff, Film } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { content as copy } from '../../core/content';
import { LOCAL_PROFILE_NAME, useSession } from '../../data/session';
import { Press } from '../../design/primitives';
import { clamp, paper as P } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { AuthMascot } from './AuthMascot';

const t = copy.authGate;

/** The faint 48px grid behind the sign-in page (web: .account-shell::before at 20% opacity). */
function GridBackground() {
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} opacity={0.2}>
    <Defs><Pattern id="grid" width={48} height={48} patternUnits="userSpaceOnUse"><Path d="M48 0H0V48" fill="none" stroke={P.line} strokeWidth={1} /></Pattern></Defs>
    <Rect width="100%" height="100%" fill="url(#grid)" />
  </Svg>;
}

function Brand() {
  return <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: P.teal, boxShadow: '5px 5px 0 rgba(230, 109, 67, 0.35)', transform: [{ rotate: '-4deg' }] }}>
      <Film size={22} color="#eef4e9" />
    </View>
    <View>
      <Txt family="serif" weight={700} size={23} color={P.ink}>{t.secondBrain}</Txt>
      <Txt family="mono" size={10} ls={0.16} color={P.muted} style={{ marginTop: 5 }}>{t.studyLibrary}</Txt>
    </View>
  </View>;
}

function Field({ label, value, onChange, secret, autoComplete }: { label: string; value: string; onChange: (value: string) => void; secret?: boolean; autoComplete?: 'username' | 'current-password' }) {
  const [shown, setShown] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}>
    <Txt size={13} weight={600} color={P.ink}>{label}</Txt>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: focused ? P.teal : 'rgba(235, 239, 229, 0.18)', borderRadius: 9, backgroundColor: P.raised, boxShadow: focused ? `0 0 0 3px ${P.tealSoft}` : undefined }}>
      <TextInput value={value} onChangeText={onChange} secureTextEntry={secret && !shown} autoCapitalize="none" autoCorrect={false} autoComplete={autoComplete} maxLength={secret ? 128 : 254}
        accessibilityLabel={label} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={P.teal} cursorColor={P.teal}
        style={{ flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 0, color: P.ink, fontFamily: 'DMSans_400Regular', fontSize: 15 }} />
      {secret ? <Press onPress={() => setShown(!shown)} label={shown ? t.hidePassword : t.showPassword} style={{ minWidth: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center' }}>
        {shown ? <EyeOff size={18} color={P.muted} /> : <Eye size={18} color={P.muted} />}
      </Press> : null}
    </View>
  </View>;
}

function LinkText({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return <Txt size={12} color={P.teal} style={{ textDecorationLine: 'underline', opacity: disabled ? 0.5 : 1 }}>{children}</Txt>;
}

const providers = [
  { name: 'Google', symbol: 'G', color: P.teal },
  { name: 'Microsoft', symbol: '▦', color: P.accent },
  { name: 'Facebook', symbol: 'f', color: P.teal },
] as const;

/**
 * The web app's sign-in page, with one addition for this offline delivery: Skip Login at the bottom opens the app as the device-local
 * profile "Chendu". Signing in online is not available yet, so those controls say so instead of pretending to work.
 */
export function LoginScreen() {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width > 760;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const skip = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try { await session.skipLogin(); } finally { setBusy(false); }
  };

  const form = <View style={{ width: '100%', maxWidth: 470, alignSelf: 'center' }}>
    <View>
      <Txt family="mono" weight={700} size={10} ls={0.15} upper color={P.muted}>{t.welcomeBack}</Txt>
      <Txt family="serif" weight={600} size={clamp(29, width * 0.03, 40)} lh={1.08} ls={-0.03} color={P.ink} style={{ marginTop: 14 }} accessibilityRole="header">{t.welcomeToYourSecondBrain}</Txt>
      <Txt size={14} color={P.muted} style={{ marginTop: 14, marginBottom: 28 }}>{t.pickUpWhereYourCuriosityLeftOff}</Txt>
    </View>
    <View accessibilityRole="alert" style={{ marginBottom: 16, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 3, borderLeftColor: P.teal, backgroundColor: P.tealSoft }}>
      <Txt size={13} lh={1.5} color={P.ink}>Online sign-in is planned. For now, Skip Login below opens your library on this phone: no account and no connection needed.</Txt>
    </View>
    <View style={{ gap: 16 }}>
      <Field label={t.emailOrUsername} value={identifier} onChange={setIdentifier} autoComplete="username" />
      <Field label={t.password} value={password} onChange={setPassword} secret autoComplete="current-password" />
      <Press disabled label={`${t.signIn} (unavailable offline)`} style={{ minHeight: 48, marginTop: 8, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: P.teal }}>
        <ArrowUpRight size={17} color={P.paper} />
        <Txt size={14} weight={700} color={P.paper}>{t.signIn}</Txt>
      </Press>
    </View>
    <View style={{ minHeight: 42, justifyContent: 'center' }}><LinkText disabled>{t.forgotPassword}</LinkText></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 20 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: P.line }} />
      <Txt size={11} color={P.muted}>{t.orContinueWith}</Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: P.line }} />
    </View>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {providers.map((provider) => <Press key={provider.name} disabled label={`${t.continueWith}${provider.name}: ${t.notConfigured}`}
        style={{ flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(235, 239, 229, 0.18)', borderRadius: 9, backgroundColor: P.raised }}>
        <Txt size={22} weight={700} color={provider.color} style={{ fontFamily: undefined }}>{provider.symbol}</Txt>
        <View><Txt size={12} color={P.ink}>{provider.name}</Txt><Txt size={9} color={P.muted}>{t.notConfigured}</Txt></View>
      </Press>)}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
      <Txt size={13} color={P.muted}>{t.newHere}</Txt>
      <Press disabled label={t.createAnAccount} style={{ minHeight: 42, justifyContent: 'center' }}><Txt size={13} color={P.teal} style={{ textDecorationLine: 'underline' }}>{t.createAnAccount}</Txt></Press>
    </View>
    <Txt size={11} lh={1.65} color={P.muted} style={{ marginTop: 6 }}>{t.localModeEmailDeliveryIsNotConfiguredVerificationAndPassword}</Txt>
    <View style={{ borderTopWidth: 1, borderTopColor: P.line, marginTop: 24, paddingTop: 20 }}>
      <Txt size={11} lh={1.65} color={P.muted}>{t.passwordsAreHashedProviderPasswordsStayWithTheProvider}{'\n'}{t.yourLearningLibraryAtYourOwnPace}</Txt>
    </View>
  </View>;

  return <View style={{ flex: 1, backgroundColor: P.paper }}>
    <GridBackground />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + (wide ? 40 : 24), paddingHorizontal: wide ? clamp(20, width * 0.05, 76) : 18, paddingBottom: 150, gap: wide ? 60 : 25, flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch' }}>
      {wide ? <View style={{ flex: 1, maxWidth: 520 }}>
        <Brand />
        <Txt family="mono" weight={700} size={10} ls={0.15} upper color={P.muted} style={{ marginTop: 58 }}>{t.yourCuriosityCollected}</Txt>
        <Txt family="serif" weight={600} size={clamp(36, width * 0.04, 60)} lh={1.04} ls={-0.045} color={P.ink} style={{ marginVertical: 18 }}>{t.smallDiscoveries}{'\n'}{t.lastingUnderstanding}</Txt>
        <Txt size={16} lh={1.6} color={P.muted} style={{ maxWidth: 340 }}>{t.yourNotesYourNextIdeaAndAQuietPlaceTo}</Txt>
        <AuthMascot width={Math.min(300, width * 0.28)} />
      </View> : <Brand />}
      <View style={{ flex: wide ? 1 : undefined }}>{form}</View>
    </ScrollView>
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 18, paddingBottom: Math.max(14, insets.bottom + 8), borderTopWidth: 1, borderTopColor: P.line, backgroundColor: 'rgba(17, 25, 23, 0.97)' }}>
      <View style={{ width: '100%', maxWidth: 470, alignSelf: 'center', alignItems: 'center', gap: 8 }}>
        <Press onPress={() => { void skip(); }} disabled={busy} label="Skip Login" hint={`Continue offline as ${LOCAL_PROFILE_NAME}. No account, password or connection is used.`} pressScale={0.98}
          style={{ alignSelf: 'stretch', minHeight: 52, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: P.teal }}>
          <Txt size={15} weight={700} color={P.paper}>Skip Login</Txt>
        </Press>
        <Txt size={13} color={P.muted}>Continue offline as {LOCAL_PROFILE_NAME}</Txt>
      </View>
    </View>
  </View>;
}
