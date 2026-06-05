---
name: День fill-flow structure
description: How the «День» day-fill flow is structured across modes and which phase owns the final CTA.
---

# «День» day-fill flow

The fill experience is a single shared component (`DayFillFlow`) used by BOTH
the «Сегодня» tab and `/day-fill`. It has three modes, persisted in
AsyncStorage `fill_mode`, default **standard**:

- **quick** (Быстро): `mood → tags` only — questions are intentionally skipped.
- **standard** (Стандарт, DEFAULT): `mood → tags → 5 questions → notes`.
- **deep** (Глубоко): standard `+ deep` block at the end.

**Why it matters / gotcha:** The 5 question cards are NEVER the last step —
notes (standard) or the deep block (deep) always follow. So `QuestionCard`
`isLast` is always `false`; the final "Готово" CTA lives on `NotesCard`
(standard) and the `DeepBlocks` continue button (deep). `NotesCard` takes an
`isLast` prop: in deep mode notes is NOT last, so its button reads "Далее"
(arrow), and ONLY the deep phase shows the final "Готово". Do not let two
"Готово" buttons appear.

**Deep block (`DeepBlocks`):** energy and sleep-quality are 3-level button rows
(values 1–3, nullable by re-tapping), NOT 1–5 scales. Sleep times use
`@react-native-community/datetimepicker` (mode time, spinner) on native, stored
as "HH:MM"; web has a TextInput fallback normalized on blur.

**"Задачи дня" (was "Привычки"):** evening you write ≤3 tasks for tomorrow
(`DayEntry.tasksForTomorrow`). On the NEXT day's fill, `DayFillFlow` loads the
previous day's `tasksForTomorrow` (via `getDay(date − 1)`) and shows them as a
checklist; the checked result saves as `tasksReviewed`. The old `habits` field
is kept in storage for backward compat (real habit tracker is a future feature)
— do NOT remove it.

**Process note:** the repo's automated validation code-review grades against
the full original product spec; for narrowly-scoped tasks it may reject for
out-of-scope or by-design items (e.g. flagging quick-mode question-skipping, or
calendar visuals untouched by the task). Verify against the actual task scope
before "fixing" such findings.
