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
  /** Базовый фактор: дни с ним и берём за точку отсчёта. */
  baseKey: string;
  /** Добавленный фактор: смотрим, что меняется, когда он тоже есть. */
  addedKey: string;
  /** Среднее настроение в дни, где есть оба фактора. */
  comboAvg: number;
  /** Среднее настроение в дни с базовым фактором, но БЕЗ добавленного. */
  baseAvg: number;
  /** comboAvg - baseAvg. */
  effect: number;
  count: number; // дней с обоими
  baseCount: number; // дней с базовым, но без добавленного
  confidence: Confidence;
}

const COMBO_MIN_SAMPLE = 4; // дней должно быть и в сочетании, и в базе
const MIN_COMBO_EFFECT = 0.4;
// Один и тот же фактор легко даёт десяток пар и забивает секцию собой —
// показываем его не больше двух раз.
const MAX_PER_FACTOR = 2;

/**
 * Что меняется, когда к одному фактору добавляется второй.
 *
 * Раньше здесь считалось "взаимодействие" — отклонение от суммы отдельных
 * эффектов. На практике это оказалось непригодно: шкала настроения
 * ограничена сверху, и у человека с сильным перекосом к хорошим оценкам
 * (61% "Отлично") сумма нескольких плюсовых факторов предсказывает
 * недостижимое значение. В итоге любое сочетание хороших факторов
 * механически выглядело "хуже ожидаемого", а любое сочетание плохих —
 * "лучше", независимо от содержания.
 *
 * Поэтому сравниваем не с моделью, а с самим собой: дни с фактором A и
 * добавленным B против дней с A, но без B. Обе стороны лежат в одной
 * области шкалы, потолок обе задевает одинаково, и формулировка получается
 * прямая: "в дни с Парком обычно 4.2, а вместе с Велопрогулкой — 3.9".
 *
 * Только пары: тройки и четвёрки на объёме личного дневника набирают
 * 6-10 дней, дают почти одинаковые пересекающиеся наборы и не заслуживают
 * доверия — проверено на реальных данных.
 */
export function computeComboPatterns(entries: DayEntry[]): ComboPattern[] {
  if (entries.length === 0) return [];

  const dayFactors = entries.map((e) => ({ mood: e.mood, factors: new Set(factorsOf(e)) }));

  const singleCount = new Map<string, number>();
  for (const d of dayFactors) {
    for (const f of d.factors) singleCount.set(f, (singleCount.get(f) ?? 0) + 1);
  }
  const eligible = [...singleCount.entries()]
    .filter(([, c]) => c >= MIN_SAMPLE * 2) // база и сочетание должны делиться
    .map(([f]) => f);

  const patterns: ComboPattern[] = [];
  for (const base of eligible) {
    for (const added of eligible) {
      if (base === added) continue;
      const withBoth: number[] = [];
      const baseOnly: number[] = [];
      for (const d of dayFactors) {
        if (!d.factors.has(base)) continue;
        (d.factors.has(added) ? withBoth : baseOnly).push(d.mood);
      }
      if (withBoth.length < COMBO_MIN_SAMPLE || baseOnly.length < COMBO_MIN_SAMPLE) continue;

      const comboAvg = withBoth.reduce((s, m) => s + m, 0) / withBoth.length;
      const baseAvg = baseOnly.reduce((s, m) => s + m, 0) / baseOnly.length;
      const effect = comboAvg - baseAvg;
      if (Math.abs(effect) < MIN_COMBO_EFFECT) continue;

      patterns.push({
        baseKey: base,
        addedKey: added,
        comboAvg,
        baseAvg,
        effect,
        count: withBoth.length,
        baseCount: baseOnly.length,
        confidence: confidenceFor(Math.min(withBoth.length, baseOnly.length)),
      });
    }
  }

  patterns.sort((a, b) => {
    const rankDiff = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
    if (rankDiff !== 0) return rankDiff;
    return Math.abs(b.effect) - Math.abs(a.effect);
  });

  // Пара (A,B) и пара (B,A) — это один и тот же факт, рассказанный с двух
  // сторон; оставляем ту версию, что попалась первой (то есть сильнейшую).
  const seenPair = new Set<string>();
  const perFactor = new Map<string, number>();
  const result: ComboPattern[] = [];
  for (const p of patterns) {
    const pairKey = [p.baseKey, p.addedKey].sort().join("|");
    if (seenPair.has(pairKey)) continue;
    const usedBase = perFactor.get(p.baseKey) ?? 0;
    const usedAdded = perFactor.get(p.addedKey) ?? 0;
    if (usedBase >= MAX_PER_FACTOR || usedAdded >= MAX_PER_FACTOR) continue;
    seenPair.add(pairKey);
    perFactor.set(p.baseKey, usedBase + 1);
    perFactor.set(p.addedKey, usedAdded + 1);
    result.push(p);
  }
  return result;
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

/**
 * Общий сдвиг настроения: последние N дней против всего, что было раньше.
 * Возвращаем только заметный сдвиг — разница в 0.1 подавалась как находка
 * ("3.6 против 3.7") и выглядела пустой, хотя это просто шум.
 */
export function computeOverallShift(entries: DayEntry[], recentDays = 30): OverallShift | null {
  const cutoff = isoDaysAgo(recentDays);
  const recent = entries.filter((e) => e.date >= cutoff);
  const earlier = entries.filter((e) => e.date < cutoff);
  if (recent.length < 5 || earlier.length < 5) return null;
  const recentAvg = recent.reduce((s, e) => s + e.mood, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, e) => s + e.mood, 0) / earlier.length;
  if (Math.abs(recentAvg - earlierAvg) < MIN_SHIFT) return null;
  return {
    recentAvg,
    earlierAvg,
    shift: recentAvg - earlierAvg,
    recentCount: recent.length,
    earlierCount: earlier.length,
  };
}

// ---------- Недельный ритм ----------

export interface WeekdayRhythm {
  tagId: string;
  weekday: string;
  hits: number;
  total: number;
  rate: number;
  overallRate: number;
}

const RHYTHM_MIN_TAG = 10; // реже — не о чем говорить
const RHYTHM_MIN_WD_ENTRIES = 8; // день недели с горсткой записей не судим
const RHYTHM_PERMUTATIONS = 1000;
const RHYTHM_FDR = 0.1;

/**
 * Дни недели, в которые тег встречается заметно чаще обычного.
 *
 * Считаем частоту, а не настроение — принципиально. Проверка на реальных
 * данных показала, что корреляции настроения с чем угодно на дневнике в сотню
 * записей неотличимы от случайности (из 21 проверенной карточки порог прошли
 * две при ожидаемых по случайности ~одной), а вот частота тегов по дням
 * недели даёт устойчивый сигнал: у человека действительно есть недельный
 * ритм, и он переживает перемешивание.
 *
 * Значимость меряем перестановочным тестом: раскладываем те же самые дни по
 * дням недели случайно много раз и смотрим, часто ли случайность даёт такой
 * же перекос. Статистика — максимум отклонения по всем дням недели, поэтому
 * перебор семи дней учтён внутри теста. Перебор нескольких тегов внутрь не
 * входит, поэтому сверху накладываем поправку Бенджамини-Хохберга.
 */
export function computeWeekdayRhythms(entries: DayEntry[]): WeekdayRhythm[] {
  if (entries.length < 20) return [];

  const wdOf = (e: DayEntry) => new Date(e.date + "T12:00:00").getDay();
  const wdIdx = entries.map(wdOf);
  const perWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const i of wdIdx) perWeekday[i]++;

  const tagCounts = new Map<string, number>();
  for (const e of entries) {
    for (const id of new Set([...(e.places ?? []), ...(e.activities ?? [])])) {
      tagCounts.set(id, (tagCounts.get(id) ?? 0) + 1);
    }
  }
  const tags = [...tagCounts.entries()].filter(([, c]) => c >= RHYTHM_MIN_TAG).map(([id]) => id);
  if (tags.length === 0) return [];

  let seed = 20260903;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const candidates: { r: WeekdayRhythm; p: number }[] = [];

  for (const tagId of tags) {
    const flags = entries.map((e) =>
      [...(e.places ?? []), ...(e.activities ?? [])].includes(tagId)
    );
    const overallRate = flags.filter(Boolean).length / flags.length;

    const ratesOf = (f: boolean[]) => {
      const hits = [0, 0, 0, 0, 0, 0, 0];
      f.forEach((v, i) => { if (v) hits[wdIdx[i]]++; });
      return hits;
    };
    const statOf = (hits: number[]) =>
      hits.reduce((max, h, i) => {
        if (perWeekday[i] < RHYTHM_MIN_WD_ENTRIES) return max;
        return Math.max(max, Math.abs(h / perWeekday[i] - overallRate));
      }, 0);

    const hits = ratesOf(flags);
    const observed = statOf(hits);
    if (observed === 0) continue;

    const pool = [...flags];
    let ge = 0;
    for (let iter = 0; iter < RHYTHM_PERMUTATIONS; iter++) {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      if (statOf(ratesOf(pool)) >= observed) ge++;
    }
    const p = ge / RHYTHM_PERMUTATIONS;

    let best = -1;
    for (let d = 0; d < 7; d++) {
      if (perWeekday[d] < RHYTHM_MIN_WD_ENTRIES) continue;
      if (best === -1 || hits[d] / perWeekday[d] > hits[best] / perWeekday[best]) best = d;
    }
    if (best === -1) continue;
    const rate = hits[best] / perWeekday[best];
    if (rate <= overallRate) continue; // говорим только про «чаще», не про «реже»

    candidates.push({
      p,
      r: {
        tagId,
        weekday: WEEKDAY_NAMES[best],
        hits: hits[best],
        total: perWeekday[best],
        rate,
        overallRate,
      },
    });
  }

  // Бенджамини-Хохберг: без поправки на число проверенных тегов часть
  // "находок" была бы обычными ложными срабатываниями от самого перебора.
  candidates.sort((a, b) => a.p - b.p);
  const m = candidates.length;
  let cutoff = -1;
  candidates.forEach((c, i) => {
    if (c.p <= ((i + 1) / m) * RHYTHM_FDR) cutoff = i;
  });
  return candidates.slice(0, cutoff + 1).map((c) => c.r);
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
