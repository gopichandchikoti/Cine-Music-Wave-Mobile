import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';
import { content as copy } from '../../core/content';
import { paper as P } from '../../design/tokens';
import { Txt } from '../../design/Txt';

/** The friendly mascot from the web's sign-in page (its idle pose). Decorative only. */
export function AuthMascot({ width }: { width: number }) {
  const fill = '#c69f77';
  const stroke = '#75573e';
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, alignSelf: 'center', alignItems: 'center', marginTop: 20 }}>
    <Svg viewBox="0 0 300 300" width={width} height={width}>
      <Ellipse cx={150} cy={264} rx={92} ry={13} fill={P.line} />
      <Path d="M77 262v-51c0-58 146-58 146 0v51" fill={fill} stroke={stroke} strokeWidth={2} />
      <Circle cx={74} cy={74} r={32} fill={fill} stroke={stroke} strokeWidth={2} />
      <Circle cx={226} cy={74} r={32} fill={fill} stroke={stroke} strokeWidth={2} />
      <Circle cx={74} cy={74} r={19} fill="#eedac3" />
      <Circle cx={226} cy={74} r={19} fill="#eedac3" />
      <Rect x={54} y={55} width={192} height={162} rx={78} fill={fill} stroke={stroke} strokeWidth={2} />
      <Ellipse cx={150} cy={159} rx={43} ry={32} fill="#eedac3" />
      <G fill="#3c342c"><Ellipse cx={111} cy={125} rx={6} ry={8} /><Ellipse cx={189} cy={125} rx={6} ry={8} /></G>
      <Path d="M139 150q11-9 22 0l-11 12z" fill="#3c342c" />
      <Path d="M137 171q13 14 26 0" fill="none" stroke="#3c342c" strokeWidth={4} strokeLinecap="round" />
      <Circle cx={91} cy={155} r={12} fill="#e4a398" opacity={0.6} />
      <Circle cx={209} cy={155} r={12} fill="#e4a398" opacity={0.6} />
      <Path d="M109 216q22-8 41 4q19-12 41-4v43q-21-8-41 3q-20-11-41-3z" fill={P.teal} stroke={P.paper} strokeWidth={3} />
      <Path d="M150 221v38" stroke={P.paper} strokeWidth={2} />
      <Ellipse cx={76} cy={220} rx={22} ry={30} fill={fill} stroke={stroke} strokeWidth={2} />
      <Ellipse cx={224} cy={220} rx={22} ry={30} fill={fill} stroke={stroke} strokeWidth={2} />
    </Svg>
    <Txt family="mono" size={11} color={P.muted}>{copy.authMascot.aLittleSpaceForACuriousMind}</Txt>
  </View>;
}
