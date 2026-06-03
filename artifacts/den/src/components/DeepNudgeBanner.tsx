import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";

interface Props {
  onDismiss: () => void;
  onTry?: () => void;
}

export function DeepNudgeBanner({ onDismiss, onTry }: Props) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.card, borderColor: theme.border, shadowColor: isDark ? "#000" : "#333" },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.primary + "22" }]}>
        <Ionicons name="sparkles" size={18} color={theme.primary} />
      </View>
      <TouchableOpacity
        style={styles.textWrap}
        onPress={onTry}
        activeOpacity={onTry ? 0.7 : 1}
        disabled={!onTry}
      >
        <Text style={[styles.text, { color: theme.foreground }]}>
          Попробуй режим Глубоко — он помогает замечать паттерны
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID="deep-nudge-close"
      >
        <Ionicons name="close" size={18} color={theme.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1 },
  text: { fontSize: 14, fontWeight: "500", lineHeight: 19 },
  closeBtn: { padding: 2 },
});
