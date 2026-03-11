import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  Platform,
  StatusBar,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, Typography, Spacing} from '@theme/tokens';

interface GlassHeaderProps {
  title: string;
  subtitle?: string;
  statusDot?: 'ready' | 'offline' | 'connecting';
  rightContent?: React.ReactNode;
  leftContent?: React.ReactNode;
  style?: ViewStyle;
  titleStyle?: TextStyle;
}

const STATUS_DOT_COLORS = {
  ready: Colors.success,
  offline: Colors.muted,
  connecting: Colors.warning,
};

const STATUS_LABELS = {
  ready: 'Ready (local data only)',
  offline: 'Offline',
  connecting: 'Connecting...',
};

const GlassHeader: React.FC<GlassHeaderProps> = ({
  title,
  subtitle,
  statusDot,
  rightContent,
  leftContent,
  style,
  titleStyle,
}) => {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);

  return (
    <View style={[styles.container, {paddingTop}, style]}>
      <BlurView
        style={StyleSheet.absoluteFillObject}
        blurType="dark"
        blurAmount={18}
        reducedTransparencyFallbackColor={Colors.primary}
      />
      {/* Gradient overlay */}
      <View style={styles.overlay} />

      <View style={styles.row}>
        {leftContent && <View style={styles.leftSlot}>{leftContent}</View>}

        <View style={styles.titleBlock}>
          <Text style={[styles.title, titleStyle]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {statusDot && (
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  {backgroundColor: STATUS_DOT_COLORS[statusDot]},
                ]}
              />
              <Text style={styles.statusLabel}>{STATUS_LABELS[statusDot]}</Text>
            </View>
          )}
        </View>

        {rightContent && <View style={styles.rightSlot}>{rightContent}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    paddingBottom: Spacing['4'],
    paddingHorizontal: Spacing['5'],
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59,91,219,0.85)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing['2'],
  },
  leftSlot: {
    marginRight: Spacing['3'],
  },
  rightSlot: {
    marginLeft: Spacing['3'],
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: Colors.textInverse,
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: Typography.sm,
    fontWeight: Typography.regular,
    marginTop: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing['1'],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing['1'],
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
});

export default GlassHeader;
