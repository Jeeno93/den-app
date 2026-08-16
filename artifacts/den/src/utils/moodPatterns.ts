import type { DayEntry } from "@/src/storage/storage";

export interface MoodPattern {
  tag: string;
  count: number;
  avgMood: number;
  delta: number; // avgMood - overall average, positive = ассоциируется с лучшим настроением
}

// Меньше N дней с тегом — разница слишком шумная, чтобы её показывать
// (день-два с хорошим настроением дадут "+2" на пустом месте).
const MIN_SAMPLE = 3;

/**
 * Средняя разница настроения в дни с конкретным тегом активности/места
 * против общего среднего — тот же приём, что делает мод-трекинг в Daylio
 * полезным уже в первые недели: не нужен текстовый AI-анализ, чтобы
 * заметить "в дни с игрой настроение выше".
 */
export function computeMoodPatterns(entries: DayEntry[]): MoodPattern[] {
  if (entries.length === 0) return [];

  const overallAvg = entries.reduce((sum, e) => sum + e.mood, 0) / entries.length;

  const byTag = new Map<string, number[]>();
  for (const entry of entries) {
    const tags = [...(entry.places ?? []), ...(entry.activities ?? [])];
    for (const tag of new Set(tags)) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(entry.mood);
    }
  }

  const patterns: MoodPattern[] = [];
  for (const [tag, moods] of byTag) {
    if (moods.length < MIN_SAMPLE) continue;
    const avgMood = moods.reduce((sum, m) => sum + m, 0) / moods.length;
    patterns.push({ tag, count: moods.length, avgMood, delta: avgMood - overallAvg });
  }

  return patterns.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
