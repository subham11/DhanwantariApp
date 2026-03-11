import React, {useCallback} from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {usePressScale} from '@hooks/useAnimations';

const AnimTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface AnimatedPressableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  hapticType?: 'impactLight' | 'impactMedium' | 'impactHeavy' | 'selection';
  scale?: number;
}

const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  haptic = true,
  hapticType = 'impactLight',
  scale = 0.96,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const {animatedStyle, onPressIn: scalePressIn, onPressOut: scalePressOut} =
    usePressScale(scale);

  const handlePressIn = useCallback(
    (e: any) => {
      scalePressIn();
      onPressIn?.(e);
    },
    [scalePressIn, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scalePressOut();
      onPressOut?.(e);
    },
    [scalePressOut, onPressOut],
  );

  const handlePress = useCallback(
    (e: any) => {
      if (haptic) {
        ReactNativeHapticFeedback.trigger(hapticType, {
          enableVibrateFallback: false,
          ignoreAndroidSystemSettings: false,
        });
      }
      onPress?.(e);
    },
    [haptic, hapticType, onPress],
  );

  return (
    <AnimTouchable
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[animatedStyle, style]}
      {...rest}>
      {children}
    </AnimTouchable>
  );
};

export default AnimatedPressable;
