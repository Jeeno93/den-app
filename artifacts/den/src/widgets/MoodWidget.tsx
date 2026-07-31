import React from "react";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import { moodSvgString } from "./moodWidgetIcons";

// Цвета продублированы из MOODS в MoodPicker.tsx — импортировать сам
// MoodPicker сюда небезопасно (это полноценный RN-компонент с Haptics и
// LinearGradient, не предназначенный для рендера в виджет-дерево).
const MOODS = [
  { value: 1, color: "#7B8FA1" },
  { value: 2, color: "#A8B5C1" },
  { value: 3, color: "#90C8A8" },
  { value: 4, color: "#5BAD8F" },
  { value: 5, color: "#5EE6A8" },
] as const;

interface MoodWidgetProps {
  selectedMood?: number | null;
}

export function MoodWidget({ selectedMood }: MoodWidgetProps) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#06080B",
        borderRadius: 20,
        padding: 14,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget
        text={selectedMood ? "Настроение записано" : "Как настроение?"}
        style={{ fontSize: 12, color: "#B3BCC8", marginBottom: 10 }}
      />
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-evenly",
          width: "match_parent",
        }}
      >
        {MOODS.map((mood) => (
          <FlexWidget
            key={mood.value}
            clickAction="SELECT_MOOD"
            clickActionData={{ mood: mood.value }}
            accessibilityLabel={`Настроение ${mood.value} из 5`}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              ...(selectedMood === mood.value
                ? { backgroundColor: "rgba(94, 230, 168, 0.18)" as const }
                : {}),
            }}
          >
            <SvgWidget svg={moodSvgString(mood.value, mood.color)} style={{ width: 26, height: 26 }} />
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
