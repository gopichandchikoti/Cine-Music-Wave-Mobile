import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { monoFamily, sansFamily, serifFamily, type Weight } from './fonts';
import { music } from './tokens';

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

/** Text for surfaces that sit on video or posters and stay dark in both themes: white unless told otherwise. */
export function DarkTxt({ color = '#ffffff', ...rest }: TxtProps) {
  return <Txt color={color} {...rest} />;
}

/** Text with the web app's fonts. Size, weight and spacing use the same numbers as the CSS. Unless told otherwise it takes the theme's text colour. */
export function Txt({ size = 14, weight = 400, family = 'sans', color = music.text, ls, lh, upper, num, align, lines, style, ...rest }: TxtProps) {
  const fontFamily = family === 'mono' ? monoFamily(weight) : family === 'serif' ? serifFamily(weight) : sansFamily(weight);
  return <Text
    {...rest}
    numberOfLines={lines}
    ellipsizeMode="tail"
    maxFontSizeMultiplier={1.25}
    style={[{ fontFamily, fontSize: size, color, includeFontPadding: false }, ls !== undefined && { letterSpacing: ls * size }, lh !== undefined && { lineHeight: lh * size }, upper && { textTransform: 'uppercase' }, num && { fontVariant: ['tabular-nums'] }, align && { textAlign: align }, style]}
  />;
}
