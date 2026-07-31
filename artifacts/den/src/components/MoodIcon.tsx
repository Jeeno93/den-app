import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

// Стилизованные иконки настроения взамен системных emoji — форма и цвет
// согласованы с градиентом MOODS в MoodPicker.tsx (getMoodColor), чтобы
// календарь/воспоминания/пикер/виджет выглядели одинаково.
const FACES: Record<number, (color: string) => React.ReactNode> = {
  1: (c) => (
    <>
      <Circle cx="12" cy="14" r="1.6" fill={c} />
      <Circle cx="22" cy="14" r="1.6" fill={c} />
      <Path d="M11 23 Q17 18 23 23" stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  ),
  2: (c) => (
    <>
      <Circle cx="12" cy="14" r="1.6" fill={c} />
      <Circle cx="22" cy="14" r="1.6" fill={c} />
      <Path d="M11 22 L23 22" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  3: (c) => (
    <>
      <Circle cx="12" cy="14" r="1.7" fill={c} />
      <Circle cx="22" cy="14" r="1.7" fill={c} />
      <Path d="M11 20 Q17 26 23 20" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  ),
  4: (c) => (
    <>
      <Path d="M10 13 Q12 11 14 13" stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M20 13 Q22 11 24 13" stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M10 19 Q17 27 24 19" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  ),
  5: (c) => (
    <>
      <Path d="M8 15 Q11 11 14 15" stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d="M20 15 Q23 11 26 15" stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d="M9 20 Q17 30 25 20" stroke={c} strokeWidth={2.3} fill="none" strokeLinecap="round" />
      <Path d="M5 8 L6.5 5 L8 8" stroke={c} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Path d="M26 8 L27.5 5 L29 8" stroke={c} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </>
  ),
};

interface MoodIconProps {
  mood: number;
  color: string;
  size?: number;
  ringOpacity?: number;
}

export function MoodIcon({ mood, color, size = 28, ringOpacity = 1 }: MoodIconProps) {
  const face = FACES[mood] ?? FACES[3];
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Circle cx={17} cy={17} r={15} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={ringOpacity} />
      {face(color)}
    </Svg>
  );
}
