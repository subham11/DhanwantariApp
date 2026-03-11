import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {Colors, Typography, Spacing, Radii} from '@theme/tokens';
import type {MatchTier, SeverityLevel} from '@store/types';

// ─── Match Tier Badge ─────────────────────────────────────────────────────────

interface MatchBadgeProps {
  tier: MatchTier;
  score?: number;
  style?: ViewStyle;
}

const TIER_COLORS: Record<MatchTier, string> = {
  'High Match': Colors.highMatch,
  'Medium Match': Colors.mediumMatch,
  'Low Match': Colors.lowMatch,
};

export const MatchBadge: React.FC<MatchBadgeProps> = ({tier, score, style}) => (
  <View style={[styles.badgeRow, style]}>
    <View style={[styles.badge, {backgroundColor: TIER_COLORS[tier]}]}>
      <Text style={styles.badgeText}>{tier}</Text>
    </View>
    {score !== undefined && (
      <View style={styles.scoreChip}>
        <Text style={styles.scoreText}>{score}%</Text>
      </View>
    )}
  </View>
);

// ─── Severity Badge ───────────────────────────────────────────────────────────

interface SeverityBadgeProps {
  severity: SeverityLevel;
  style?: ViewStyle;
  showDot?: boolean;
}

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  Mild: Colors.severityMild,
  Moderate: Colors.severityModerate,
  Severe: Colors.severitySevere,
};

const SEVERITY_BG: Record<SeverityLevel, string> = {
  Mild: 'rgba(46,125,50,0.10)',
  Moderate: 'rgba(245,124,0,0.10)',
  Severe: 'rgba(211,47,47,0.10)',
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  style,
  showDot = true,
}) => (
  <View
    style={[
      styles.severityContainer,
      {backgroundColor: SEVERITY_BG[severity]},
      style,
    ]}>
    {showDot && (
      <View
        style={[
          styles.severityDot,
          {backgroundColor: SEVERITY_COLORS[severity]},
        ]}
      />
    )}
    <Text style={[styles.label, {color: SEVERITY_COLORS[severity]}]}>
      Severity Assessment
    </Text>
    <View
      style={[
        styles.severityBadge,
        {backgroundColor: SEVERITY_COLORS[severity]},
      ]}>
      <Text style={styles.severityBadgeText}>{severity}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
  },
  badge: {
    paddingHorizontal: Spacing['3'],
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  badgeText: {
    color: Colors.textInverse,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  scoreChip: {
    paddingHorizontal: Spacing['3'],
    paddingVertical: 4,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  scoreText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  // Severity
  severityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    padding: Spacing['3'],
    gap: Spacing['2'],
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  severityBadge: {
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['2'],
    borderRadius: Radii.full,
  },
  severityBadgeText: {
    color: Colors.textInverse,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
});
