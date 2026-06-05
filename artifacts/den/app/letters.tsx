import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import {
  formatDate,
  getLetters,
  upsertLetter,
  deleteLetter,
} from "@/src/storage/storage";
import type { TimeCapsuleLetter } from "@/src/storage/storage";
import {
  scheduleLetterNotification,
  cancelLetterNotification,
} from "@/src/utils/notifications";

const ACCENT = "#3D9970";

const MONTHS = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря",
];

function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

type LetterView = "list" | "compose" | "reading";

export default function LettersScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const [view, setView] = useState<LetterView>("list");
  const [letters, setLetters] = useState<TimeCapsuleLetter[]>([]);
  const [readingLetter, setReadingLetter] = useState<TimeCapsuleLetter | null>(null);

  // Compose state
  const today = new Date();
  const minDate = addDays(today, 7);
  const [composeText, setComposeText] = useState("");
  const [openDate, setOpenDate] = useState<Date>(addDays(today, 30));
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getLetters().then((ls) => {
        setLetters(ls.sort((a, b) => a.openDate.localeCompare(b.openDate)));
      });
    }, [])
  );

  async function reload() {
    const ls = await getLetters();
    setLetters(ls.sort((a, b) => a.openDate.localeCompare(b.openDate)));
  }

  async function handleSave() {
    if (!composeText.trim()) {
      Alert.alert("Пусто", "Напиши что-нибудь перед тем, как запечатать письмо.");
      return;
    }
    setSaving(true);
    try {
      const openDateStr = formatDate(openDate);
      const letter: TimeCapsuleLetter = {
        id: `letter_${Date.now()}`,
        text: composeText.trim(),
        openDate: openDateStr,
        createdAt: new Date().toISOString(),
        opened: false,
      };
      const notifId = await scheduleLetterNotification(letter.id, openDateStr);
      if (notifId) letter.notifId = notifId;
      await upsertLetter(letter);
      await reload();
      setComposeText("");
      setOpenDate(addDays(today, 30));
      setShowPicker(false);
      setView("list");
    } catch {
      Alert.alert("Ошибка", "Не удалось сохранить письмо.");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpen(letter: TimeCapsuleLetter) {
    const updated = { ...letter, opened: true };
    if (letter.notifId) await cancelLetterNotification(letter.notifId);
    await upsertLetter(updated);
    await reload();
    setReadingLetter(updated);
    setView("reading");
  }

  async function handleDelete(letter: TimeCapsuleLetter) {
    Alert.alert(
      "Удалить письмо",
      "Это действие нельзя отменить.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            if (letter.notifId) await cancelLetterNotification(letter.notifId).catch(() => {});
            await deleteLetter(letter.id);
            await reload();
          },
        },
      ]
    );
  }

  function handleBack() {
    if (view === "compose" || view === "reading") {
      setView("list");
      setReadingLetter(null);
    } else {
      router.back();
    }
  }

  const headerTitle =
    view === "compose" ? "Новое письмо" :
    view === "reading" ? "Письмо себе" :
    "Письма себе";

  const canGoBackInScreen = view === "compose" || view === "reading";

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name={canGoBackInScreen ? "close" : "chevron-back"} size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.foreground }]}>{headerTitle}</Text>
        {view === "list" ? (
          <TouchableOpacity style={styles.headerBtn} onPress={() => setView("compose")} activeOpacity={0.7}>
            <Ionicons name="add" size={26} color={ACCENT} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {/* LIST VIEW */}
      {view === "list" && (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {letters.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>💌</Text>
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Нет писем</Text>
              <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
                Напиши письмо себе в будущее — оно откроется в выбранный день
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: ACCENT }]}
                onPress={() => setView("compose")}
                activeOpacity={0.8}
              >
                <Text style={[styles.emptyBtnText, { color: "#fff" }]}>Написать письмо</Text>
              </TouchableOpacity>
            </View>
          ) : (
            letters.map((letter) => (
              <LetterCard
                key={letter.id}
                letter={letter}
                isDark={isDark}
                theme={theme}
                onOpen={() => handleOpen(letter)}
                onRead={() => { setReadingLetter(letter); setView("reading"); }}
                onDelete={() => handleDelete(letter)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* COMPOSE VIEW */}
      {view === "compose" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={topPad + 56}
        >
          <ScrollView
            contentContainerStyle={[styles.composeContent, { paddingBottom: bottomPad + 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.composeLabel, { color: theme.mutedForeground }]}>Твоё сообщение</Text>
            <View style={[styles.textAreaWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TextInput
                style={[styles.textArea, { color: theme.foreground }]}
                placeholder="Привет, будущий я…"
                placeholderTextColor={theme.mutedForeground}
                multiline
                textAlignVertical="top"
                value={composeText}
                onChangeText={setComposeText}
                autoFocus
              />
            </View>

            <Text style={[styles.composeLabel, { color: theme.mutedForeground, marginTop: 24 }]}>Дата открытия</Text>
            <View style={styles.presets}>
              {[
                { label: "+1 нед", days: 7 },
                { label: "+1 мес", days: 30 },
                { label: "+3 мес", days: 90 },
                { label: "+6 мес", days: 180 },
                { label: "+1 год", days: 365 },
              ].map(({ label, days }) => {
                const target = addDays(today, days);
                const isSelected = formatDate(target) === formatDate(openDate);
                return (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.presetBtn,
                      { borderColor: isSelected ? ACCENT : theme.border, backgroundColor: isSelected ? ACCENT + "18" : theme.card },
                    ]}
                    onPress={() => { setOpenDate(target); setShowPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetBtnText, { color: isSelected ? ACCENT : theme.foreground }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.datePickerRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setShowPicker((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.mutedForeground} />
              <Text style={[styles.datePickerText, { color: theme.foreground }]}>
                {formatDateRu(formatDate(openDate))}
              </Text>
              <Ionicons name={showPicker ? "chevron-up" : "chevron-down"} size={16} color={theme.mutedForeground} />
            </TouchableOpacity>

            {showPicker && Platform.OS !== "web" && (
              <DateTimePicker
                value={openDate}
                mode="date"
                minimumDate={minDate}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                themeVariant={isDark ? "dark" : "light"}
                onChange={(_, date) => {
                  if (Platform.OS === "android") setShowPicker(false);
                  if (date) setOpenDate(date);
                }}
              />
            )}
            {showPicker && Platform.OS === "web" && (
              <TextInput
                style={[styles.webDateInput, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]}
                value={formatDate(openDate)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.mutedForeground}
                onChangeText={(v) => {
                  const d = new Date(v + "T12:00:00");
                  if (!isNaN(d.getTime()) && d >= minDate) setOpenDate(d);
                }}
              />
            )}

            <TouchableOpacity
              style={[styles.sealBtn, { backgroundColor: ACCENT, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.sealBtnText}>{saving ? "Сохранение…" : "Запечатать 💌"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* READING VIEW */}
      {view === "reading" && readingLetter && (
        <ScrollView
          contentContainerStyle={[styles.readingContent, { paddingBottom: bottomPad + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.readingMeta, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.readingMetaLabel, { color: theme.mutedForeground }]}>Написано</Text>
            <Text style={[styles.readingMetaValue, { color: theme.foreground }]}>
              {formatDateRu(readingLetter.createdAt.slice(0, 10))}
            </Text>
          </View>
          <View style={[styles.readingBody, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.readingText, { color: theme.foreground }]}>{readingLetter.text}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

interface LetterCardProps {
  letter: TimeCapsuleLetter;
  isDark: boolean;
  theme: any;
  onOpen: () => void;
  onRead: () => void;
  onDelete: () => void;
}

function LetterCard({ letter, isDark, theme, onOpen, onRead, onDelete }: LetterCardProps) {
  const remaining = daysUntil(letter.openDate);
  const isReady = remaining <= 0;
  const isOpened = letter.opened;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: isReady && !isOpened ? ACCENT + "66" : theme.border }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.cardIcon]}>
          {isOpened ? "📖" : isReady ? "✉️" : "🔒"}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardDate, { color: isReady && !isOpened ? ACCENT : theme.mutedForeground }]}>
            {isOpened
              ? `Прочитано · ${formatDateRu(letter.openDate)}`
              : isReady
              ? "Готово к прочтению"
              : `Откроется ${formatDateRu(letter.openDate)}`}
          </Text>
          {!isReady && !isOpened && (
            <Text style={[styles.cardCountdown, { color: theme.mutedForeground }]}>
              через {remaining} {daysWord(remaining)}
            </Text>
          )}
          {isOpened && (
            <Text style={[styles.cardPreview, { color: theme.mutedForeground }]} numberOfLines={2}>
              {letter.text}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color={theme.mutedForeground} />
        </TouchableOpacity>
      </View>

      {isReady && !isOpened && (
        <TouchableOpacity
          style={[styles.openBtn, { backgroundColor: ACCENT }]}
          onPress={onOpen}
          activeOpacity={0.8}
        >
          <Text style={styles.openBtnText}>Открыть письмо</Text>
        </TouchableOpacity>
      )}

      {isOpened && (
        <TouchableOpacity
          style={[styles.readBtn, { borderColor: theme.border }]}
          onPress={onRead}
          activeOpacity={0.7}
        >
          <Text style={[styles.readBtnText, { color: theme.foreground }]}>Читать</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
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
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  listContent: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySub: { fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: 24 },
  emptyBtn: { marginTop: 8, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText: { fontSize: 16, fontWeight: "600" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardIcon: { fontSize: 28, lineHeight: 34 },
  cardDate: { fontSize: 14, fontWeight: "600" },
  cardCountdown: { fontSize: 13, marginTop: 2 },
  cardPreview: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  deleteBtn: { padding: 4 },
  openBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  openBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  readBtn: { borderRadius: 12, paddingVertical: 10, alignItems: "center", borderWidth: 1 },
  readBtnText: { fontWeight: "600", fontSize: 14 },
  composeContent: { paddingHorizontal: 20, paddingTop: 20 },
  composeLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  textAreaWrap: { borderRadius: 14, borderWidth: 1, padding: 14 },
  textArea: { fontSize: 16, lineHeight: 24, minHeight: 180 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  presetBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  presetBtnText: { fontSize: 14, fontWeight: "500" },
  datePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  datePickerText: { flex: 1, fontSize: 15 },
  webDateInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  sealBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  sealBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  readingContent: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  readingMeta: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readingMetaLabel: { fontSize: 13, fontWeight: "500" },
  readingMetaValue: { fontSize: 14, fontWeight: "600" },
  readingBody: { borderRadius: 16, borderWidth: 1, padding: 20 },
  readingText: { fontSize: 17, lineHeight: 28 },
});
