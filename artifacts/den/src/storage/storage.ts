import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultPlaces, defaultActivities } from "@/src/data/defaultTags";
import { isInlinePhoto, persistInlinePhoto } from "@/src/utils/photoStorage";
import type { TagItem } from "@/src/data/defaultTags";

export type { TagItem };

export interface UserTags {
  places: TagItem[];
  activities: TagItem[];
}

const TAGS_KEY = "user_tags";

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

export type Intensity = 1 | 2 | 3 | null;

export type FillMode = "quick" | "standard" | "deep";

/** Sleep tracker data (режим «Глубоко»). Currently a structured stub. */
export interface SleepData {
  bedtime: string; // "23:30" or ""
  wakeTime: string; // "07:00" or ""
  quality: number | null; // 1-3
}

/** Habit tracker item (режим «Глубоко»). Currently a structured stub. */
export interface HabitItem {
  id: string;
  label: string;
  done: boolean;
}

/** Задача дня (режим «Глубоко»). Пишется вечером на следующий день. */
export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

export interface DayEntry {
  date: string;
  mood: number;
  answers: DayAnswers;
  question: string;
  notes: string;
  photos: string[];
  proud: string;
  learned_intensity: Intensity;
  met_intensity: Intensity;
  positive_intensity: Intensity;
  negative_intensity: Intensity;
  proud_intensity: Intensity;
  places: string[];
  activities: string[];
  // --- Optional: режимы заполнения (Быстро/Стандарт/Глубоко) ---
  fillMode?: FillMode;
  energy?: number | null; // уровень энергии 1-3 (Глубоко)
  sleep?: SleepData | null; // трекер сна (Глубоко)
  habits?: HabitItem[]; // трекер привычек — будущая фича (сохраняется для совместимости)
  tasksForTomorrow?: TaskItem[]; // до 3 задач, записанных вечером на следующий день (Глубоко)
  tasksReviewed?: TaskItem[]; // вчерашние задачи, отмеченные сегодня (Глубоко)
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
    // backward compat: places/activities
    if (!parsed.places) parsed.places = [];
    if (!parsed.activities) parsed.activities = [];
    // backward compat: intensity fields
    if (parsed.learned_intensity === undefined) parsed.learned_intensity = null;
    if (parsed.met_intensity === undefined) parsed.met_intensity = null;
    if (parsed.positive_intensity === undefined) parsed.positive_intensity = null;
    if (parsed.negative_intensity === undefined) parsed.negative_intensity = null;
    if (parsed.proud_intensity === undefined) parsed.proud_intensity = null;
    // backward compat: режимы заполнения (Глубоко)
    if (parsed.energy === undefined) parsed.energy = null;
    if (parsed.sleep === undefined) parsed.sleep = null;
    if (!Array.isArray(parsed.habits)) parsed.habits = [];
    if (!Array.isArray(parsed.tasksForTomorrow)) parsed.tasksForTomorrow = [];
    if (!Array.isArray(parsed.tasksReviewed)) parsed.tasksReviewed = [];

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

/**
 * One-time data migration that fixes "SQLITE_FULL (code 13)" on save.
 *
 * Storage here is AsyncStorage (key/value JSON blobs per day) — NOT a
 * relational table, so there are no columns to migrate. On Android,
 * AsyncStorage is backed by SQLite with a ~6MB cap (independent of free
 * device space). Older versions of the app stored captured photos as inline
 * base64 `data:` URIs inside each `day_*` blob; accumulated images eventually
 * fill the cap and every write fails with SQLITE_FULL.
 *
 * This relocates any inline base64 photos to the filesystem (keeping the
 * image — no data loss) and rewrites the entry with short `file://` paths.
 * Replacing a large value with a much smaller one nets free space, so the
 * rewrite typically succeeds even on a near-full DB (failures are logged and
 * retried on the next launch). Handles the legacy single-`photo` shape too.
 * Idempotent and safe to run on every launch; a no-op once entries are clean.
 */
export async function compactPhotoStorage(): Promise<void> {
  // Web has no filesystem, so photos must stay as data URIs there.
  if (Platform.OS === "web") return;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const dayKeys = (allKeys as string[]).filter((k) => k.startsWith("day_"));
    if (dayKeys.length === 0) return;

    let rewrote = 0;

    for (const key of dayKeys) {
      // Read fresh per key (not a bulk snapshot) so we operate on current data.
      const raw = await AsyncStorage.getItem(key);
      // Fast pre-filter: skip entries that cannot contain a base64 image.
      if (!raw || !raw.includes("data:")) continue;

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      // Normalize legacy shapes (mirror of parseEntry): some old entries store
      // a single `photo` string instead of a `photos` array.
      if (!Array.isArray(parsed.photos)) {
        parsed.photos = parsed.photo ? [parsed.photo] : [];
      }
      const photos: unknown[] = parsed.photos;
      if (!photos.some(isInlinePhoto)) continue;

      const migrated: string[] = [];
      for (const p of photos) {
        if (isInlinePhoto(p)) {
          try {
            migrated.push(await persistInlinePhoto(p));
          } catch (err) {
            // Keep the original on failure so no photo is ever lost.
            console.warn(`[storage] compact: keep inline photo in "${key}":`, err);
            migrated.push(p);
          }
        } else if (typeof p === "string") {
          migrated.push(p);
        }
      }
      parsed.photos = migrated;
      delete parsed.photo; // legacy singular field folded into photos[]

      // Optimistic concurrency guard: if the entry changed since we read it
      // (e.g. the user saved this day mid-migration), skip the rewrite so we
      // never clobber a newer save. It will be picked up on the next launch.
      const current = await AsyncStorage.getItem(key);
      if (current !== raw) {
        console.log(`[storage] compact: "${key}" changed during migration, skipping`);
        continue;
      }

      try {
        await AsyncStorage.setItem(key, JSON.stringify(parsed));
        rewrote++;
      } catch (err) {
        console.warn(`[storage] compact: rewrite failed for "${key}":`, err);
      }
    }

    if (rewrote > 0) {
      console.log(`[storage] compactPhotoStorage relocated photos in ${rewrote} entr${rewrote === 1 ? "y" : "ies"}`);
    }
  } catch (err) {
    console.warn("[storage] compactPhotoStorage failed (non-fatal):", err);
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

export async function getTags(): Promise<UserTags> {
  try {
    const raw = await AsyncStorage.getItem(TAGS_KEY);
    if (!raw) return { places: defaultPlaces, activities: defaultActivities };
    const parsed = JSON.parse(raw) as UserTags;
    return parsed;
  } catch {
    return { places: defaultPlaces, activities: defaultActivities };
  }
}

export async function saveTags(tags: UserTags): Promise<void> {
  await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}

export async function addCustomTag(
  type: "place" | "activity",
  label: string,
  emoji: string
): Promise<UserTags> {
  const tags = await getTags();
  const newTag: TagItem = { id: `custom_${Date.now()}`, label, emoji };
  const updated: UserTags = {
    places: type === "place" ? [...tags.places, newTag] : tags.places,
    activities: type === "activity" ? [...tags.activities, newTag] : tags.activities,
  };
  await saveTags(updated);
  return updated;
}

export async function deleteTag(type: "place" | "activity", id: string): Promise<UserTags> {
  const tags = await getTags();
  const updated: UserTags = {
    places: type === "place" ? tags.places.filter((t) => t.id !== id) : tags.places,
    activities: type === "activity" ? tags.activities.filter((t) => t.id !== id) : tags.activities,
  };
  await saveTags(updated);
  return updated;
}

const FILL_MODE_KEY = "fill_mode";
const NUDGE_DEEP_KEY = "nudge_deep_dismissed";

function isValidFillMode(v: unknown): v is FillMode {
  return v === "quick" || v === "standard" || v === "deep";
}

/** Последний выбранный режим заполнения. По умолчанию «Стандарт». */
export async function getFillMode(): Promise<FillMode> {
  try {
    const raw = await AsyncStorage.getItem(FILL_MODE_KEY);
    return isValidFillMode(raw) ? raw : "standard";
  } catch {
    return "standard";
  }
}

export async function saveFillMode(mode: FillMode): Promise<void> {
  try {
    await AsyncStorage.setItem(FILL_MODE_KEY, mode);
  } catch (err) {
    console.warn("[storage] saveFillMode failed (non-fatal):", err);
  }
}

export async function isDeepNudgeDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(NUDGE_DEEP_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function dismissDeepNudge(): Promise<void> {
  try {
    await AsyncStorage.setItem(NUDGE_DEEP_KEY, "1");
  } catch (err) {
    console.warn("[storage] dismissDeepNudge failed (non-fatal):", err);
  }
}

function isDayBefore(earlier: string, later: string): boolean {
  const a = new Date(earlier + "T12:00:00");
  const b = new Date(later + "T12:00:00");
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff === 1;
}

/**
 * Подсказка Den: показать один раз, если последние 3 календарных дня подряд
 * заполнены одним и тем же режимом (и это не «Глубоко»), и плашка ещё не закрыта.
 */
export async function shouldShowDeepNudge(): Promise<boolean> {
  try {
    if (await isDeepNudgeDismissed()) return false;
    const all = await getAllDays(); // отсортированы по убыванию даты
    if (all.length < 3) return false;
    const [d0, d1, d2] = all;
    const consecutive = isDayBefore(d1.date, d0.date) && isDayBefore(d2.date, d1.date);
    if (!consecutive) return false;
    const mode = d0.fillMode;
    if (!mode || mode === "deep") return false;
    return d1.fillMode === mode && d2.fillMode === mode;
  } catch (err) {
    console.warn("[storage] shouldShowDeepNudge failed (non-fatal):", err);
    return false;
  }
}

// ─── Time Capsule Letters ─────────────────────────────────────────────────

export interface TimeCapsuleLetter {
  id: string;
  text: string;
  openDate: string; // "YYYY-MM-DD"
  createdAt: string; // ISO string
  opened: boolean;
  notifId?: string;
}

const LETTERS_KEY = "time_capsule_letters";

export async function getLetters(): Promise<TimeCapsuleLetter[]> {
  try {
    const raw = await AsyncStorage.getItem(LETTERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TimeCapsuleLetter[];
  } catch {
    return [];
  }
}

export async function upsertLetter(letter: TimeCapsuleLetter): Promise<void> {
  const letters = await getLetters();
  const idx = letters.findIndex((l) => l.id === letter.id);
  if (idx >= 0) {
    letters[idx] = letter;
  } else {
    letters.push(letter);
  }
  await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(letters));
}

export async function deleteLetter(id: string): Promise<void> {
  const letters = await getLetters();
  const filtered = letters.filter((l) => l.id !== id);
  await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(filtered));
}

// ─── Пользовательские вопросы ─────────────────────────────────────────────

export interface CustomQuestions {
  learned: string | null;
  met: string | null;
  positive: string | null;
  negative: string | null;
  dayQuestion: string | null;
}

const CUSTOM_QUESTIONS_KEY = "custom_questions";

const EMPTY_CUSTOM_QUESTIONS: CustomQuestions = {
  learned: null,
  met: null,
  positive: null,
  negative: null,
  dayQuestion: null,
};

export async function getCustomQuestions(): Promise<CustomQuestions> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_QUESTIONS_KEY);
    if (!raw) return EMPTY_CUSTOM_QUESTIONS;
    return { ...EMPTY_CUSTOM_QUESTIONS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_CUSTOM_QUESTIONS;
  }
}

export async function saveCustomQuestions(q: CustomQuestions): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(q));
}

export function hasAnyCustomQuestion(q: CustomQuestions): boolean {
  return Object.values(q).some((v) => typeof v === "string" && v.trim().length > 0);
}

// ─── Streak ───────────────────────────────────────────────────────────────

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

const LAST_KNOWN_STREAK_KEY = "last_known_streak";

export async function getLastKnownStreak(): Promise<number> {
  const raw = await AsyncStorage.getItem(LAST_KNOWN_STREAK_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export async function setLastKnownStreak(value: number): Promise<void> {
  await AsyncStorage.setItem(LAST_KNOWN_STREAK_KEY, String(value));
}

const LAST_CELEBRATED_MILESTONE_KEY = "last_celebrated_milestone";

/** Highest streak_milestone threshold already celebrated, so DayFillFlow doesn't re-fire it on every resave. */
export async function getLastCelebratedMilestone(): Promise<number> {
  const raw = await AsyncStorage.getItem(LAST_CELEBRATED_MILESTONE_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export async function setLastCelebratedMilestone(value: number): Promise<void> {
  await AsyncStorage.setItem(LAST_CELEBRATED_MILESTONE_KEY, String(value));
}
