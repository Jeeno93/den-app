export type IntensityValue = 1 | 2 | 3 | null;
export type IntensityKey = "learned" | "met" | "positive" | "negative" | "proud";

export interface IntensityTag {
  value: 1 | 2 | 3;
  emoji: string;
  label: string;
}

export interface IntensityConfig {
  title: string;
  tags: [IntensityTag, IntensityTag, IntensityTag];
}

export const INTENSITY_CONFIGS: Record<IntensityKey, IntensityConfig> = {
  learned: {
    title: "Яркость открытия",
    tags: [
      { value: 1, emoji: "🌱", label: "Интересно" },
      { value: 2, emoji: "💡", label: "Важно" },
      { value: 3, emoji: "🌟", label: "Изменило взгляд" },
    ],
  },
  met: {
    title: "Важность человека",
    tags: [
      { value: 1, emoji: "👋", label: "Знакомый" },
      { value: 2, emoji: "🤝", label: "Близкий" },
      { value: 3, emoji: "❤️", label: "Очень важный" },
    ],
  },
  positive: {
    title: "Яркость эмоции",
    tags: [
      { value: 1, emoji: "🙂", label: "Приятно" },
      { value: 2, emoji: "😊", label: "Радостно" },
      { value: 3, emoji: "🤩", label: "Незабываемо" },
    ],
  },
  negative: {
    title: "Яркость эмоции",
    tags: [
      { value: 1, emoji: "😕", label: "Немного" },
      { value: 2, emoji: "😔", label: "Ощутимо" },
      { value: 3, emoji: "😤", label: "Очень сильно" },
    ],
  },
  proud: {
    title: "Масштаб достижения",
    tags: [
      { value: 1, emoji: "✅", label: "Маленькая победа" },
      { value: 2, emoji: "🏆", label: "Хорошо сделал" },
      { value: 3, emoji: "🚀", label: "Горжусь собой" },
    ],
  },
};
