import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as amplitude from "@amplitude/analytics-react-native";
import { authenticate, isAppLockEnabled } from "@/src/utils/appLock";
import { isSystemUiOpen } from "@/src/utils/systemUi";

// Короткий уход в фон (глянуть сообщение, выбрать файл для экспорта) не
// должен каждый раз требовать отпечаток. Запираем, если приложение было
// свёрнуто дольше этого времени.
const LOCK_AFTER_MS = 60_000;

const BG = "#06080B";
const ACCENT = "#5EE6A8";

/**
 * Закрывает приложение экраном замка при запуске и после долгого фона,
 * если замок включён в настройках. Дерево под ним не размонтируется, чтобы
 * незаконченная запись не терялась.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await authenticate("Вход в Den");
    prompting.current = false;
    if (ok) {
      setLocked(false);
      amplitude.track("app_lock_unlocked");
    }
  }, []);

  useEffect(() => {
    isAppLockEnabled().then((enabled) => {
      setLocked(enabled);
      setChecked(true);
      if (enabled) unlock();
    });
  }, [unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (next) => {
      if (next === "background") {
        if (!isSystemUiOpen()) backgroundedAt.current = Date.now();
        return;
      }
      if (next !== "active") return;
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since === null || Date.now() - since < LOCK_AFTER_MS) return;
      if (!(await isAppLockEnabled())) return;
      setLocked(true);
      unlock();
    });
    return () => sub.remove();
  }, [unlock]);

  // Пока не знаем, включён ли замок, ничего не показываем: иначе на долю
  // секунды мелькнули бы записи.
  if (!checked) return <View style={styles.cover} />;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked && (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
          <Ionicons name="lock-closed-outline" size={40} color={ACCENT} />
          <Text style={styles.title}>Den</Text>
          <Text style={styles.sub}>Дневник закрыт</Text>
          <TouchableOpacity style={styles.button} onPress={unlock} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Открыть</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: 8 },
  sub: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  button: { marginTop: 20, backgroundColor: ACCENT, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14 },
  buttonText: { color: BG, fontSize: 16, fontWeight: "700" },
});
