/**
 * No-op fallback for web and iOS — see sessionReplay.android.ts (picked
 * automatically by Metro on Android) for the real implementation. The native
 * plugin uses requireNativeComponent, which has no web implementation and
 * crashes Metro web bundles at module-load time if imported directly.
 */
export function initSessionReplay() {}
