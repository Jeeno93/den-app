# День — Документация

Микро-дневник для ежедневных записей. Работает полностью офлайн — все данные хранятся локально в AsyncStorage.

---

## Технологии

| Параметр | Значение |
|---|---|
| Framework | Expo SDK ~54, expo-router |
| Runtime | React Native 0.81, React 18 |
| Storage | AsyncStorage (JSON по ключу `day_YYYY-MM-DD`) |
| Язык | TypeScript (strict) |
| Навигация | Expo Router (file-based, tabs + stack) |
| Уведомления | expo-notifications |

---

## Структура проекта

```
artifacts/den/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx        — Навбар (4 вкладки)
│   │   ├── index.tsx          — «Сегодня» (главный экран)
│   │   ├── calendar.tsx       — Календарь + поиск
│   │   ├── memories.tsx       — Воспоминания + стрик
│   │   └── settings.tsx       — Настройки
│   ├── _layout.tsx            — Корневой layout, ThemeProvider, NotificationProvider
│   ├── day-detail.tsx         — Просмотр конкретного дня
│   ├── day-fill.tsx           — Отдельный экран заполнения (из календаря)
│   ├── year-pixels.tsx        — Год в пикселях
│   ├── letters.tsx            — Письма будущему себе
│   ├── why-diary.tsx          — Почему дневник работает
│   ├── question-editor.tsx    — Редактор вопросов
│   └── tag-editor.tsx         — Редактор тегов
├── src/
│   ├── components/            — Переиспользуемые UI-компоненты
│   ├── context/               — ThemeContext, NotificationContext
│   ├── storage/storage.ts     — Всё чтение/запись AsyncStorage
│   ├── data/                  — Статические данные (вопросы, цитаты, теги)
│   └── utils/                 — Уведомления
├── constants/colors.ts        — Дизайн-токены
└── assets/                    — Иконки и шрифты
```

---

## Дизайн-система

Все токены в `constants/colors.ts`. Оба режима (light/dark) используют единую тёмную палитру.

| Токен | Значение | Назначение |
|---|---|---|
| `background` | `#06080B` | Фон всех экранов |
| `card` | `#0D1117` | Фон карточек |
| `secondary` / `muted` | `#10141A` | Вторичные поверхности, поля ввода |
| `primary` | `#5EE6A8` | Акцент (зелёный) |
| `foreground` | `#FFFFFF` | Основной текст |
| `mutedForeground` | `#6B7585` | Вспомогательный текст, подписи |
| `border` | `rgba(255,255,255,0.08)` | Рамки карточек |

**CTA-кнопки** — LinearGradient `#214E3C → #4DD894 → #2F7D58`, borderRadius 28.

**MoodPicker** — кружки 52×52, LinearGradient белый→`#C8D1D9`, активный: рамка `#5EE6A8` + свечение + scale 1.15.

**Карточки** — `backgroundColor: #0D1117`, `borderWidth: 1`, `borderColor: rgba(255,255,255,0.08)`, `elevation: 20`.

---

## Хранилище данных

Файл: `src/storage/storage.ts`

### DayEntry

```ts
interface DayEntry {
  date: string;              // YYYY-MM-DD
  mood: number;              // 1–5
  fillMode: FillMode;        // "quick" | "standard" | "deep"
  answers: DayAnswers;
  notes: string;
  photos: string[];          // URI файлов
  proud: string;
  // Интенсивности (1 | 2 | 3 | null)
  learned_intensity, met_intensity, positive_intensity,
  negative_intensity, proud_intensity
  places: string[];          // ID тегов мест
  activities: string[];      // ID тегов активностей
  question: string;          // Вопрос дня
  // Только для deep-режима:
  energy: number | null;     // 1–3
  sleep: SleepData | null;   // bedtime, wakeTime, quality
  tasksForTomorrow: TaskItem[];
  tasksReviewed: TaskItem[];
}

interface DayAnswers {
  learned: string;
  met: string;
  positive: { question: string; answer: string; category: "positive" };
  negative: { question: string; answer: string; category: "negative" };
  dayQuestion: string;
}
```

### Остальные ключи AsyncStorage

| Ключ | Тип | Назначение |
|---|---|---|
| `day_YYYY-MM-DD` | `DayEntry` | Запись дня |
| `user_tags` | `UserTags` | Пользовательские места и активности |
| `fill_mode` | `FillMode` | Последний выбранный режим заполнения |
| `custom_questions` | `CustomQuestions` | Переопределённые вопросы |
| `time_capsule_letters` | `TimeCapsuleLetter[]` | Письма будущему себе |
| `app_theme_mode` | `"system"\|"light"\|"dark"` | Тема оформления |
| `onboarding_done` | `"1"` | Флаг завершения онбординга |
| `deep_nudge_dismissed` | `"1"` | Флаг скрытия баннера deep-режима |

---

## Режимы заполнения

Файл: `src/components/DayFillFlow.tsx`, `src/components/FillModeSwitcher.tsx`

| Режим | Фазы |
|---|---|
| **Быстро** | mood → tags → tasks |
| **Стандарт** | mood → tags → questions → notes → tasks |
| **Глубоко** | mood → tags → questions → notes → tasks → deep |

**Фазы:**
- `mood` — выбор настроения (1–5)
- `tags` — места и активности
- `questions` — 5 вопросов с интенсивностью ответа
- `notes` — свободные заметки + фото + «чем горжусь»
- `tasks` — review вчерашних задач + планирование 3 задач на завтра
- `deep` — уровень энергии (1–3) + данные о сне (время отбоя, подъёма, качество)

---

## Экраны

### Сегодня (`app/(tabs)/index.tsx`)
Главный экран. Показывает DayFillFlow для незаполненных дней и DayEntryView для заполненных. Поддерживает навигацию по датам (стрелки назад/вперёд). Показывает полоску настроений за последние 7 дней при ≥2 записях.

### Календарь (`app/(tabs)/calendar.tsx`)
Список всех записей по месяцам. Полнотекстовый поиск по всем полям ответов. Легенда цветов настроения.

### Воспоминания (`app/(tabs)/memories.tsx`)
- **Стрик-карточка** — текущая серия и рекорд, огонь в градиентном кружке
- **Год в пикселях** — ссылка на `year-pixels.tsx`
- **Мысль дня** — цитата из `src/data/quotes.ts`, меняется каждый день
- **Воспоминания** — записи неделю/месяц/год назад + случайный день

### Настройки (`app/(tabs)/settings.tsx`)
- Переключатель темы (система / светлая / тёмная)
- Ежедневное уведомление-напоминание (время)
- Уведомления о воспоминаниях из прошлого
- Редактор вопросов → `question-editor.tsx`
- Редактор тегов → `tag-editor.tsx`
- Ссылки: «Почему дневник работает», «Письма будущему себе»

### Год в пикселях (`app/year-pixels.tsx`)
Сетка квадратов — один квадрат = один день. Цвет = настроение. Ячейки рассчитываются независимо по ширине и высоте, чтобы весь год умещался без скролла. Тап по ячейке → `day-detail.tsx`. Будущие месяцы не отображаются.

### Письма будущему себе (`app/letters.tsx`)
Пользователь пишет сообщение и выбирает дату вскрытия (минимум 7 дней, максимум 1 год). Письмо заперто до указанной даты. При наступлении даты — пуш-уведомление.

### Почему дневник работает (`app/why-diary.tsx`)
Информационный экран с объяснением нейробиологических и психологических механизмов ведения дневника.

---

## Компоненты

| Компонент | Описание |
|---|---|
| `MoodPicker` | 5 эмодзи-кнопок в кружках с градиентом. Экспортирует `getMoodColor`, `getMoodLabel`, `getMoodEmoji` |
| `DayFillFlow` | Полный поток заполнения дня. Управляет фазами, сохраняет в AsyncStorage |
| `DayEntry` (DayEntryView) | Отображение заполненного дня: настроение, теги, ответы, заметки, задачи, deep-данные |
| `FillModeSwitcher` | Переключатель режима (свёрнутый / развёрнутый) |
| `QuestionCard` | Карточка одного вопроса с текстовым полем |
| `NotesCard` | Карточка заметок + фото + «чем горжусь» |
| `DeepBlocks` | Блоки энергии и сна для deep-режима |
| `IntensityPicker` | Выбор интенсивности ответа (3 уровня) |
| `DeepNudgeBanner` | Баннер-подсказка «попробуй режим Глубоко» |
| `ShareCard` | Генерация карточки для шеринга |
| `EmptyState` | Заглушка при отсутствии записей |
| `Onboarding` | Модальный онбординг (4 слайда) |

---

## Данные

### Вопросы (`src/data/questions.ts`)
392 уникальных вопроса + 5 стандартных полей. Функция `getDayQuestion(date)` выбирает вопрос по дню года. Пользователь может переопределить любой из 5 полей через `question-editor.tsx`.

### Цитаты (`src/data/quotes.ts`)
42 цитаты (Марк Аврелий, Толстой, Эйнштейн и др.). Показываются по дню года.

### Интенсивности (`src/data/intensity.ts`)
3 уровня для 5 полей ответов. Пример для «learned»: 🌱 Любопытно / 💡 Важно / 🌟 Меняет взгляд.

### Теги по умолчанию (`src/data/defaultTags.ts`)
Места: Дом, Офис, Кафе и др. Активности: Спорт, Чтение, Путешествие и др. Пользователь редактирует через `tag-editor.tsx`.

---

## Уведомления

**Ежедневное напоминание** (`src/context/NotificationContext.tsx`)
Планируется через `expo-notifications`. Текст = вопрос дня следующего дня. Время настраивается пользователем (по умолчанию 21:00).

**Воспоминания** (`src/utils/notifications.ts`)
Раз в 3 дня: берётся случайная запись с настроением ≥3 (не старше недели, не моложе 3 дней), из ответов извлекается цитата, отправляется уведомление «N дней назад ты написал: …».

**Письма** (`app/letters.tsx`)
Уведомление в день вскрытия письма.

---

## Навигация

```
(tabs)/index       — Сегодня
(tabs)/calendar    — Календарь
(tabs)/memories    — Воспоминания
(tabs)/settings    — Настройки
  → /day-detail    — Просмотр дня (параметр: date)
  → /day-fill      — Заполнение дня (параметр: date)
  → /year-pixels   — Год в пикселях
  → /letters       — Письма
  → /why-diary     — Почему дневник работает
  → /question-editor — Редактор вопросов
  → /tag-editor    — Редактор тегов
```

---

## Разработка

```bash
# Запуск (Expo Go)
pnpm --filter @workspace/den run dev

# TypeScript
cd artifacts/den && npx tsc --noEmit

# Сборка зависимостей
cd artifacts/den && pnpm install
```

Приложение работает в **Expo Go** — нативных модулей требующих bare workflow нет. Все данные хранятся локально, бэкенд не нужен.
