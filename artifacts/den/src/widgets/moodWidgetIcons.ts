// Те же формы лиц, что и в src/components/MoodIcon.tsx, но как сырая строка
// SVG-разметки — виджет рендерится нативным RemoteViews, а не деревом
// react-native-svg, поэтому SvgWidget принимает готовую XML-строку, а не JSX.
const FACE_PATHS: Record<number, (c: string) => string> = {
  1: (c) => `
    <circle cx="12" cy="14" r="1.6" fill="${c}" />
    <circle cx="22" cy="14" r="1.6" fill="${c}" />
    <path d="M11 23 Q17 18 23 23" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round" />
  `,
  2: (c) => `
    <circle cx="12" cy="14" r="1.6" fill="${c}" />
    <circle cx="22" cy="14" r="1.6" fill="${c}" />
    <path d="M11 22 L23 22" stroke="${c}" stroke-width="1.8" stroke-linecap="round" />
  `,
  3: (c) => `
    <circle cx="12" cy="14" r="1.7" fill="${c}" />
    <circle cx="22" cy="14" r="1.7" fill="${c}" />
    <path d="M11 20 Q17 26 23 20" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" />
  `,
  4: (c) => `
    <path d="M10 13 Q12 11 14 13" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" />
    <path d="M20 13 Q22 11 24 13" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" />
    <path d="M10 19 Q17 27 24 19" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" />
  `,
  5: (c) => `
    <path d="M8 15 Q11 11 14 15" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round" />
    <path d="M20 15 Q23 11 26 15" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round" />
    <path d="M9 20 Q17 30 25 20" stroke="${c}" stroke-width="2.3" fill="none" stroke-linecap="round" />
    <path d="M5 8 L6.5 5 L8 8" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round" />
    <path d="M26 8 L27.5 5 L29 8" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round" />
  `,
};

export function moodSvgString(mood: number, color: string): string {
  const face = FACE_PATHS[mood]?.(color) ?? FACE_PATHS[3](color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="none" stroke="${color}" stroke-width="1.5" />${face}</svg>`;
}
