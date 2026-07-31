import type { WidgetTaskHandler } from "react-native-android-widget";
import * as amplitude from "@amplitude/analytics-react-native";
import { MoodWidget } from "./MoodWidget";
import { formatDate, getDay, setTodayMood } from "@/src/storage/storage";

export const moodWidgetTaskHandler: WidgetTaskHandler = async (props) => {
  const { widgetAction, clickAction, clickActionData, renderWidget } = props;

  if (widgetAction === "WIDGET_CLICK" && clickAction === "SELECT_MOOD") {
    const mood = Number((clickActionData as { mood?: number })?.mood);
    if (mood >= 1 && mood <= 5) {
      await setTodayMood(mood);
      // Отдельное событие, не fill_started/fill_completed — это лёгкая
      // отметка настроения без полного flow заполнения, отличать в аналитике.
      amplitude.track("widget_mood_selected", { mood });
      renderWidget(<MoodWidget selectedMood={mood} />);
      return;
    }
  }

  // WIDGET_ADDED, WIDGET_UPDATE, WIDGET_RESIZED — просто отрисовать текущее
  // состояние (mood за сегодня, если уже отмечено).
  const today = await getDay(formatDate(new Date()));
  renderWidget(<MoodWidget selectedMood={today?.mood ?? null} />);
};
