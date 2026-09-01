import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";
import { getMoodColor, getMoodEmoji, getMoodLabel } from "@/src/components/MoodPicker";
import type { DayEntry } from "@/src/storage/storage";

interface ThemeColors {
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
}

// Логическая система координат для всех графиков — react-native-svg
// растягивает её на 100% ширины контейнера через viewBox, так что реальные
// пиксели устройства не важны, а числа ниже удобно небольшие.
const CHART_W = 320;

// ---------- Линия настроения по времени ----------

const TREND_H = 120;
const TREND_PAD = 12;
const TREND_MAX_POINTS = 60; // иначе на маленьком экране точки сливаются в кашу

function moodToY(mood: number): number {
  // 1 внизу, 5 вверху — с отступами сверху/снизу под подписи и точки.
  const usable = TREND_H - TREND_PAD * 2;
  return TREND_H - TREND_PAD - ((mood - 1) / 4) * usable;
}

/**
 * Линейный график настроения по времени: тонкая линия — сырые дневные
 * оценки, толстая — скользящее среднее за 7 дней. Раньше у экрана Паттернов
 * не было вообще никакого ощущения "истории", только отдельные карточки —
 * этот график даёт общий контекст, на фоне которого читаются остальные секции.
 */
export function MoodTrendChart({ entries, theme }: { entries: DayEntry[]; theme: ThemeColors }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const shown = sorted.slice(-TREND_MAX_POINTS);
  if (shown.length < 2) return null;

  const n = shown.length;
  const stepX = (CHART_W - TREND_PAD * 2) / (n - 1);
  const xAt = (i: number) => TREND_PAD + i * stepX;

  const rawPoints = shown.map((e, i) => `${xAt(i)},${moodToY(e.mood)}`).join(" ");

  // Скользящее среднее за последние до 7 записей (включая текущую) —
  // хвостовое, не центрированное: так последняя точка графика всегда
  // отражает "как дела в среднем в последнее время", без заглядывания вперёд.
  const rollingWindow = Math.min(7, n);
  const avgPoints = shown
    .map((_, i) => {
      const from = Math.max(0, i - rollingWindow + 1);
      const slice = shown.slice(from, i + 1);
      const avg = slice.reduce((s, e) => s + e.mood, 0) / slice.length;
      return `${xAt(i)},${moodToY(avg)}`;
    })
    .join(" ");

  return (
    <View>
      <Text style={[chartStyles.title, { color: theme.foreground }]}>Настроение по времени</Text>
      <Svg width="100%" height={TREND_H} viewBox={`0 0 ${CHART_W} ${TREND_H}`}>
        {[1, 3, 5].map((m) => (
          <Line
            key={m}
            x1={0}
            x2={CHART_W}
            y1={moodToY(m)}
            y2={moodToY(m)}
            stroke={theme.border}
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
        <Polyline points={rawPoints} fill="none" stroke={theme.mutedForeground} strokeWidth={1} opacity={0.35} />
        <Polyline
          points={avgPoints}
          fill="none"
          stroke="#31A876"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={chartStyles.trendLegendRow}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: theme.mutedForeground, opacity: 0.5 }]} />
          <Text style={[chartStyles.legendText, { color: theme.mutedForeground }]}>день</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: "#31A876" }]} />
          <Text style={[chartStyles.legendText, { color: theme.mutedForeground }]}>среднее за 7 дней</Text>
        </View>
      </View>
    </View>
  );
}

// ---------- Донат-диаграмма распределения оценок ----------

const DONUT_SIZE = 140;
const DONUT_R = 52;
const DONUT_STROKE = 22;
const DONUT_CX = DONUT_SIZE / 2;
const DONUT_CY = DONUT_SIZE / 2;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  // Полный круг (100% одной категории) вырождается в 0-длины дугу —
  // подрезаем на 0.01°, иначе SVG-дуга с одинаковыми концами не рисуется.
  const clampedEnd = endAngle >= startAngle + 360 ? startAngle + 359.99 : endAngle;
  const start = polarToCartesian(cx, cy, r, clampedEnd);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = clampedEnd - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/**
 * Распределение оценок настроения 1-5 донатом — отвечает на конкретный
 * вопрос "насколько всё зажато вокруг одной отметки на дискретной шкале",
 * который средняя дельта в карточках-паттернах не показывает вообще.
 */
export function MoodDistributionDonut({ distribution, theme }: { distribution: number[]; theme: ThemeColors }) {
  const total = distribution.reduce((s, c) => s + c, 0);
  if (total === 0) return null;

  let cursor = 0;
  const arcs = distribution.map((count, i) => {
    const mood = i + 1;
    const sweep = (count / total) * 360;
    const arc = count > 0 ? describeArc(DONUT_CX, DONUT_CY, DONUT_R, cursor, cursor + sweep) : null;
    cursor += sweep;
    return { mood, count, arc };
  });

  return (
    <View>
      <Text style={[chartStyles.title, { color: theme.foreground }]}>Распределение оценок</Text>
      <View style={chartStyles.donutRow}>
        <Svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
          {arcs.map(
            ({ mood, arc }) =>
              arc && (
                <Path
                  key={mood}
                  d={arc}
                  stroke={getMoodColor(mood)}
                  strokeWidth={DONUT_STROKE}
                  fill="none"
                  strokeLinecap="butt"
                />
              )
          )}
          <Circle cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R - DONUT_STROKE / 2 - 4} fill="transparent" />
        </Svg>
        <View style={chartStyles.donutLegend}>
          {arcs
            .filter((a) => a.count > 0)
            .reverse()
            .map(({ mood, count }) => (
              <View key={mood} style={chartStyles.legendItem}>
                <View style={[chartStyles.legendDot, { backgroundColor: getMoodColor(mood) }]} />
                <Text style={[chartStyles.legendText, { color: theme.foreground }]}>
                  {getMoodEmoji(mood)} {getMoodLabel(mood)} — {Math.round((count / total) * 100)}%
                </Text>
              </View>
            ))}
        </View>
      </View>
    </View>
  );
}

// ---------- Частота тегов ----------

interface TagFreqRow {
  id: string;
  emoji: string;
  label: string;
  count: number;
}

/** Горизонтальные бары частоты тегов — просто счётчик, без статистики, поэтому нормализация к собственному максимуму тут уместна. */
export function TagFrequencyBars({ rows, theme }: { rows: TagFreqRow[]; theme: ThemeColors }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count));

  return (
    <View>
      <Text style={[chartStyles.title, { color: theme.foreground }]}>Что чаще всего отмечаешь</Text>
      <View style={{ gap: 10 }}>
        {rows.map((r) => (
          <View key={r.id}>
            <View style={chartStyles.freqRowHeader}>
              <Text style={[chartStyles.freqLabel, { color: theme.foreground }]}>
                {r.emoji} {r.label}
              </Text>
              <Text style={[chartStyles.freqCount, { color: theme.mutedForeground }]}>{r.count}</Text>
            </View>
            <View style={[chartStyles.freqTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  chartStyles.freqFill,
                  { width: `${Math.max((r.count / max) * 100, 4)}%`, backgroundColor: "#31A876" },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  title: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.7,
    marginBottom: 10,
  },
  trendLegendRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  donutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  donutLegend: {
    gap: 8,
    flex: 1,
  },
  freqRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  freqLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  freqCount: {
    fontSize: 13,
  },
  freqTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  freqFill: {
    height: "100%",
    borderRadius: 3,
  },
});
