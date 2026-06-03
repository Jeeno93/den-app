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
- **deep** (Глубоко): standard `+ deep` block (energy/sleep/habits) at the end.

**Why it matters / gotcha:** The 5 question cards are NEVER the last step —
notes (standard) or the deep block (deep) always follow. So `QuestionCard`
`isLast` is always `false`; the final "Готово" CTA lives on `NotesCard`
(standard) and the `DeepBlocks` continue button (deep). Do not "fix" the last
question to show "Готово" — that breaks the Стандарт flow parity.

**Process note:** the repo's automated validation code-review grades against
the full original product spec; for narrowly-scoped tasks it may reject for
out-of-scope or by-design items (e.g. flagging quick-mode question-skipping, or
calendar visuals untouched by the task). Verify against the actual task scope
before "fixing" such findings.
