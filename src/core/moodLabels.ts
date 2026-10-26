import { content as copy } from './content';
import type { MoodId } from './musicModel';

const t = copy.musicView;

export const MOOD_LABEL: Record<MoodId, string> = { energise: t.moodEnergise, relax: t.moodRelax, workout: t.moodWorkout, commute: t.moodCommute, focus: t.moodFocus };
