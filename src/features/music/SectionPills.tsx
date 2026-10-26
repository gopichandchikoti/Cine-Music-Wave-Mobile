import { useCallback, type ComponentType } from 'react';
import { LayoutAnimation, ScrollView, View } from 'react-native';
import { Press } from '../../design/primitives';
import { reduceMotionNow } from '../../design/spring';
import { SPRINGS } from '../../design/springPhysics';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';

type PillIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type Section<Id extends string> = { id: Id; label: string; icon: PillIcon };

/** The pill that is open, and the round buttons for the rest, share one row; the chosen one grows to show its name. */
const PILL_HEIGHT = 44;
/** The spring that opens and closes a pill is the named "snappy" one; LayoutAnimation takes its damping directly. */
const OPEN_MS = Math.round(SPRINGS.snappy.response * 1000);

/**
 * A row of section buttons, as in the new Library: the chosen section is a pill with its icon and name, the others are round buttons with
 * only an icon (their names are read aloud). Choosing one animates the change on a snappy spring.
 */
export function SectionPills<Id extends string>({ sections, value, onChange, label }: { sections: readonly Section<Id>[]; value: Id; onChange: (id: Id) => void; label: string }) {
  const choose = useCallback((id: Id): void => {
    if (!reduceMotionNow()) LayoutAnimation.configureNext({ duration: OPEN_MS, update: { type: LayoutAnimation.Types.spring, springDamping: SPRINGS.snappy.dampingFraction } });
    onChange(id);
  }, [onChange]);
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingRight: 14 }}>
    {sections.map((section) => {
      const on = section.id === value;
      const Icon = section.icon;
      return <Press key={section.id} role="tab" selected={on} label={section.label} onPress={() => choose(section.id)} pressScale={0.96}
        style={{ height: PILL_HEIGHT, minWidth: PILL_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: on ? 18 : 0, borderRadius: PILL_HEIGHT / 2, borderWidth: on ? 0 : 1, borderColor: M.line, backgroundColor: on ? M.accent : M.surface }}>
        <Icon size={20} color={on ? M.accentInk : M.muted} strokeWidth={2.2} />
        {on ? <View><Txt size={15} weight={700} color={M.accentInk} lines={1}>{section.label}</Txt></View> : null}
      </Press>;
    })}
  </ScrollView>;
}
