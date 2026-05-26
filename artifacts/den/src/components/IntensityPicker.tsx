import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { IntensityConfig, IntensityValue } from "@/src/data/intensity";

const ACCENT = "#3D9970";

interface Props {
  config: IntensityConfig;
  value: IntensityValue;
  onChange: (v: IntensityValue) => void;
}

export function IntensityPicker({ config, value, onChange }: Props) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.mutedForeground }]}>{config.title}</Text>
      <View style={styles.tags}>
        {config.tags.map((tag) => {
          const selected = value === tag.value;
          return (
            <TouchableOpacity
              key={tag.value}
              style={[
                styles.tag,
                {
                  borderColor: selected ? ACCENT : theme.border,
                  backgroundColor: selected ? ACCENT + "18" : isDark ? theme.muted : "#F8F9FA",
                },
              ]}
              onPress={() => onChange(selected ? null : tag.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.tagEmoji}>{tag.emoji}</Text>
              <Text style={[styles.tagLabel, { color: selected ? ACCENT : theme.mutedForeground }]}>
                {tag.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tags: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagEmoji: {
    fontSize: 13,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
});
