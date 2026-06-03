import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { DayFillFlow } from "@/src/components/DayFillFlow";

const WEEK_DAYS = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export default function DayFillScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();

  const safeDate = date ?? new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(safeDate + "T12:00:00");

  const dateStr = `${parsedDate.getDate()} ${MONTHS_GEN[parsedDate.getMonth()]}`;
  const dayStr = WEEK_DAYS[parsedDate.getDay()];
  const yearStr = parsedDate.getFullYear();
  const currentYear = new Date().getFullYear();
  const fullDateStr = yearStr !== currentYear ? `${dateStr} ${yearStr}` : dateStr;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const header = (
    <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={[styles.headerDate, { color: theme.foreground }]}>{fullDateStr}</Text>
        <Text style={[styles.headerDay, { color: theme.mutedForeground }]}>{dayStr}</Text>
      </View>
    </View>
  );

  return (
    <DayFillFlow
      key={safeDate}
      date={safeDate}
      topInset={topPad}
      header={header}
      doneVariant="close"
      onClose={() => router.back()}
      onExit={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerDate: { fontSize: 16, fontWeight: "700" },
  headerDay: { fontSize: 12, marginTop: 1 },
});
