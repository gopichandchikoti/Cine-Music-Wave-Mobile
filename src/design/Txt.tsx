import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { monoFamily, sansFamily, serifFamily, type Weight } from './fonts';

export type TxtProps = TextProps & {
  size?: number;
  weight?: Weight;
  family?: 'sans' | 'mono' | 'serif';
  color?: string;
  /** letter-spacing in em, like the web CSS */
  ls?: number;
  /** unitless line-height multiplier, like the web CSS */
  lh?: number;
  upper?: boolean;
  /** font-variant-numeric: tabular-nums */
  num?: boolean;
  align?: TextStyle['textAlign'];
  lines?: number;
  style?: StyleProp<TextStyle>;
};

/** Text with the web app's fonts. Size, weight and spacing use the same numbers as the CSS. */
export function Txt({ size = 14, weight = 400, family = 'sans', color = '#fff', ls, lh, upper, num, align, lines, style, ...rest }: TxtProps) {
  const fontFamily = family === 'mono' ? monoFamily(weight) : family === 'serif' ? serifFamily(weight) : sansFamily(weight);
  return <Text
    {...rest}
    numberOfLines={lines}
    ellipsizeMode="tail"
    maxFontSizeMultiplier={1.25}
    style={[{ fontFamily, fontSize: size, color, includeFontPadding: false }, ls !== undefined && { letterSpacing: ls * size }, lh !== undefined && { lineHeight: lh * size }, upper && { textTransform: 'uppercase' }, num && { fontVariant: ['tabular-nums'] }, align && { textAlign: align }, style]}
  />;
}
