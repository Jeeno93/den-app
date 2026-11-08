import React, { useEffect } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as amplitude from "@amplitude/analytics-react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";

type Theme = typeof colors.dark;

const SECTIONS: { title: string; text: string }[] = [
  {
    title: "Только на твоём устройстве",
    text: "Записи дней, фотографии, письма себе, теги и настройки хранятся локально на телефоне и никуда не отправляются. Мы не видим их содержимое — оно принадлежит только тебе. Вместе с приложением они удаляются полностью. Копию можно сохранить в файл через «Экспортировать данные» в настройках.",
  },
  {
    title: "Аналитика использования",
    text: "Приложение собирает обезличенную статистику: какие экраны открываются, какие кнопки нажимаются. Это помогает понять, что в дневнике работает, а что стоит улучшить. Мы не видим содержимое записей и фотографий, имя, почту или номер телефона.",
  },
  {
    title: "Реклама и установка",
    text: "Чтобы понять, откуда приходят новые пользователи (например, из рекламы или по рекомендации), приложение получает технические сведения об установке. Это данные о том, как приложение нашли, — а не о том, что в нём написано.",
  },
  {
    title: "Уведомления",
    text: "Напоминания о записи, письмах и воспоминаниях планируются прямо на устройстве. Тексты твоих записей никому не отправляются — приложение само знает, когда тебе написать.",
  },
  {
    title: "Чего мы не делаем",
    text: "Не продаём данные третьим лицам, не показываем рекламу внутри дневника, не записываем экран и не передаём содержимое твоих записей.",
  },
];

function Section({ title, text, theme }: { title: string; text: string; theme: Theme }) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>{title}</Text>
      <Text style={[styles.sectionText, { color: theme.mutedForeground }]}>{text}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    amplitude.track("privacy_viewed");
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>Конфиденциальность</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={[styles.hero, { backgroundColor: theme.primary + "14", borderColor: theme.primary + "33" }]}>
          <Ionicons name="lock-closed-outline" size={22} color={theme.primary} />
          <Text style={[styles.heroText, { color: theme.foreground }]}>
            Дневник остаётся твоим: записи хранятся на устройстве, аналитика — обезличенная.
          </Text>
        </View>

        {SECTIONS.map((s) => (
          <Section key={s.title} title={s.title} text={s.text} theme={theme} />
        ))}

        <Text style={[styles.footer, { color: theme.mutedForeground }]}>
          Вопросы о конфиденциальности: almazkin93@mail.ru
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  headerCenter: { flex: 1, alignItems: "center", gap: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  heroText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionText: { fontSize: 14, lineHeight: 21 },
  footer: { fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 17 },
});
