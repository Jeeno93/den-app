export interface StreakBadge {
  min: number;
  emoji: string;
  label: string;
}

/** Sorted descending by threshold — first match via getStreakBadge() wins. */
export const STREAK_BADGES: StreakBadge[] = [
  { min: 365, emoji: "👑", label: "Целый год" },
  { min: 100, emoji: "💎", label: "100 дней" },
  { min: 30, emoji: "⚡", label: "Месяц подряд" },
  { min: 7, emoji: "🔥", label: "Неделя подряд" },
  { min: 3, emoji: "✨", label: "3 дня подряд" },
];

export function getStreakBadge(current: number): StreakBadge | null {
  return STREAK_BADGES.find((b) => current >= b.min) ?? null;
}

/** Exact-match thresholds that trigger a one-time celebration + streak_milestone event. */
export const STREAK_MILESTONES = [3, 7, 30, 100, 365] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

export function getBadgeForMilestone(days: number): StreakBadge | undefined {
  return STREAK_BADGES.find((b) => b.min === days);
}
