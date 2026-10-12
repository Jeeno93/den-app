import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import { withSystemUi } from "@/src/utils/systemUi";

/**
 * Замок на вход: отпечаток или PIN самого телефона.
 *
 * Своего пароля нет намеренно — забытый пароль стоил бы человеку дневника,
 * ведь записи хранятся только на телефоне и восстановить их неоткуда.
 * Система сама предлагает отпечаток, лицо или PIN/графический ключ.
 */
const APP_LOCK_KEY = "app_lock_enabled";

export async function isAppLockEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return (await AsyncStorage.getItem(APP_LOCK_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_KEY, enabled ? "true" : "false");
}

/** Есть ли на телефоне хоть какая-то блокировка экрана, через которую можно проверить. */
export async function canUseAppLock(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/**
 * Системный запрос отпечатка или PIN. Окно системы уводит приложение в фон,
 * поэтому помечаем его как системный экран — иначе возврат из него сам
 * запускал бы замок заново.
 */
export async function authenticate(promptMessage: string): Promise<boolean> {
  try {
    const result = await withSystemUi(() =>
      LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: "Отмена",
        disableDeviceFallback: false,
      }),
    );
    return result.success;
  } catch {
    return false;
  }
}
