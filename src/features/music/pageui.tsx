import { createContext, useContext, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { clamp, music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useMusicNav } from './musicNav';

/** A screenful of Music: padding and spacing exactly as .music-page (and its phone variant) set them. */
export function Page({ children }: { children: ReactNode }) {
  const nav = useMusicNav();
  const { width } = useWindowDimensions();
  const side = nav.compact ? 14 : clamp(14, width * 0.024, 32);
  return <View style={{ paddingTop: nav.compact ? 14 : 22, paddingBottom: nav.compact ? 30 : 40, paddingHorizontal: side, gap: nav.compact ? 22 : 26 }}>{children}</View>;
}

export function PageTitle({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return <Txt size={clamp(28, width * 0.036, 40)} weight={800} ls={-0.03} accessibilityRole="header">{children}</Txt>;
}

export function SectionHead({ title, small, children }: { title: string; small?: string; children?: ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
    <View style={{ flexShrink: 1 }}>
      <Txt size={20} weight={800} ls={-0.02} accessibilityRole="header">{title}</Txt>
      {small ? <Txt size={13} weight={500} color={M.muted} style={{ marginTop: 3 }}>{small}</Txt> : null}
    </View>
    {children}
  </View>;
}

export const Section = ({ children, label }: { children: ReactNode; label?: string }) => <View accessibilityLabel={label} style={{ gap: 12, minWidth: 0 }}>{children}</View>;

/** The one overlay slot of the music screen: menus, pickers and dialogs render above the page and the player. */
type OverlayContextValue = { show: (node: ReactNode) => void; hide: () => void };
export const OverlayContext = createContext<OverlayContextValue | null>(null);
export function useOverlay(): OverlayContextValue {
  const value = useContext(OverlayContext);
  if (!value) throw new Error('useOverlay must be used inside the music screen.');
  return value;
}
