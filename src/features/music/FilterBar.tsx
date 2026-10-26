import { ChevronDown, Heart, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';
import { content as copy } from '../../core/content';
import { facetCounts, type SearchFilters } from '../../core/musicModel';
import { Press } from '../../design/primitives';
import { music as M } from '../../design/tokens';
import { Txt } from '../../design/Txt';
import { useMusic } from './musicContext';
import { OptionSheet } from './Menus';
import { useOverlay } from './pageui';
import { Chip } from './ui';

const t = copy.musicView;

type Option = { value: string; label: string };

/** A control that looks like the web's styled <select> and opens its choices as a sheet. */
export function SelectField({ label, value, options, onPick }: { label: string; value: string; options: Option[]; onPick: (value: string) => void }) {
  const overlay = useOverlay();
  const on = value !== '';
  const shown = on ? options.find((option) => option.value === value)?.label ?? label : label;
  const open = (): void => overlay.show(<OptionSheet title={label} value={value} options={[{ value: '', label }, ...options]} onPick={onPick} onClose={overlay.hide} />);
  return <Press onPress={open} label={`${label}: ${shown}`} hint="Opens a list" role="button"
    style={{ minHeight: 34, maxWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 10, borderWidth: 1, borderColor: on ? 'transparent' : M.line, borderRadius: 10, backgroundColor: on ? M.ink : M.surface }}>
    <Txt size={13} weight={600} lines={1} color={on ? M.accentInk : M.ink} style={{ flexShrink: 1 }}>{shown}</Txt>
    <ChevronDown size={12} color={on ? M.accentInk : M.chevron} strokeWidth={3} />
  </Press>;
}

/** Narrow songs by singer, film, language, genre, year, or by what you have liked. Each list shows how many songs it would leave. */
export function FilterBar({ filters, onChange }: { filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
  const music = useMusic();
  const counts = useMemo(() => facetCounts(music.index, filters, music.likes), [music.index, filters, music.likes]);
  const active = Object.values(filters).some((value) => value !== undefined && value !== false && value !== '');
  const set = (patch: Partial<SearchFilters>): void => onChange({ ...filters, ...patch });
  const singers = useMemo(() => music.index.artists.map((artist) => ({ value: artist.key, label: `${artist.name} (${artist.trackIds.length})` })).sort((left, right) => left.label.localeCompare(right.label)), [music.index.artists]);
  const films = useMemo(() => music.index.albums.map((album) => ({ value: album.id, label: `${album.name}${album.year ? ` (${album.year})` : ''}` })), [music.index.albums]);
  return <View accessibilityRole="toolbar" accessibilityLabel={t.filters} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    <SelectField label={t.filterSinger} value={filters.artist ?? ''} options={singers} onPick={(value) => set({ artist: value || undefined })} />
    <SelectField label={t.filterFilm} value={filters.albumId ?? ''} options={films} onPick={(value) => set({ albumId: value || undefined })} />
    {counts.languages.length > 0 ? <SelectField label={t.filterLanguage} value={filters.language ?? ''} options={counts.languages.map(([name, count]) => ({ value: name, label: `${name} (${count})` }))} onPick={(value) => set({ language: value || undefined })} /> : null}
    {counts.genres.length > 0 ? <SelectField label={t.filterGenre} value={filters.genre ?? ''} options={counts.genres.map(([name, count]) => ({ value: name, label: `${name} (${count})` }))} onPick={(value) => set({ genre: value || undefined })} /> : null}
    {counts.years.length > 0 ? <SelectField label={t.filterYear} value={filters.year === undefined ? '' : String(filters.year)} options={counts.years.map(([year, count]) => ({ value: String(year), label: `${year} (${count})` }))} onPick={(value) => set({ year: value ? Number(value) : undefined })} /> : null}
    <Chip icon={Heart} label={t.filterLiked} on={filters.liked === true} onPress={() => set({ liked: filters.liked ? undefined : true })} />
    {active ? <Chip icon={X} label={t.clearFilters} clear onPress={() => onChange({})} /> : null}
  </View>;
}
