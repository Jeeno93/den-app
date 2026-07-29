import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";

interface TimeSelectorProps {
  hour: number;
  minute: number;
  onConfirm: (h: number, m: number) => void;
  confirmLabel?: string;
}

export function TimeSelector({ hour, minute, onConfirm, confirmLabel = "Сохранить" }: TimeSelectorProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);

  const incH = () => setH((x) => (x + 1) % 24);
  const decH = () => setH((x) => (x - 1 + 24) % 24);
  const incM = () => setM((x) => (x + 5) % 60);
  const decM = () => setM((x) => (x - 5 + 60) % 60);

  return (
    <View style={[styles.timeSelector, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.timeUnit}>
        <TouchableOpacity onPress={incH} style={styles.timeBtn}>
          <Ionicons name="chevron-up" size={20} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.timeNum, { color: theme.foreground }]}>{String(h).padStart(2, "0")}</Text>
        <TouchableOpacity onPress={decH} style={styles.timeBtn}>
          <Ionicons name="chevron-down" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.timeSep, { color: theme.foreground }]}>:</Text>
      <View style={styles.timeUnit}>
        <TouchableOpacity onPress={incM} style={styles.timeBtn}>
          <Ionicons name="chevron-up" size={20} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.timeNum, { color: theme.foreground }]}>{String(m).padStart(2, "0")}</Text>
        <TouchableOpacity onPress={decM} style={styles.timeBtn}>
          <Ionicons name="chevron-down" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={() => onConfirm(h, m)}>
        <Text style={[styles.confirmBtnText, { color: theme.primaryForeground }]}>{confirmLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  timeSelector: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeUnit: { alignItems: "center", gap: 8 },
  timeBtn: { padding: 6 },
  timeNum: {
    fontSize: 32,
    fontWeight: "700",
    width: 60,
    textAlign: "center",
    letterSpacing: -1,
  },
  timeSep: { fontSize: 32, fontWeight: "700", paddingBottom: 4 },
  confirmBtn: { marginLeft: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  confirmBtnText: { fontSize: 14, fontWeight: "600" },
});
