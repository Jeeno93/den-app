import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";

const ONBOARDING_KEY = "onboarding_done";

const BG = "#06080B";
const ACCENT = "#5EE6A8";
const WHITE = "#ffffff";
const SUBTITLE = "#B3BCC8";
const CARD_BG = "rgba(255,255,255,0.05)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CTA_COLORS = ["#1B6B4A", "#5EE6A8", "#2A7A58"] as const;
const CTA_START = { x: 0, y: 0 };
const CTA_END = { x: 1, y: 0 };

const SLIDES = [
  {
    emoji: "📖",
    title: "Добро пожаловать\nв Den",
    text: "Ежедневный дневник для тех,\nкто никогда не вёл дневник.",
    hasLearnMore: false,
  },
  {
    emoji: "✍️",
    title: "Пять вопросов\nкаждый вечер",
    text: "Что узнал, кого встретил,\nчто рассмешило — всё займёт 2 минуты.",
    hasLearnMore: false,
  },
  {
    emoji: "🗓️",
    title: "Через год\nне оторвёшься",
    text: "Читай что писал год назад.\nСледи за своим настроением.",
    hasLearnMore: false,
  },
  {
    emoji: "🧠",
    title: "Это работает на уровне\nнейробиологии",
    text: "Рефлексия снижает тревожность, укрепляет память и помогает замечать закономерности в своей жизни.",
    hasLearnMore: true,
  },
];

const WHY_BLOCKS = [
  {
    emoji: "🧠",
    title: "Мозг не умеет хранить информацию о прожитом дне",
    text: "Каждый вечер гиппокамп решает, что оставить в памяти, а что удалить. Без записи большинство моментов стирается из памяти за 24 часа. Дневник — это внешняя память, которая ничего не забывает.",
  },
  {
    emoji: "🔬",
    title: "Рефлексия меняет химический состав мозга",
    text: "Когда вы описываете событие словами, префронтальная кора берет контроль над миндалевидным телом. Тревожность снижается, эмоции становятся более ясными. Это не метафора, а нейробиологический факт.",
  },
  {
    emoji: "📊",
    title: "Привычки, которые ты не замечаешь",
    text: "Через месяц записей ты увидишь, что портит тебе настроение, кто заряжает тебя энергией, в какие дни ты продуктивен. Мозг плохо замечает привычки, а записи — замечают.",
  },
  {
    emoji: "📖",
    title: "Письмо себе в будущее",
    text: "Читать записи годичной давности — одно из самых странных и сильных переживаний. Ты видишь, кем был, как изменился, что осталось важным. Без дневника это невозможно.",
  },
];

const SHARE_TEXT =
  "Я веду дневник в приложении Den — оно каждый вечер задает пять вопросов. Вот почему это работает: https://play.google.com/store/apps/details?id=com.den";

interface OnboardingProps {
  visible: boolean;
  onDone: () => void;
}

function WhyDiaryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleShare() {
    try { await Share.share({ message: SHARE_TEXT }); } catch {}
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent transparent={false}>
      {Platform.OS === "android" && <StatusBar backgroundColor={BG} barStyle="light-content" />}
      <View style={whyStyles.root}>
        <View style={[whyStyles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity style={whyStyles.backBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={whyStyles.headerTitle}>Зачем вести дневник?</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            whyStyles.container,
            { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom + 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {WHY_BLOCKS.map((block, i) => (
            <View key={i} style={whyStyles.card}>
              <Text style={whyStyles.cardEmoji}>{block.emoji}</Text>
              <Text style={whyStyles.cardTitle}>{block.title}</Text>
              <Text style={whyStyles.cardText}>{block.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[whyStyles.footer, { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16 }]}>
          <TouchableOpacity style={whyStyles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <LinearGradient colors={CTA_COLORS} start={CTA_START} end={CTA_END} style={whyStyles.shareBtnGradient}>
              <Ionicons name="share-social-outline" size={20} color={WHITE} />
              <Text style={whyStyles.shareBtnText}>Поделиться</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function Onboarding({ visible, onDone }: OnboardingProps) {
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const [showWhyDiary, setShowWhyDiary] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  function animateToSlide(next: number) {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setSlide(next);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      ]).start();
    });
  }

  async function handleNext() {
    if (slide < SLIDES.length - 1) {
      animateToSlide(slide + 1);
    } else {
      // Request notification permission on the last slide before finishing
      if (Platform.OS !== "web") {
        try {
          await Notifications.requestPermissionsAsync();
        } catch {}
      }
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      onDone();
    }
  }

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent={false}>
      {Platform.OS === "android" && <StatusBar backgroundColor={BG} barStyle="light-content" />}
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.emoji}>{current.emoji}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.text}>{current.text}</Text>
        </Animated.View>

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === slide ? ACCENT : WHITE + "30",
                    width: i === slide ? 20 : 7,
                  },
                ]}
              />
            ))}
          </View>

          {current.hasLearnMore && (
            <TouchableOpacity
              style={styles.learnMoreBtn}
              onPress={() => setShowWhyDiary(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="book-outline" size={16} color={WHITE} />
              <Text style={styles.learnMoreText}>Узнать больше</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleNext} activeOpacity={0.85} style={styles.buttonWrap}>
            <LinearGradient colors={CTA_COLORS} start={CTA_START} end={CTA_END} style={styles.button}>
              <Text style={styles.buttonText}>{isLast ? "Начать" : "Далее"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <WhyDiaryModal visible={showWhyDiary} onClose={() => setShowWhyDiary(false)} />
    </Modal>
  );
}

export async function checkOnboardingDone(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_KEY);
  return val === "true";
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    width: "100%",
  },
  emoji: {
    fontSize: 88,
    lineHeight: 100,
    textAlign: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 38,
  },
  text: {
    fontSize: 17,
    color: SUBTITLE,
    textAlign: "center",
    lineHeight: 26,
    maxWidth: SCREEN_WIDTH - 80,
  },
  bottom: {
    width: "100%",
    gap: 12,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 8,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  learnMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    width: "100%",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  learnMoreText: {
    fontSize: 15,
    fontWeight: "500",
    color: WHITE,
  },
  buttonWrap: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
  },
  button: {
    width: "100%",
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
  },
});

const whyStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 14,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  cardEmoji: {
    fontSize: 36,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
    lineHeight: 24,
  },
  cardText: {
    fontSize: 15,
    color: SUBTITLE,
    lineHeight: 23,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  shareBtn: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
  },
  shareBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 28,
    paddingVertical: 15,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: WHITE,
  },
});
