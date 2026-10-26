import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';

/** The same three families the web loads from Google Fonts, bundled so the app works with no network. */
export const fontAssets = {
  DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold,
  DMMono_400Regular, DMMono_500Medium,
  Fraunces_600SemiBold, Fraunces_700Bold,
};

export type Weight = 400 | 500 | 600 | 700 | 800;

/** DM Sans is loaded up to 700 on the web, so 800 renders as 700 there too. */
export function sansFamily(weight: Weight): string {
  if (weight >= 700) return 'DMSans_700Bold';
  if (weight >= 600) return 'DMSans_600SemiBold';
  if (weight >= 500) return 'DMSans_500Medium';
  return 'DMSans_400Regular';
}

export function monoFamily(weight: Weight): string {
  return weight >= 500 ? 'DMMono_500Medium' : 'DMMono_400Regular';
}

export function serifFamily(weight: Weight): string {
  return weight >= 700 ? 'Fraunces_700Bold' : 'Fraunces_600SemiBold';
}
