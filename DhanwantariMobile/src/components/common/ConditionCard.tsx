import React, {useEffect, useRef} from 'react';
import {StyleSheet, Text, View, Animated as RNAnimated} from 'react-native';
import {Colors, Typography, Spacing, Radii} from '@theme/tokens';
import {MatchBadge} from '@components/common/Badges';
import AnimatedPressable from '@components/common/AnimatedPressable';
import type {MatchedDisease} from '@store/types';

interface ConditionCardProps {
  match: MatchedDisease;
  index?: number;
  onPress?: (match: MatchedDisease) => void;
}

const TIER_ACCENT: Record<string, string> = {
  'High Match': Colors.highMatch,
  'Medium Match': Colors.mediumMatch,
  'Low Match': Colors.lowMatch,
};

const ConditionCard: React.FC<ConditionCardProps> = ({
  match,
  index = 0,
  onPress,
}) => {
  const translateY = useRef(new RNAnimated.Value(20)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay: index * 70,
        useNativeDriver: true,
      }),
      RNAnimated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, translateY, opacity]);

  const accentColor = TIER_ACCENT[match.tier] ?? Colors.muted;

  return (
    <RNAnimated.View style={{transform: [{translateY}], opacity}}>
      <AnimatedPressable
        onPress={() => onPress?.(match)}
        hapticType="selection"
        style={styles.card}>
        {/* Left accent border */}
        <View style={[styles.accentBar, {backgroundColor: accentColor}]} />

        <View style={styles.body}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={[styles.diseaseName, {color: accentColor}]}>
              {match.disease.name}
            </Text>
            <MatchBadge tier={match.tier} score={match.score} />
          </View>

          {/* Explanation */}
          <Text style={styles.explanation}>{match.explanation}</Text>

          {/* Matched symptoms */}
          {match.matchedSymptoms.length > 0 && (
            <View style={styles.matchedRow}>
              <Text style={styles.matchedLabel}>Matched: </Text>
              <Text style={styles.matchedSymptoms}>
                {match.matchedSymptoms.join(' / ')}
              </Text>
            </View>
          )}
        </View>
      </AnimatedPressable>
    </RNAnimated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    marginHorizontal: Spacing['4'],
    marginVertical: Spacing['2'],
    flexDirection: 'row',
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    padding: Spacing['4'],
    gap: Spacing['2'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing['2'],
  },
  diseaseName: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    flex: 1,
    flexShrink: 1,
  },
  explanation: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    lineHeight: Typography.sm * Typography.normal,
  },
  matchedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  matchedLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  matchedSymptoms: {
    color: Colors.success,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    flex: 1,
    textAlign: 'center',
  },
});

export default ConditionCard;
