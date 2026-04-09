import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ONBOARDING_KEY = "onboarding_done";

const SLIDES = [
  {
    emoji: "📖",
    title: "Добро пожаловать\nв День",
    text: "Ежедневный дневник для тех,\nкто никогда не вёл дневник.",
  },
  {
    emoji: "✍️",
    title: "Пять вопросов\nкаждый вечер",
    text: "Что узнал, кого встретил,\nчто рассмешило — всё займёт 2 минуты.",
  },
  {
    emoji: "📅",
    title: "Через год\nне оторвёшься",
    text: "Читай что писал год назад.\nСледи за своим настроением.",
  },
];

const BG = "#1a5c42";
const ACCENT = "#3D9970";
const WHITE = "#ffffff";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingProps {
  visible: boolean;
  onDone: () => void;
}

export function Onboarding({ visible, onDone }: OnboardingProps) {
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
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
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      onDone();
    }
  }

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      transparent={false}
    >
      {Platform.OS === "android" && (
        <StatusBar backgroundColor={BG} barStyle="light-content" />
      )}
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
                    backgroundColor: i === slide ? WHITE : WHITE + "40",
                    width: i === slide ? 20 : 7,
                  },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: isLast ? WHITE : ACCENT }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonText, { color: isLast ? BG : WHITE }]}>
              {isLast ? "Начать" : "Далее"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
    color: WHITE,
    textAlign: "center",
    lineHeight: 38,
  },
  text: {
    fontSize: 17,
    color: WHITE + "CC",
    textAlign: "center",
    lineHeight: 26,
    maxWidth: SCREEN_WIDTH - 80,
  },
  bottom: {
    width: "100%",
    gap: 28,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  button: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
