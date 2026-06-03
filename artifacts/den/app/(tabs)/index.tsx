import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getDayQuestion } from "@/src/data/questions";
import {
  formatDate,
  getDay,
  dismissDeepNudge,
  saveFillMode,
  shouldShowDeepNudge,
} from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { DayEntryView } from "@/src/components/DayEntry";
import { DayFillFlow } from "@/src/components/DayFillFlow";
import { DeepNudgeBanner } from "@/src/components/DeepNudgeBanner";

type Screen = "fill" | "view";

const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const WEEKDAYS = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];

function getTodayStr() {
  return formatDate(new Date());
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function parseDateObj(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

export default function HomeScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const todayStr = getTodayStr();

  const [viewDate, setViewDate] = useState<string>(todayStr);
  const [screen, setScreen] = useState<Screen>("fill");
  const [existingEntry, setExistingEntry] = useState<DayEntry | null>(null);
  const [showNudge, setShowNudge] = useState(false);
  const [deepSignal, setDeepSignal] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useFocusEffect(
    useCallback(() => {
      setViewDate(getTodayStr());
      shouldShowDeepNudge().then(setShowNudge);
    }, [])
  );

  useEffect(() => {
    let cancelled = false;
    async function loadDate() {
      const entry = await getDay(viewDate);
      if (cancelled) return;
      if (entry) {
        setExistingEntry(entry);
        setScreen("view");
      } else {
        setExistingEntry(null);
        setScreen("fill");
        animateIn();
      }
    }
    loadDate();
    return () => { cancelled = true; };
  }, [viewDate]);

  function animateIn() {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }

  function navigateTo(date: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewDate(date);
  }

  function goBack() { navigateTo(offsetDate(viewDate, -1)); }
  function goForward() {
    const next = offsetDate(viewDate, 1);
    if (next <= todayStr) navigateTo(next);
  }
  function goToday() { navigateTo(todayStr); }

  async function handleDismissNudge() {
    setShowNudge(false);
    await dismissDeepNudge();
  }

  async function handleTryDeep() {
    setShowNudge(false);
    await dismissDeepNudge();
    await saveFillMode("deep");
    // Live-switch the active fill flow to deep (no-op on the view screen,
    // where the preference above already applies to the next fill).
    setDeepSignal((n) => n + 1);
  }

  const viewDateObj = parseDateObj(viewDate);
  const dayQuestion = getDayQuestion(viewDateObj);

  const isToday = viewDate === todayStr;
  const isForwardDisabled = offsetDate(viewDate, 1) > todayStr;
  const dateStr = `${viewDateObj.getDate()} ${MONTHS[viewDateObj.getMonth()]}`;
  const dayStr = WEEKDAYS[viewDateObj.getDay()];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function NavHeader({ bordered = false }: { bordered?: boolean }) {
    return (
      <View
        style={[
          styles.navHeader,
          {
            paddingTop: topPad + 8,
            backgroundColor: theme.background,
            borderBottomColor: bordered ? theme.border : "transparent",
            borderBottomWidth: bordered ? 1 : 0,
          },
        ]}
      >
        <TouchableOpacity style={styles.navArrow} onPress={goBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.foreground} />
        </TouchableOpacity>

        <View style={styles.navCenter}>
          {!isToday ? (
            <TouchableOpacity onPress={goToday} style={[styles.todayBtn, { backgroundColor: theme.primary + "18", borderColor: theme.primary + "44" }]} activeOpacity={0.75}>
              <Ionicons name="today-outline" size={13} color={theme.primary} />
              <Text style={[styles.todayBtnText, { color: theme.primary }]}>Сегодня</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.navCenterPlaceholder} />
          )}
        </View>

        <TouchableOpacity
          style={[styles.navArrow, isForwardDisabled && styles.navArrowDisabled]}
          onPress={goForward}
          activeOpacity={isForwardDisabled ? 1 : 0.7}
          disabled={isForwardDisabled}
        >
          <Ionicons name="chevron-forward" size={24} color={isForwardDisabled ? theme.border : theme.foreground} />
        </TouchableOpacity>
      </View>
    );
  }

  const nudge = showNudge ? (
    <View style={[styles.nudgeWrap, { bottom: (Platform.OS === "web" ? 24 : insets.bottom) + 16 }]} pointerEvents="box-none">
      <DeepNudgeBanner onDismiss={handleDismissNudge} onTry={handleTryDeep} />
    </View>
  ) : null;

  if (screen === "view" && existingEntry) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <NavHeader bordered />
        <View style={[styles.viewDateRow, { borderBottomColor: theme.border }]}>
          <View>
            <Text style={[styles.dateText, { color: theme.foreground }]}>{dateStr}</Text>
            <Text style={[styles.dayText, { color: theme.mutedForeground }]}>{dayStr}</Text>
          </View>
          <View style={[styles.doneBadge, { backgroundColor: theme.primary + "22" }]}>
            <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
            <Text style={[styles.doneBadgeText, { color: theme.primary }]}>Записано</Text>
          </View>
        </View>
        <DayEntryView entry={existingEntry} dayQuestion={existingEntry.question || dayQuestion} />
        {nudge}
      </View>
    );
  }

  // Fill flow (no entry for this date yet)
  return (
    <Animated.View style={[styles.flex, { backgroundColor: theme.background, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <DayFillFlow
        key={viewDate}
        date={viewDate}
        topInset={topPad}
        header={<NavHeader />}
        showDateLabel
        doneVariant="view"
        applyDeepSignal={deepSignal}
        onSaved={(entry) => {
          setExistingEntry(entry);
          shouldShowDeepNudge().then(setShowNudge);
        }}
        onView={() => setScreen("view")}
      />
      {nudge}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  navArrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  navArrowDisabled: { opacity: 0.3 },
  navCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  navCenterPlaceholder: { height: 32 },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  todayBtnText: { fontSize: 13, fontWeight: "600" },
  viewDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  dateText: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  dayText: { fontSize: 15, fontWeight: "400", marginTop: 2 },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  doneBadgeText: { fontSize: 13, fontWeight: "600" },
  nudgeWrap: {
    position: "absolute",
    left: 16,
    right: 16,
  },
});
