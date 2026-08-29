import * as amplitude from "@amplitude/analytics-react-native";
import { Identify } from "@amplitude/analytics-react-native";
import { initSessionReplay } from "@/src/analytics/sessionReplay";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/src/context/ThemeContext";
import { NotificationProvider } from "@/src/context/NotificationContext";
import { Onboarding, checkOnboardingDone } from "@/src/components/Onboarding";
import { compactPhotoStorage, getAllDays, getLastKnownStreak, getStreak, setLastKnownStreak } from "@/src/storage/storage";
import { initAppMetrica, reportDiagnosticEvent } from "@/src/analytics/appMetrica";

amplitude.init(process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY ?? '');
// Резолвится в sessionReplay.android.ts на Android, sessionReplay.ts (no-op)
// на web/iOS — см. те файлы, почему это платформенный сплит, а не guard.
initSessionReplay();
console.log('Amplitude key:', process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY);

// Resolves to appMetrica.android.ts on Android, appMetrica.ts (no-op) on
// web/iOS — see those files for why this needs to be a platform split
// rather than a runtime Platform.OS check.
initAppMetrica();

// Диагностика расхождения DAU за 19 августа (Play Console 58 / AppMetrica 48
// / Amplitude 25): одно и то же событие с одним и тем же launch_id летит из
// одной и той же точки кода в обе системы. Если через несколько дней
// AppMetrica покажет по этому событию число, близкое к своим 48, а
// Amplitude — заметно меньше, значит Amplitude теряет события при доставке,
// а не просто строже считает "активность". См. reportDiagnosticEvent в
// appMetrica.android.ts.
const diagLaunchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
amplitude.track("diag_launch", { launch_id: diagLaunchId });
reportDiagnosticEvent("diag_launch", { launch_id: diagLaunchId });

// Виджет-хендлер регистрируется в ../index.ts, не здесь — headless-запуск
// виджета (обновление/клик, когда основной UI не открыт) не гарантированно
// доходит до этого route-модуля, а настоящей точке входа бандла — доходит.

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="day-detail" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="why-diary" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="letters" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="year-pixels" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="patterns" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Relocate any legacy inline base64 photos out of AsyncStorage so writes
    // stop failing with SQLITE_FULL. Fire-and-forget; safe to run every launch.
    compactPhotoStorage();
  }, []);

  useEffect(() => {
    // Fires unconditionally on every launch, before any feature-specific event
    // (fill_started etc.), so opens that never reach a tracked action are
    // still visible instead of looking identical to "never opened at all".
    // source distinguishes a cold start via notification tap from a direct open.
    (async () => {
      let source: "notification" | "direct" = "direct";
      let notificationType: string | undefined;
      if (Platform.OS !== "web") {
        try {
          const response = await Notifications.getLastNotificationResponseAsync();
          if (response) {
            source = "notification";
            const data = response.notification.request.content.data as Record<string, unknown>;
            notificationType = typeof data?.type === "string" ? data.type : "daily_reminder";
          }
        } catch {}
      }
      amplitude.track("app_opened", { source, notificationType });
    })();
  }, []);

  useEffect(() => {
    // Reports streak_broken when a previously-running streak (>=2 days) has
    // reset since the last launch, and refreshes current_streak/total_entries
    // as Amplitude user properties so retention can be sliced by engagement
    // level, not just tracked as an in-app-only stat.
    (async () => {
      const [streak, lastKnown, allDays] = await Promise.all([
        getStreak(),
        getLastKnownStreak(),
        getAllDays(),
      ]);
      if (lastKnown >= 2 && streak.current < lastKnown) {
        amplitude.track("streak_broken", { previousStreak: lastKnown });
      }
      await setLastKnownStreak(streak.current);
      amplitude.identify(
        new Identify()
          .set("current_streak", streak.current)
          .set("total_entries", allDays.length)
      );
    })();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      checkOnboardingDone().then((done) => {
        setShowOnboarding(!done);
        setOnboardingChecked(true);
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;
  if (!onboardingChecked) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <NotificationProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                  <Onboarding
                    visible={showOnboarding}
                    onDone={() => setShowOnboarding(false)}
                  />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </NotificationProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
