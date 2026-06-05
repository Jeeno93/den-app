import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";

interface EmptyStateProps {
  emoji?: string;
  title?: string;
  subtitle?: string;
}

export function EmptyState({
  emoji = "🌱",
  title = "Твой первый день ещё впереди.",
  subtitle = "Начни сегодня.",
}: EmptyStateProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

  return (
    <View style={styles.container}>
      <View style={[styles.emojiCircle, { backgroundColor: theme.primary + "15" }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emojiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});
