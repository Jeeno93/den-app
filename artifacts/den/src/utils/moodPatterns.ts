import type { DayEntry } from "@/src/storage/storage";

export type Confidence = "low" | "medium" | "high";

export interface MoodPattern {
  key: string;
  count: number;
  avgMood: number;
  delta: number; // avgMood - overall average, positive = ассоциируется с лучшим настроением
  // Доля дней в группе с оценкой >= HIGH_THRESHOLD и её разница с общей долей.
  // Шкала настроения дискретная (1-5), и часть людей почти всегда ставит одну
  // и ту же отметку (например, 4) — на таких данных средняя дельта плохо
  // видна, а доля "хороших" дней остаётся информативной и интуитивной.
  highShare: number; // 0..1
  highShareDelta: number; // highShare - общая доля, в долях (не в п.п.)
  confidence: Confidence;
}

// Меньше N дней с тегом/словом — разница слишком шумная, чтобы её показывать
// (день-два с хорошим настроением дадут "+2" на пустом месте).
const MIN_SAMPLE = 3;
// Свободный текст шумнее тегов: одно и то же слово может всплыть в
// совершенно не связанных по смыслу записях, поэтому для слов порог выше.
const MIN_SAMPLE_WORDS = 5;

// Оценки 4 и 5 ("Отлично"/"Супер", см. MoodPicker) — верхняя половина шкалы.
const HIGH_THRESHOLD = 4;

// Confidence — та же идея, что у Daylio (Low/Medium/High): маленькая выборка
// не должна выглядеть так же убедительно, как большая, даже если дельта
// одинаковая на вид.
function confidenceFor(count: number): Confidence {
  if (count < 5) return "low";
  if (count < 10) return "medium";
  return "high";
}

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

function correlate(
  entries: DayEntry[],
  extractKeys: (entry: DayEntry) => string[],
  minSample: number = MIN_SAMPLE
): MoodPattern[] {
  if (entries.length === 0) return [];

  const overallAvg = entries.reduce((sum, e) => sum + e.mood, 0) / entries.length;
  const overallHighShare = entries.filter((e) => e.mood >= HIGH_THRESHOLD).length / entries.length;

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
    if (moods.length < minSample) continue;
    const avgMood = moods.reduce((sum, m) => sum + m, 0) / moods.length;
    const highShare = moods.filter((m) => m >= HIGH_THRESHOLD).length / moods.length;
    patterns.push({
      key,
      count: moods.length,
      avgMood,
      delta: avgMood - overallAvg,
      highShare,
      highShareDelta: highShare - overallHighShare,
      confidence: confidenceFor(moods.length),
    });
  }

  // Сначала по уверенности (high → low), и только внутри группы — по силе
  // эффекта. Раньше сортировали чисто по |delta|, а маленькие выборки почти
  // всегда дают более "эффектные" на вид отклонения просто из-за дисперсии —
  // получалось, что самый шумный результат систематически оказывался сверху.
  return patterns.sort((a, b) => {
    const rankDiff = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
    if (rankDiff !== 0) return rankDiff;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });
}

/**
 * Корреляция настроения с тегами мест/активностей — тот же приём, что
 * делает мод-трекинг в Daylio полезным уже в первые недели: не нужен
 * текстовый AI-анализ, чтобы заметить "в дни с игрой настроение выше".
 */
export function computeMoodPatterns(entries: DayEntry[]): MoodPattern[] {
  return correlate(entries, (entry) => [...(entry.places ?? []), ...(entry.activities ?? [])]);
}

export const WEEKDAY_NAMES = [
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

/**
 * Корреляция настроения с самим фактом ответа на вопросы "Кого встретил
 * или вспомнил?" и "Что сегодня узнал?" — не разбираем текст ответа, только
 * заполнен он или нет. Поведенческий сигнал ("в этот день было что записать
 * про людей/открытия"), а не тег — чище, чем ковырять свободный текст.
 */
export function computeEngagementPatterns(entries: DayEntry[]): MoodPattern[] {
  return correlate(entries, (entry) => {
    const keys: string[] = [];
    if (entry.answers?.met?.trim()) keys.push("met");
    if (entry.answers?.learned?.trim()) keys.push("learned");
    return keys;
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
  // Местоимения-квантификаторы без собственного смысла ("многих людей",
  // "среди других") — раньше проходили фильтр и всплывали в списке как
  // будто это осмысленные темы, хотя это чистая грамматика.
  "многих","многие","многим","многого","многому","многом","многое",
  "других","другого","другому","другом","другую","другие","другим","другими",
  "которых","которого","которому","котором","которую","которые","которым","которая","которое",
  "своих","своим","своими","некоторых","некоторые","некоторым","некоторое",
  // Слова-смягчители и общие оценки без содержания ("немного устал",
  // "нормально прошло") — формально проходят порог частоты, но никакой темы
  // за ними нет, только манера речи. Всплывали в реальных данных наверху
  // списка и вытесняли осмысленные слова.
  "немного","немало","нормально","нормальный","нормальная","нормальное","нормальные",
  "довольно","достаточно","вроде","типа","короче","вообще","обычно","похоже","кажется",
  "какой-то","какая-то","какое-то","какие-то","что-то","как-то","почему-то","кое-что",
  "полностью","абсолютно","реально","действительно","точно","наверное","возможно",
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
  return correlate(entries, extractWords, MIN_SAMPLE_WORDS);
}

// ---------- Сочетания факторов ----------

/**
 * Все факторы одного дня в едином пространстве имён: теги, день недели и
 * факт ответа на "глубокие" вопросы. Нужно, чтобы сочетания могли
 * пересекать разные типы ("Офис + среда"), а не только теги между собой.
 */
export function factorsOf(entry: DayEntry): string[] {
  const out: string[] = [];
  for (const id of [...(entry.places ?? []), ...(entry.activities ?? [])]) out.push(`tag:${id}`);
  const d = new Date(entry.date + "T12:00:00");
  out.push(`wd:${WEEKDAY_NAMES[d.getDay()]}`);
  if (entry.answers?.met?.trim()) out.push("eng:met");
  if (entry.answers?.learned?.trim()) out.push("eng:learned");
  return out;
}

export interface ComboPattern {
  keys: string[];
  count: number;
  avgMood: number;
  /** Настроение, предсказанное сложением отдельных эффектов факторов. */
  expected: number;
  /** avgMood - expected: насколько вместе получается не так, как порознь. */
  interaction: number;
  confidence: Confidence;
}

// Чем больше факторов в сочетании, тем больше таких сочетаний вообще
// существует — и тем выше шанс, что какое-то из них "выстрелит" случайно.
// Поэтому порог по количеству дней растёт вместе с размером сочетания.
const COMBO_MIN_SAMPLE: Record<number, number> = { 2: 4, 3: 6, 4: 8 };
// Если фактическое почти совпало с предсказанным сложением — сочетание
// ничего нового не сообщает, это просто "оба фактора сработали как обычно".
const MIN_INTERACTION = 0.3;

function kCombinations<T>(items: T[], k: number): T[][] {
  if (k > items.length) return [];
  if (k === 1) return items.map((it) => [it]);
  const out: T[][] = [];
  for (let i = 0; i <= items.length - k; i++) {
    for (const rest of kCombinations(items.slice(i + 1), k - 1)) {
      out.push([items[i], ...rest]);
    }
  }
  return out;
}

/**
 * Сочетания факторов, которые ведут себя не так, как сумма их частей.
 *
 * Считаем не среднее по комбинации (оно в основном пересказывало бы
 * отдельные эффекты: "офис в минусе и среда в минусе, значит и вместе
 * в минусе"), а взаимодействие — разницу между фактическим настроением
 * таких дней и предсказанным простым сложением отдельных эффектов.
 * Показываем только заметные расхождения: именно они и есть то, чего
 * не видно в одномерных карточках.
 */
export function computeComboPatterns(entries: DayEntry[], maxK = 4): ComboPattern[] {
  if (entries.length === 0) return [];

  const overallAvg = entries.reduce((sum, e) => sum + e.mood, 0) / entries.length;

  const single = new Map<string, number[]>();
  for (const entry of entries) {
    for (const f of new Set(factorsOf(entry))) {
      if (!single.has(f)) single.set(f, []);
      single.get(f)!.push(entry.mood);
    }
  }

  // В сочетания пускаем только факторы, которые сами по себе набрали
  // достаточно дней — иначе редкий тег протащил бы шум внутрь комбинации.
  const deltaOf = new Map<string, number>();
  for (const [key, moods] of single) {
    if (moods.length < MIN_SAMPLE) continue;
    deltaOf.set(key, moods.reduce((s, m) => s + m, 0) / moods.length - overallAvg);
  }

  const comboMoods = new Map<string, number[]>();
  for (const entry of entries) {
    const factors = [...new Set(factorsOf(entry))].filter((f) => deltaOf.has(f)).sort();
    for (let k = 2; k <= Math.min(maxK, factors.length); k++) {
      for (const combo of kCombinations(factors, k)) {
        const key = combo.join("|");
        if (!comboMoods.has(key)) comboMoods.set(key, []);
        comboMoods.get(key)!.push(entry.mood);
      }
    }
  }

  const patterns: ComboPattern[] = [];
  for (const [key, moods] of comboMoods) {
    const keys = key.split("|");
    if (moods.length < (COMBO_MIN_SAMPLE[keys.length] ?? 8)) continue;
    const avgMood = moods.reduce((s, m) => s + m, 0) / moods.length;
    const expected = overallAvg + keys.reduce((s, k) => s + (deltaOf.get(k) ?? 0), 0);
    const interaction = avgMood - expected;
    if (Math.abs(interaction) < MIN_INTERACTION) continue;
    patterns.push({
      keys,
      count: moods.length,
      avgMood,
      expected,
      interaction,
      confidence: confidenceFor(moods.length),
    });
  }

  return patterns.sort((a, b) => {
    const rankDiff = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
    if (rankDiff !== 0) return rankDiff;
    return Math.abs(b.interaction) - Math.abs(a.interaction);
  });
}

// ---------- Динамика во времени ----------

export interface FactorShift {
  key: string;
  recentAvg: number;
  earlierAvg: number;
  shift: number; // recentAvg - earlierAvg
  recentCount: number;
  earlierCount: number;
  confidence: Confidence;
}

const MIN_SHIFT = 0.4;
const MIN_HALF_SAMPLE = 3;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Как изменился эффект фактора со временем: последние N дней против всего,
 * что было раньше. Часто интереснее самого паттерна — "парк всегда был
 * нейтральным, а последний месяц стабильно вытягивает день" это уже
 * новость, а не подтверждение известного.
 */
export function computeFactorShifts(entries: DayEntry[], recentDays = 30): FactorShift[] {
  const cutoff = isoDaysAgo(recentDays);
  const recent = entries.filter((e) => e.date >= cutoff);
  const earlier = entries.filter((e) => e.date < cutoff);
  if (recent.length < 5 || earlier.length < 5) return [];

  function byFactor(list: DayEntry[]): Map<string, number[]> {
    const map = new Map<string, number[]>();
    for (const entry of list) {
      for (const f of new Set(factorsOf(entry))) {
        if (!map.has(f)) map.set(f, []);
        map.get(f)!.push(entry.mood);
      }
    }
    return map;
  }

  const recentMap = byFactor(recent);
  const earlierMap = byFactor(earlier);

  const shifts: FactorShift[] = [];
  for (const [key, recentMoods] of recentMap) {
    const earlierMoods = earlierMap.get(key);
    if (!earlierMoods) continue;
    if (recentMoods.length < MIN_HALF_SAMPLE || earlierMoods.length < MIN_HALF_SAMPLE) continue;
    const recentAvg = recentMoods.reduce((s, m) => s + m, 0) / recentMoods.length;
    const earlierAvg = earlierMoods.reduce((s, m) => s + m, 0) / earlierMoods.length;
    const shift = recentAvg - earlierAvg;
    if (Math.abs(shift) < MIN_SHIFT) continue;
    shifts.push({
      key,
      recentAvg,
      earlierAvg,
      shift,
      recentCount: recentMoods.length,
      earlierCount: earlierMoods.length,
      // Уверенность по меньшей из двух половин: сравнение не крепче
      // своей слабой стороны.
      confidence: confidenceFor(Math.min(recentMoods.length, earlierMoods.length)),
    });
  }

  return shifts.sort((a, b) => {
    const rankDiff = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
    if (rankDiff !== 0) return rankDiff;
    return Math.abs(b.shift) - Math.abs(a.shift);
  });
}

export interface OverallShift {
  recentAvg: number;
  earlierAvg: number;
  shift: number;
  recentCount: number;
  earlierCount: number;
}

/** Общий сдвиг настроения: последние N дней против всего, что было раньше. */
export function computeOverallShift(entries: DayEntry[], recentDays = 30): OverallShift | null {
  const cutoff = isoDaysAgo(recentDays);
  const recent = entries.filter((e) => e.date >= cutoff);
  const earlier = entries.filter((e) => e.date < cutoff);
  if (recent.length < 5 || earlier.length < 5) return null;
  const recentAvg = recent.reduce((s, e) => s + e.mood, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, e) => s + e.mood, 0) / earlier.length;
  return {
    recentAvg,
    earlierAvg,
    shift: recentAvg - earlierAvg,
    recentCount: recent.length,
    earlierCount: earlier.length,
  };
}

/** Распределение оценок настроения 1..5 — сколько записей на каждую отметку. */
export function computeMoodDistribution(entries: DayEntry[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const e of entries) {
    if (e.mood >= 1 && e.mood <= 5) counts[e.mood - 1]++;
  }
  return counts;
}

export interface TagFrequency {
  id: string;
  count: number;
}

/** Частота тегов мест/активностей — сколько раз каждый встретился, без привязки к настроению. */
export function computeTagFrequency(entries: DayEntry[]): TagFrequency[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const id of [...(entry.places ?? []), ...(entry.activities ?? [])]) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
}
