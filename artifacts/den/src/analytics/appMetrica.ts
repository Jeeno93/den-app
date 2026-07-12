/**
 * No-op fallback for web and iOS — see appMetrica.android.ts (picked
 * automatically by Metro on Android) for the real implementation. Google
 * Play Install Referrer attribution is Android/Play-Store specific, and the
 * native AppMetrica module has no web implementation (importing it directly
 * crashes Metro web bundles at module-load time).
 */
export function initAppMetrica() {}
