import type { WidgetTaskHandler } from "react-native-android-widget";
import * as amplitude from "@amplitude/analytics-react-native";
import { MoodWidget } from "./MoodWidget";
import { formatDate, getDay, setTodayMood } from "@/src/storage/storage";

export const moodWidgetTaskHandler: WidgetTaskHandler = async (props) => {
  const { widgetAction, clickAction, clickActionData, renderWidget } = props;

  // Виджет остаётся визуально пустым на реальных устройствах, а
  // widget_mood_selected ни разу не срабатывал ни у одного пользователя —
  // не могли воспроизвести на препросмотре (виджеты не рендерятся в вебе).
  // Раньше единственным окном в headless-выполнение было onFailure
  // AsyncStorage/renderWidget без какой-либо видимости — трекаем сам факт
  // вызова хендлера и любое исключение, чтобы отличить "хендлер не
  // запускается" от "запускается, но падает внутри".
  amplitude.track("widget_task_invoked", { widgetAction, clickAction: clickAction ?? null });

  try {
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
  } catch (error) {
    amplitude.track("widget_task_failed", {
      widgetAction,
      clickAction: clickAction ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    // Рендерим хоть что-то вместо того, чтобы оставить виджет совсем без
    // RemoteViews — если это и есть причина «пустого» виджета, отсюда
    // он хотя бы начнёт показывать нейтральное состояние.
    try {
      renderWidget(<MoodWidget selectedMood={null} />);
    } catch {}
  }
};
