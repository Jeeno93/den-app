import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QuestionAnswer {
  question: string;
  answer: string;
  category: "positive" | "negative";
}

export interface DayAnswers {
  learned: string;
  met: string;
  positive: QuestionAnswer;
  negative: QuestionAnswer;
  dayQuestion: string;
}

export interface DayEntry {
  date: string;
  mood: number;
  answers: DayAnswers;
  question: string;
  notes: string;
  photos: string[];
  proud: string;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function keyForDate(date: string): string {
  return `day_${date}`;
}

function parseEntry(raw: string | null, key: string): DayEntry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;

    // backward compat: photos
    if (!parsed.photos) {
      parsed.photos = parsed.photo ? [parsed.photo] : [];
    }
    // backward compat: proud
    if (parsed.proud === undefined || parsed.proud === null) {
      parsed.proud = "";
    }

    // backward compat: laughed/annoyed → positive/negative QuestionAnswer
    const a = parsed.answers;
    if (a && !a.positive) {
      a.positive = {
        question: "Что рассмешило?",
        answer: a.laughed ?? "",
        category: "positive",
      };
    }
    if (a && !a.negative) {
      a.negative = {
        question: "Что раздражало?",
        answer: a.annoyed ?? "",
        category: "negative",
      };
    }

    console.log(`[storage] parsed ${key}:`, JSON.stringify(parsed).slice(0, 120));
    return parsed as DayEntry;
  } catch (err) {
    console.error(`[storage] JSON.parse failed for key "${key}":`, err, "raw:", raw?.slice(0, 100));
    return null;
  }
}

export async function saveDay(date: string, data: DayEntry): Promise<void> {
  const key = keyForDate(date);
  console.log(`[storage] saveDay key="${key}" date="${date}"`);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
    console.log(`[storage] saveDay success key="${key}"`);
  } catch (err) {
    console.error(`[storage] saveDay failed key="${key}":`, err);
    throw err;
  }
}

export async function getDay(date: string): Promise<DayEntry | null> {
  const key = keyForDate(date);
  console.log(`[storage] getDay key="${key}"`);
  try {
    const raw = await AsyncStorage.getItem(key);
    console.log(`[storage] getDay raw for "${key}": ${raw ? raw.slice(0, 80) + "…" : "null"}`);
    return parseEntry(raw, key);
  } catch (err) {
    console.error(`[storage] getDay failed key="${key}":`, err);
    return null;
  }
}

export async function getAllDays(): Promise<DayEntry[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`[storage] getAllKeys total=${allKeys.length} keys:`, JSON.stringify(allKeys));

    const dayKeys = (allKeys as string[]).filter((k) => k.startsWith("day_"));
    console.log(`[storage] day_ keys (${dayKeys.length}):`, JSON.stringify(dayKeys));

    if (dayKeys.length === 0) return [];

    const pairs = await AsyncStorage.multiGet(dayKeys);
    const results: DayEntry[] = [];
    for (const [key, val] of pairs) {
      const entry = parseEntry(val, key);
      if (entry) results.push(entry);
    }

    results.sort((a, b) => b.date.localeCompare(a.date));
    console.log(`[storage] getAllDays returning ${results.length} entries`);
    return results;
  } catch (err) {
    console.error(`[storage] getAllDays failed:`, err);
    return [];
  }
}

export async function getDiagnostics(): Promise<{
  totalKeys: number;
  dayKeys: string[];
  lastEntryRaw: string | null;
  lastEntryKey: string | null;
}> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const dayKeys = (allKeys as string[])
      .filter((k) => k.startsWith("day_"))
      .sort()
      .reverse();

    let lastEntryRaw: string | null = null;
    let lastEntryKey: string | null = null;

    if (dayKeys.length > 0) {
      lastEntryKey = dayKeys[0];
      lastEntryRaw = await AsyncStorage.getItem(lastEntryKey);
    }

    return { totalKeys: allKeys.length, dayKeys, lastEntryRaw, lastEntryKey };
  } catch (err) {
    console.error("[storage] getDiagnostics failed:", err);
    return { totalKeys: 0, dayKeys: [], lastEntryRaw: null, lastEntryKey: null };
  }
}

export async function getStreak(): Promise<{ current: number; best: number }> {
  const all = await getAllDays();
  if (all.length === 0) return { current: 0, best: 0 };

  const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));
  const today = formatDate(new Date());

  function daysBetween(dateStrA: string, dateStrB: string): number {
    const a = new Date(dateStrA + "T12:00:00");
    const b = new Date(dateStrB + "T12:00:00");
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  let best = 1;
  let streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff = daysBetween(sorted[i - 1].date, sorted[i].date);
    if (diff === 1) {
      streak++;
    } else {
      if (streak > best) best = streak;
      streak = 1;
    }
  }
  if (streak > best) best = streak;

  const lastDate = sorted[sorted.length - 1].date;
  const diffFromToday = daysBetween(lastDate, today);

  let current = 0;
  if (diffFromToday <= 1) {
    let tempStreak = 1;
    for (let i = sorted.length - 1; i > 0; i--) {
      const diff = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (diff === 1) {
        tempStreak++;
      } else {
        break;
      }
    }
    current = tempStreak;
  }

  return { current, best };
}
