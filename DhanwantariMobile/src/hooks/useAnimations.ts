import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {Easing} from 'react-native';
import {Animations} from '@theme/tokens';

// ─── Spring Presets ───────────────────────────────────────────────────────────

export const springs = {
  fast: Animations.springFast,
  normal: Animations.springNormal,
  slow: Animations.springSlow,
};

// ─── Fade ─────────────────────────────────────────────────────────────────────

export function useFadeIn(initialOpacity = 0, delay = 0) {
  const opacity = useSharedValue(initialOpacity);

  const animatedStyle = useAnimatedStyle(() => ({opacity: opacity.value}));

  const fadeIn = (toValue = 1) => {
    opacity.value = withTiming(toValue, {
      duration: delay > 0 ? Animations.durationNormal + delay : Animations.durationNormal,
      easing: Easing.out(Easing.ease),
    });
  };

  const fadeOut = (toValue = 0) => {
    opacity.value = withTiming(toValue, {
      duration: Animations.durationFast,
    });
  };

  return {opacity, animatedStyle, fadeIn, fadeOut};
}

// ─── Slide Up ─────────────────────────────────────────────────────────────────

export function useSlideUp(initialOffset = 30) {
  const translateY = useSharedValue(initialOffset);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}],
    opacity: opacity.value,
  }));

  const slideIn = () => {
    translateY.value = withSpring(0, springs.normal);
    opacity.value = withTiming(1, {duration: Animations.durationNormal});
  };

  const slideOut = () => {
    translateY.value = withSpring(initialOffset, springs.fast);
    opacity.value = withTiming(0, {duration: Animations.durationFast});
  };

  return {animatedStyle, slideIn, slideOut};
}

// ─── Scale In (entrance) ─────────────────────────────────────────────────────

export function useScaleIn(initialScale = 0.85) {
  const scale = useSharedValue(initialScale);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: opacity.value,
  }));

  const scaleIn = () => {
    scale.value = withSpring(1, springs.normal);
    opacity.value = withTiming(1, {duration: Animations.durationNormal});
  };

  return {animatedStyle, scaleIn};
}

// ─── Press Scale ──────────────────────────────────────────────────────────────

export function usePressScale(activeScale = 0.96) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const onPressIn = () => {
    scale.value = withSpring(activeScale, springs.fast);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, springs.normal);
  };

  return {animatedStyle, onPressIn, onPressOut};
}

// ─── Stagger Children ─────────────────────────────────────────────────────────

export function getStaggerDelay(index: number, base = 60): number {
  return index * base;
}

// ─── Pulse (for status dot) ───────────────────────────────────────────────────

export function usePulse() {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const startPulse = () => {
    scale.value = withSpring(1.3, springs.fast, () => {
      scale.value = withSpring(1, springs.slow);
    });
  };

  return {animatedStyle, startPulse};
}

// Re-export Animated for convenience
export {Animated, useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS};
