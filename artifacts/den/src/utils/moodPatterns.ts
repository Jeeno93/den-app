import type { DayEntry } from "@/src/storage/storage";

export type Confidence = "low" | "medium" | "high";

export interface MoodPattern {
  key: string;
  count: number;
  avgMood: number;
  delta: number; // avgMood - overall average, positive = ассоциируется с лучшим настроением
  confidence: Confidence;
}

// Меньше N дней с тегом/словом — разница слишком шумная, чтобы её показывать
// (день-два с хорошим настроением дадут "+2" на пустом месте).
const MIN_SAMPLE = 3;

// Confidence — та же идея, что у Daylio (Low/Medium/High): маленькая выборка
// не должна выглядеть так же убедительно, как большая, даже если дельта
// одинаковая на вид.
function confidenceFor(count: number): Confidence {
  if (count < 5) return "low";
  if (count < 10) return "medium";
  return "high";
}

function correlate(entries: DayEntry[], extractKeys: (entry: DayEntry) => string[]): MoodPattern[] {
  if (entries.length === 0) return [];

  const overallAvg = entries.reduce((sum, e) => sum + e.mood, 0) / entries.length;

  const byKey = new Map<string, number[]>();
  for (const entry of entries) {
    const keys = extractKeys(entry);
    for (const key of new Set(keys)) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(entry.mood);
    }
  }

  const patterns: MoodPattern[] = [];
  for (const [key, moods] of byKey) {
    if (moods.length < MIN_SAMPLE) continue;
    const avgMood = moods.reduce((sum, m) => sum + m, 0) / moods.length;
    patterns.push({
      key,
      count: moods.length,
      avgMood,
      delta: avgMood - overallAvg,
      confidence: confidenceFor(moods.length),
    });
  }

  return patterns.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * Корреляция настроения с тегами мест/активностей — тот же приём, что
 * делает мод-трекинг в Daylio полезным уже в первые недели: не нужен
 * текстовый AI-анализ, чтобы заметить "в дни с игрой настроение выше".
 */
export function computeMoodPatterns(entries: DayEntry[]): MoodPattern[] {
  return correlate(entries, (entry) => [...(entry.places ?? []), ...(entry.activities ?? [])]);
}

const WEEKDAY_NAMES = [
  "Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота",
];

/**
 * Корреляция настроения с днём недели — работает для всех с первого дня,
 * в отличие от тегов/слов: не требует, чтобы человек вообще что-то
 * дополнительно заполнял, только сам факт даты записи.
 */
export function computeWeekdayPatterns(entries: DayEntry[]): MoodPattern[] {
  return correlate(entries, (entry) => {
    const d = new Date(entry.date + "T12:00:00");
    return [WEEKDAY_NAMES[d.getDay()]];
  });
}

// Частые русские служебные слова — отфильтровываем, иначе они забивают
// частотный список и никакой реальной корреляции за ними нет.
const STOPWORDS = new Set([
  "и","в","во","не","что","он","на","я","с","со","как","а","то","все","она","так","его","но",
  "да","ты","к","у","же","вы","за","бы","по","только","её","мне","было","вот","от","меня","ещё",
  "нет","о","из","ему","теперь","когда","даже","ну","вдруг","ли","если","уже","или","ни","быть",
  "был","него","до","вас","нибудь","опять","уж","вам","ведь","там","потом","себя","ничего","ей",
  "может","они","тут","где","есть","надо","ней","для","мы","тебя","их","чем","была","сам","чтоб",
  "без","будто","чего","раз","тоже","себе","под","будет","ж","тогда","кто","этот","того","потому",
  "этого","какой","совсем","ним","здесь","этом","один","почти","мой","тем","чтобы","нее","сейчас",
  "были","куда","зачем","всех","никогда","можно","при","наконец","два","об","другой","хоть","после",
  "над","больше","тот","через","эти","нас","про","всего","них","какая","много","разве","три","эту",
  "моя","впрочем","хорошо","свою","этой","перед","иногда","лучше","чуть","том","нельзя","такой",
  "им","более","всегда","конечно","всю","между","это","эта","тебе","твой","твоя","свой","свои",
  "мои","наш","наша","наши","ваш","ваша","ваши","сегодня","вчера","завтра","день","дня","стало",
  "стал","стала","очень","просто","какие","этими","этих","всё","всё-таки","всё-же","было","будем",
  "буду","будешь","самый","самая","самое","самые","мой","моё",
]);

/**
 * Разбор свободного текста ответов на предмет часто повторяющихся слов,
 * скоррелированных с настроением — по явному запросу пользователя решено
 * делать локально, без ИИ и без отправки текста куда-либо: простая частота
 * слов, та же математика correlate(), что и для тегов/дней недели.
 *
 * Без стемминга: "устал"/"устала"/"уставший" считаются разными словами.
 * Осознанный компромисс за простоту и предсказуемость — стемминг для
 * русского легко даёт мусорные обрубки слов, которые выглядели бы странно
 * прямо в интерфейсе.
 */
function extractWords(entry: DayEntry): string[] {
  const parts = [
    entry.answers?.learned,
    entry.answers?.met,
    entry.answers?.positive?.answer,
    entry.answers?.negative?.answer,
    entry.answers?.dayQuestion,
    entry.notes,
    entry.proud,
  ];
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  const words = text.match(/[а-яё]+/g) ?? [];
  return words.filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

export function computeKeywordPatterns(entries: DayEntry[]): MoodPattern[] {
  return correlate(entries, extractWords);
}
