/**
 * Системные экраны поверх приложения — камера, галерея, запрос разрешения —
 * на Android переводят его в фон. Для аналитики это не уход человека, а
 * действие внутри записи: без пометки выбор «Фото дня» считался отвалом
 * (14 сентября 13 из 14 таких «уходов» дописали день в течение часа).
 */
let openCount = 0;

export function isSystemUiOpen(): boolean {
  return openCount > 0;
}

export async function withSystemUi<T>(action: () => Promise<T>): Promise<T> {
  openCount++;
  try {
    return await action();
  } finally {
    // Промис пикера может разрешиться чуть раньше, чем приложение снова
    // станет активным, поэтому пометку снимаем с запасом.
    setTimeout(() => {
      openCount = Math.max(0, openCount - 1);
    }, 1500);
  }
}
