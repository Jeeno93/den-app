import AsyncStorage from "@react-native-async-storage/async-storage";
import AppMetrica from "@appmetrica/react-native-analytics";
import * as amplitude from "@amplitude/analytics-react-native";
import { Identify } from "@amplitude/analytics-react-native";

/**
 * Параметры атрибуции кладём в AsyncStorage и повторяем identify на следующих
 * запусках: клиент не может узнать, дошёл ли Identify до Amplitude (именно
 * так acq_* молча пропадали ~5 дней реальных установок), а setOnce
 * идемпотентен — повторы безопасны. После MAX_IDENTIFY_ATTEMPTS попыток
 * сдаёмся, чтобы не крутить вечный ретрай, и оставляем диагностический след.
 */
const PENDING_ACQ_KEY = "acq_params_pending";
const MAX_IDENTIFY_ATTEMPTS = 5;
const MAX_VALUE_LEN = 300;

interface PendingAcq {
  parameters: Record<string, string>;
  attempts: number;
}

function normalizeParameters(parameters: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parameters)) {
    out[key] = String(value).slice(0, MAX_VALUE_LEN);
  }
  return out;
}

function identifyAcq(parameters: Record<string, string>) {
  const identify = new Identify();
  for (const [key, value] of Object.entries(parameters)) {
    identify.setOnce(`acq_${key}`, value);
  }
  amplitude.identify(identify);
}

async function persistPendingAcq(parameters: Record<string, string>): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(PENDING_ACQ_KEY);
    const attempts = existing ? JSON.parse(existing)?.attempts ?? 0 : 0;
    await AsyncStorage.setItem(PENDING_ACQ_KEY, JSON.stringify({ parameters, attempts }));
  } catch {}
}

async function retryPendingAcqIdentify(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ACQ_KEY);
    if (!raw) return;
    const pending: PendingAcq = JSON.parse(raw);
    if (pending.attempts >= MAX_IDENTIFY_ATTEMPTS) {
      await AsyncStorage.removeItem(PENDING_ACQ_KEY);
      amplitude.track("acq_identify_gave_up", { attempts: pending.attempts });
      return;
    }
    identifyAcq(pending.parameters);
    pending.attempts += 1;
    await AsyncStorage.setItem(PENDING_ACQ_KEY, JSON.stringify(pending));
    amplitude.track("acq_identify_retried", { attempt: pending.attempts });
  } catch {}
}

/**
 * Метка источника для тех, у кого атрибуция не разобралась. Без неё все они
 * сваливаются в разрезах в (none) вместе с теми, у кого свойство просто ещё
 * не успело записаться, и органика становится неотличима от сбоя парсера.
 * Play Store отдаёт органическую установку строкой с utm_medium=organic —
 * по данным за 4-7 сентября именно она составляет большинство PARSE_ERROR.
 */
function fallbackRefFor(error: string, referrer?: string): string | null {
  // Каждый запуск после первого — не отсутствие атрибуции, а её отсутствие
  // здесь и сейчас; настоящее значение либо уже записано, либо не придёт.
  if (error === "NOT_A_FIRST_LAUNCH") return null;
  if (referrer?.includes("utm_medium=organic")) return "organic";
  if (error === "NO_REFERRER") return "no_referrer";
  return "unresolved";
}

/**
 * AppMetrica resolves the Google Play Install Referrer only on the very first
 * app launch after install — every later call fails with NOT_A_FIRST_LAUNCH,
 * so no local "already ran" guard is needed here.
 */
function bridgeAcquisitionAttributionToAmplitude() {
  AppMetrica.requestDeferredDeeplinkParameters({
    onSuccess: (parameters) => {
      const keys = Object.keys(parameters);
      // Diagnostic: acq_ properties never showed up in Amplitude in ~5 days of
      // real installs, with zero visibility into why (onFailure only logged
      // locally). Reporting the raw outcome lets us tell apart "API never
      // returns usable data" from "bridge code itself isn't running".
      amplitude.track("deeplink_params_received", { paramCount: keys.length, keys });
      if (keys.length > 0) {
        const normalized = normalizeParameters(parameters);
        persistPendingAcq(normalized);
        identifyAcq(normalized);
      }
    },
    onFailure: (error, referrer) => {
      // NOT_A_FIRST_LAUNCH — ожидаемое состояние на каждом запуске после
      // первого: referrer отдаётся один раз, и считать это «failed» нельзя,
      // иначе событие шумит на каждом холодном старте и смыкается
      // с реальными сбоями атрибуции в разрезах Amplitude.
      if (error === "NOT_A_FIRST_LAUNCH") return;
      // The native SDK passes the raw Play Install Referrer string alongside
      // PARSE_ERROR — capturing it is the only way to see, without device
      // access, what format actually broke the parser (macro casing/encoding
      // in the Yandex.Direct tracker link vs. AppMetrica's expected format).
      amplitude.track("deeplink_params_failed", { error, referrer: referrer?.slice(0, 500) });
      const fallbackRef = fallbackRefFor(String(error), referrer);
      if (fallbackRef) {
        const identify = new Identify();
        identify.setOnce("acq_ref", fallbackRef);
        amplitude.identify(identify);
      }
      console.log("AppMetrica deferred deeplink parameters unavailable:", error, referrer);
    },
  });
}

/**
 * Activates AppMetrica and bridges Google Play install-referrer attribution
 * into Amplitude as user properties (acq_<key>). Guarded on a non-empty key:
 * an empty/invalid apiKey can crash the native SDK on activate, and no key is
 * set yet until the app is registered in the AppMetrica console.
 *
 * Android-only file (see sibling appMetrica.ts for the no-op fallback) —
 * Google Play Install Referrer attribution is inherently Android/Play-Store
 * specific, and the native module has no web implementation.
 */
export function initAppMetrica() {
  const apiKey = process.env.EXPO_PUBLIC_APPMETRICA_API_KEY;
  if (!apiKey) return;
  AppMetrica.activate({ apiKey });
  retryPendingAcqIdentify();
  bridgeAcquisitionAttributionToAmplitude();
}

/**
 * Reports a deeper-than-install goal event to AppMetrica so Yandex.Direct
 * campaigns can eventually optimize on real engagement (e.g. "finished a
 * day entry") instead of just install count. Separate from the Amplitude
 * event of the same name — this one exists specifically to give the ad
 * platform something to target.
 */
export function reportGoalEvent(name: string) {
  AppMetrica.reportEvent(name);
}

/**
 * One-off diagnostic: fires the same event with the same correlation id into
 * AppMetrica from the identical call site where the Amplitude twin fires
 * (see _layout.tsx). Purpose: separate "Amplitude loses/never delivers a
 * real chunk of sessions" from "AppMetrica and Play Console just count
 * 'active' more loosely" — the Aug 19 DAU split was Play 58 / AppMetrica 48
 * / Amplitude 25. If AppMetrica's count of this exact event stays close to 48
 * while Amplitude's count of it stays close to 25, the gap is delivery, not
 * definition.
 */
export function reportDiagnosticEvent(name: string, attributes?: Record<string, any>) {
  AppMetrica.reportEvent(name, attributes);
}
