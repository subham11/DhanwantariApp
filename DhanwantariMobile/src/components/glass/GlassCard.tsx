import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {Colors, Radii, Shadows} from '@theme/tokens';

interface GlassCardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Blur intensity 0-100. Default 20 */
  blurAmount?: number;
  /** Override background color */
  tintColor?: string;
  activeOpacity?: number;
  onPress?: () => void;
  /** Border accent color for left side */
  accentColor?: string;
  radius?: number;
  disablePress?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  blurAmount = 20,
  tintColor = 'rgba(255,255,255,0.70)',
  activeOpacity = 0.92,
  onPress,
  accentColor,
  radius = Radii.lg,
  disablePress = false,
  ...rest
}) => {
  const Container = onPress && !disablePress ? TouchableOpacity : View;

  return (
    <Container
      activeOpacity={activeOpacity}
      onPress={onPress}
      style={[styles.wrapper, {borderRadius: radius}, Shadows.glass, style]}
      {...(onPress && !disablePress ? rest : {})}>
      {/* Blur layer */}
      <BlurView
        style={[StyleSheet.absoluteFillObject, {borderRadius: radius}]}
        blurType="light"
        blurAmount={blurAmount}
        reducedTransparencyFallbackColor="white"
      />
      {/* Glass tint */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: radius,
            backgroundColor: tintColor,
            borderWidth: 1,
            borderColor: Colors.glassBorder,
          },
        ]}
      />
      {/* Inner top highlight */}
      <View
        style={[
          styles.highlight,
          {borderRadius: radius, borderTopColor: Colors.glassHighlight},
        ]}
      />
      {/* Accent left border */}
      {accentColor && (
        <View
          style={[
            styles.accentBorder,
            {backgroundColor: accentColor, borderRadius: radius},
          ]}
        />
      )}
      {/* Content */}
      <View style={styles.content}>{children}</View>
    </Container>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.50)',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255,255,255,0.30)',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  accentBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  content: {
    position: 'relative',
  },
});

export default GlassCard;
