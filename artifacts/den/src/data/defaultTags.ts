export interface TagItem {
  id: string;
  label: string;
  emoji: string;
}

export const defaultPlaces: TagItem[] = [
  { id: "home", label: "Дома", emoji: "🏠" },
  { id: "office", label: "Офис", emoji: "🏢" },
  { id: "cafe", label: "Кафе", emoji: "☕" },
  { id: "gym", label: "Спортзал", emoji: "🏋️" },
  { id: "park", label: "Парк", emoji: "🌳" },
  { id: "shop", label: "Магазин", emoji: "🛒" },
  { id: "car", label: "В дороге", emoji: "🚗" },
  { id: "travel", label: "Путешествие", emoji: "✈️" },
  { id: "hospital", label: "Больница", emoji: "🏥" },
  { id: "library", label: "Библиотека", emoji: "📚" },
];

export const defaultActivities: TagItem[] = [
  { id: "cycling", label: "Велопрогулка", emoji: "🚴" },
  { id: "fishing", label: "Рыбалка", emoji: "🎣" },
  { id: "party", label: "Вечеринка", emoji: "🎉" },
  { id: "running", label: "Пробежка", emoji: "🏃" },
  { id: "reading", label: "Чтение", emoji: "📖" },
  { id: "gaming", label: "Игры", emoji: "🎮" },
  { id: "family", label: "Семья", emoji: "👨‍👩‍👧" },
  { id: "dinner", label: "Ужин с друзьями", emoji: "🍕" },
  { id: "work", label: "Работа", emoji: "💻" },
  { id: "cinema", label: "Кино", emoji: "🎬" },
  { id: "meditation", label: "Медитация", emoji: "🧘" },
  { id: "swimming", label: "Плавание", emoji: "🌊" },
];

export const EMOJI_PALETTE = [
  "🏠","🏢","☕","🏋️","🌳","🛒","🚗","✈️","🏥","📚",
  "🚴","🎣","🎉","🏃","📖","🎮","👨‍👩‍👧","🍕","💻","🎬",
  "🧘","🌊","🎵","🎨","🏖️","🏔️","🌙","☀️","🍎","🎂",
  "🏆","💪","🧠","❤️","🌺","🎸","⚽","🎯","🛍️","🚀",
  "🌈","🦋","🐾","🍀","🎪","🏕️","🎭","🍜","🧩","🎤",
];
