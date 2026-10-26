import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Presence } from '../../design/Presence';
import { PlaylistPicker, TrackMenu, type MenuState } from './Menus';
import { MusicNavContext, useMusicNav, type MusicNav } from './musicNav';
import { OverlayContext } from './pageui';

/*
 * Menus, pickers and dialogs float above the layer they were opened from, so their glass can blur that layer. The music page and the
 * full-screen player each have their own provider (so a menu opened in the player appears over the player) and their own outlet.
 */

type OutletState = {
  menu: MenuState | null;
  picker: readonly string[] | null;
  node: ReactNode;
  closeMenu: () => void;
  closePicker: () => void;
};

const OutletContext = createContext<OutletState | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const parent = useMusicNav();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [picker, setPicker] = useState<readonly string[] | null>(null);
  const [node, setNode] = useState<ReactNode>(null);
  const nav = useMemo<MusicNav>(() => ({
    ...parent,
    openMenu: (trackIds, anchor, source) => setMenu({ trackIds, anchor, source }),
    pickPlaylist: (trackIds) => setPicker(trackIds),
  }), [parent]);
  const overlay = useMemo(() => ({ show: setNode, hide: () => setNode(null) }), []);
  const outlet = useMemo<OutletState>(() => ({ menu, picker, node, closeMenu: () => setMenu(null), closePicker: () => setPicker(null) }), [menu, picker, node]);
  return <MusicNavContext.Provider value={nav}>
    <OverlayContext.Provider value={overlay}>
      <OutletContext.Provider value={outlet}>{children}</OutletContext.Provider>
    </OverlayContext.Provider>
  </MusicNavContext.Provider>;
}

/** Where this provider's menus and dialogs appear. Put it last inside the layer's overlay so it sits on top. */
export function OverlayOutlet() {
  const state = useContext(OutletContext);
  if (!state) throw new Error('OverlayOutlet must be inside OverlayProvider.');
  // Each overlay leaves through <Presence>, which keeps its last content on screen while it plays its exit.
  return <>
    <Presence show={state.menu !== null}>{state.menu ? <TrackMenu menu={state.menu} onClose={state.closeMenu} /> : null}</Presence>
    <Presence show={state.picker !== null}>{state.picker ? <PlaylistPicker trackIds={state.picker} onClose={state.closePicker} /> : null}</Presence>
    <Presence show={state.node !== null}>{state.node}</Presence>
  </>;
}
