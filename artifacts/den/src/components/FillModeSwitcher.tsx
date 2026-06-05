import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { FillMode } from "@/src/storage/storage";

export const FILL_MODE_OPTIONS: { mode: FillMode; label: string; hint: string }[] = [
  { mode: "quick", label: "Быстро", hint: "Настроение и теги" },
  { mode: "standard", label: "Стандарт", hint: "Вопросы и итог дня" },
  { mode: "deep", label: "Глубоко", hint: "Сон, задачи, энергия" },
];

interface Props {
  value: FillMode;
  onChange: (mode: FillMode) => void;
  /** Свёрнут ли переключатель в тонкую строку. */
  expanded: boolean;
  /** Тап по свёрнутой строке — развернуть полный переключатель. */
  onExpand: () => void;
}

export function FillModeSwitcher({ value, onChange, expanded, onExpand }: Props) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const active = FILL_MODE_OPTIONS.find((o) => o.mode === value) ?? FILL_MODE_OPTIONS[1];

  // Свёрнутое состояние: тонкая строка с названием режима и шевроном.
  if (!expanded) {
    return (
      <TouchableOpacity
        style={[styles.collapsed, { backgroundColor: isDark ? theme.muted : "#EEF1F0" }]}
        onPress={onExpand}
        activeOpacity={0.8}
        testID="fill-mode-collapsed"
      >
        <Text style={[styles.collapsedLabel, { color: theme.foreground }]} numberOfLines={1}>
          {active.label}
          <Text style={{ color: theme.mutedForeground }}>  ·  {active.hint}</Text>
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.mutedForeground} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.track, { backgroundColor: isDark ? theme.muted : "#EEF1F0" }]}>
        {FILL_MODE_OPTIONS.map((opt) => {
          const selected = opt.mode === value;
          return (
            <TouchableOpacity
              key={opt.mode}
              style={[
                styles.segment,
                selected && { backgroundColor: theme.card, shadowColor: isDark ? "#000" : "#333" },
                selected && styles.segmentSelected,
              ]}
              onPress={() => onChange(opt.mode)}
              activeOpacity={0.8}
              testID={`fill-mode-${opt.mode}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? theme.primary : theme.mutedForeground },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: theme.mutedForeground }]}>{active.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  collapsedLabel: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  wrapper: { gap: 8 },
  track: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentSelected: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: { fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 12, textAlign: "center" },
});
