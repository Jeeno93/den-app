import AppMetrica from "@appmetrica/react-native-analytics";
import * as amplitude from "@amplitude/analytics-react-native";
import { Identify } from "@amplitude/analytics-react-native";

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
        const identify = new Identify();
        for (const [key, value] of Object.entries(parameters)) {
          identify.setOnce(`acq_${key}`, value);
        }
        amplitude.identify(identify);
      }
    },
    onFailure: (error) => {
      amplitude.track("deeplink_params_failed", { error });
      // NOT_A_FIRST_LAUNCH is expected on every launch after the first.
      // NO_REFERRER/PARSE_ERROR/UNKNOWN mean no attribution data was found —
      // not an error worth surfacing to the user.
      if (error !== "NOT_A_FIRST_LAUNCH") {
        console.log("AppMetrica deferred deeplink parameters unavailable:", error);
      }
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
