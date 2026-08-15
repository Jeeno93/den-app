import React from "react";
import { View, type ViewProps } from "react-native";

/**
 * No-op fallback for web/iOS — see MaskView.android.tsx (picked automatically
 * by Metro on Android) for the real masking. Session Replay itself is
 * Android-only in this app (see sessionReplay.ts), so there's nothing to
 * mask on other platforms.
 */
export function MaskView({ children, style }: ViewProps & { children?: React.ReactNode }) {
  return <View style={style}>{children}</View>;
}
