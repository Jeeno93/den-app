import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { getMoodColor, getMoodEmoji, getMoodLabel } from "@/src/components/MoodPicker";

const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_SHORT = [
  "янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек",
];

function buildGrid(): (string | null)[] {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);

  const rawDow = startDate.getDay();
  const leadingPad = (rawDow + 6) % 7;

  const cells: (string | null)[] = Array(leadingPad).fill(null);

  for (let i = 0; i < 365; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    cells.push(formatDate(d));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toRows(cells: (string | null)[]): (string | null)[][] {
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function formatRu(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export default function YearPixelsScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [entryMap, setEntryMap] = useState<Map<string, DayEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const todayString = formatDate(new Date());
  const cells = useMemo(() => buildGrid(), []);
  const rows = useMemo(() => toRows(cells), [cells]);

  useEffect(() => {
    getAllDays().then((entries) => {
      const map = new Map<string, DayEntry>();
      entries.forEach((e) => map.set(e.date, e));
      setEntryMap(map);
      setLoading(false);
    });
  }, []);

  const H_PAD = 16;
  const GAP = 3;
  const COLS = 7;
  const cellSize = Math.floor((screenWidth - H_PAD * 2 - GAP * (COLS - 1)) / COLS);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const selectedEntry = selected ? entryMap.get(selected) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: theme.background, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Год в пикселях</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Загрузка…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: H_PAD,
            paddingTop: 12,
            paddingBottom: bottomPad + (selected ? 80 : 32),
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.dowRow, { gap: GAP }]}>
            {DOW_LABELS.map((d) => (
              <View key={d} style={{ width: cellSize, alignItems: "center" }}>
                <Text style={[styles.dowLabel, { color: theme.mutedForeground }]}>{d}</Text>
              </View>
            ))}
          </View>

          {rows.map((row, ri) => (
            <View key={ri} style={[styles.row, { gap: GAP, marginTop: GAP }]}>
              {row.map((date, di) => {
                if (!date) {
                  return <View key={di} style={{ width: cellSize, height: cellSize }} />;
                }
                const entry = entryMap.get(date);
                const isToday = date === todayString;
                const isSelected = date === selected;
                const bgColor = entry
                  ? getMoodColor(entry.mood)
                  : isDark
                  ? "#2a2a2a"
                  : "#e5e5e5";

                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      {
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: bgColor,
                        borderRadius: Math.max(2, cellSize * 0.18),
                        borderWidth: isToday || isSelected ? 2 : 0,
                        borderColor: isToday
                          ? theme.foreground
                          : isSelected
                          ? "#3D9970"
                          : "transparent",
                      },
                    ]}
                    onPress={() => setSelected(date === selected ? null : date)}
                    activeOpacity={0.75}
                  />
                );
              })}
            </View>
          ))}

          <View style={styles.legend}>
            <Text style={[styles.legendLabel, { color: theme.mutedForeground }]}>
              {entryMap.size} {entriesWord(entryMap.size)} за последний год
            </Text>
          </View>
        </ScrollView>
      )}

      {selected && (
        <View
          style={[
            styles.tooltip,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              bottom: bottomPad + 8,
              left: H_PAD,
              right: H_PAD,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.tooltipDate, { color: theme.mutedForeground }]}>
              {formatRu(selected)}
            </Text>
            {selectedEntry ? (
              <Text style={[styles.tooltipMood, { color: theme.foreground }]}>
                {getMoodEmoji(selectedEntry.mood)} {getMoodLabel(selectedEntry.mood)}
              </Text>
            ) : (
              <Text style={[styles.tooltipMood, { color: theme.mutedForeground }]}>Нет записи</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.tooltipClose}>
            <Ionicons name="close" size={20} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function entriesWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "записей";
  if (mod10 === 1) return "запись";
  if (mod10 >= 2 && mod10 <= 4) return "записи";
  return "записей";
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  title: { fontSize: 17, fontWeight: "600" },
  loadingText: { fontSize: 16 },
  dowRow: { flexDirection: "row", marginBottom: 2 },
  dowLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  row: { flexDirection: "row" },
  legend: { marginTop: 20, alignItems: "center" },
  legendLabel: { fontSize: 13 },
  tooltip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tooltipDate: { fontSize: 13 },
  tooltipMood: { fontSize: 16, fontWeight: "600", marginTop: 2 },
  tooltipClose: { padding: 4 },
});
