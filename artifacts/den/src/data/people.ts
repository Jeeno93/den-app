import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TagItem } from "@/src/data/defaultTags";

/**
 * С кем был день — кнопки прямо в вопросе «Кого сегодня довелось встретить
 * или вспомнить?». Заменили ряд «Важность человека» (Знакомый / Близкий /
 * Очень важный): важность и так читается из того, кто это, а «кто» можно
 * посчитать — «хорошие дни чаще с друзьями». Из свободного текста ответа
 * этого честно не извлечь.
 */
export const NOBODY_ID = "nobody";

export const defaultPeople: TagItem[] = [
  { id: "friends", label: "Друзья", emoji: "👫" },
  { id: "family", label: "Семья", emoji: "👨‍👩‍👧" },
  { id: "partner", label: "Любимый человек", emoji: "❤️" },
  { id: "colleagues", label: "Коллеги", emoji: "💼" },
  { id: NOBODY_ID, label: "Никого", emoji: "🍃" },
];

const CUSTOM_PEOPLE_KEY = "user_people_custom";

export async function getPeople(): Promise<TagItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_PEOPLE_KEY);
    const custom = raw ? (JSON.parse(raw) as TagItem[]) : [];
    // «Никого» всегда последним, свои — перед ним.
    const nobody = defaultPeople.filter((p) => p.id === NOBODY_ID);
    return [...defaultPeople.filter((p) => p.id !== NOBODY_ID), ...custom, ...nobody];
  } catch {
    return defaultPeople;
  }
}

export async function addCustomPerson(label: string): Promise<TagItem> {
  const person: TagItem = { id: `person_${Date.now()}`, label: label.trim(), emoji: "👤" };
  const raw = await AsyncStorage.getItem(CUSTOM_PEOPLE_KEY);
  const custom = raw ? (JSON.parse(raw) as TagItem[]) : [];
  await AsyncStorage.setItem(CUSTOM_PEOPLE_KEY, JSON.stringify([...custom, person]));
  return person;
}

/** «Никого» исключает остальных и наоборот. */
export function togglePerson(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((p) => p !== id);
  if (id === NOBODY_ID) return [NOBODY_ID];
  return [...selected.filter((p) => p !== NOBODY_ID), id];
}
