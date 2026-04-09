import AsyncStorage from "@react-native-async-storage/async-storage";

export interface DayAnswers {
  learned: string;
  met: string;
  laughed: string;
  annoyed: string;
  dayQuestion: string;
}

export interface DayEntry {
  date: string;
  mood: number;
  answers: DayAnswers;
  question: string;
  notes: string;
  photo: string | null;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function keyForDate(date: string): string {
  return `day_${date}`;
}

export async function saveDay(date: string, data: DayEntry): Promise<void> {
  await AsyncStorage.setItem(keyForDate(date), JSON.stringify(data));
}

export async function getDay(date: string): Promise<DayEntry | null> {
  const raw = await AsyncStorage.getItem(keyForDate(date));
  if (!raw) return null;
  return JSON.parse(raw) as DayEntry;
}

export async function getAllDays(): Promise<DayEntry[]> {
  const keys = await AsyncStorage.getAllKeys();
  const dayKeys = keys.filter((k) => k.startsWith("day_"));
  if (dayKeys.length === 0) return [];
  const pairs = await AsyncStorage.multiGet(dayKeys);
  return pairs
    .map(([, val]) => (val ? (JSON.parse(val) as DayEntry) : null))
    .filter((d): d is DayEntry => d !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getStreak(): Promise<{ current: number; best: number }> {
  const all = await getAllDays();
  if (all.length === 0) return { current: 0, best: 0 };

  const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));
  const today = formatDate(new Date());

  let current = 0;
  let best = 0;
  let streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const curr = new Date(sorted[i].date);
    const diffDays =
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      streak++;
    } else {
      if (streak > best) best = streak;
      streak = 1;
    }
  }
  if (streak > best) best = streak;

  const lastDate = sorted[sorted.length - 1].date;
  const lastDateObj = new Date(lastDate);
  const todayObj = new Date(today);
  const diffFromToday =
    (todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24);

  if (diffFromToday <= 1) {
    let tempStreak = 1;
    for (let i = sorted.length - 1; i > 0; i--) {
      const prev = new Date(sorted[i - 1].date);
      const curr = new Date(sorted[i].date);
      const diffDays =
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        break;
      }
    }
    current = tempStreak;
  } else {
    current = 0;
  }

  return { current, best };
}

export { formatDate };
