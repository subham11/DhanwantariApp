/**
 * ReferralGuidanceScreen.tsx
 *
 * Displays structured referral guidance for an ASHA worker:
 *   - Risk level badge (IMMEDIATE / URGENT / ROUTINE)
 *   - Referral facility (ASHA / PHC / CHC / FRU / Hospital)
 *   - Immediate actions checklist
 *   - Triggered rules / reasons
 *   - One-tap links: 108 Ambulance, ASHA helpline
 */

import React, {useCallback, useEffect, useState} from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';
import type {ReferralLevel, RiskLevel, RootStackParamList} from '@store/types';
import {referralLevelLabel, riskLevelLabel} from '@ai/RuleEngine';
import {Disclaimers} from '../../liability/DisclaimerManager';

type Props = NativeStackScreenProps<RootStackParamList, 'ReferralGuidance'>;

// ─── Theme helpers ────────────────────────────────────────────────────────────

function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'IMMEDIATE':
      return Colors.danger;
    case 'URGENT':
      return Colors.warning;
    case 'ROUTINE':
      return Colors.success;
  }
}

function referralColor(level: ReferralLevel): string {
  switch (level) {
    case 'ASHA_MANAGE':
      return Colors.success;
    case 'PHC':
      return Colors.primary;
    case 'CHC':
      return Colors.primaryDark;
    case 'FRU':
      return Colors.warning;
    case 'HOSPITAL':
      return Colors.danger;
  }
}

function referralIcon(level: ReferralLevel): string {
  switch (level) {
    case 'ASHA_MANAGE':
      return '🏠';
    case 'PHC':
      return '🏥';
    case 'CHC':
      return '🏨';
    case 'FRU':
      return '🚑';
    case 'HOSPITAL':
      return '🏛️';
  }
}

// ─── Static immediate-action lists ───────────────────────────────────────────

const IMMEDIATE_ACTIONS: Record<RiskLevel, string[]> = {
  IMMEDIATE: [
    'Call 108 (Ambulance) immediately',
    'Keep patient lying flat, do not give anything by mouth',
    'Maintain airway — Head-Tilt, Chin-Lift if unconscious',
    'Monitor breathing and pulse every 5 minutes',
    'Send alert to ASHA supervisor and PHC MO',
    'Accompany patient to ensure transport',
  ],
  URGENT: [
    'Arrange transport to PHC/CHC within 2 hours',
    'Record vitals (temperature, pulse, respiration rate)',
    'Keep patient calm and hydrated if conscious',
    'Notify ASHA supervisor and PHC staff in advance',
    'Carry referral slip with patient history',
    'Follow up within 24 hours after referral',
  ],
  ROUTINE: [
    'Manage at community level per standard ASHA protocol',
    'Provide first-line treatment and health education',
    'Schedule follow-up in 3–5 days',
    'Refer to PHC if symptoms worsen after 48 hours',
    'Document in ASHA diary / MCTS register',
  ],
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReferralGuidanceScreen({
  route,
  navigation,
}: Props): React.ReactElement {
  const {diseaseName, riskLevel, referralLevel, reasons} = route.params;
  const insets = useSafeAreaInsets();
  const [referralConfirmed, setReferralConfirmed] = useState(false);
  const isImmediate = riskLevel === 'IMMEDIATE';

  // Emergency lock: block back gesture + hardware back button until ASHA confirms
  useEffect(() => {
    if (isImmediate && !referralConfirmed) {
      navigation.setOptions({gestureEnabled: false});
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    } else {
      navigation.setOptions({gestureEnabled: true});
      return undefined;
    }
  }, [isImmediate, referralConfirmed, navigation]);

  const callAmbulance = useCallback(() => {
    const url = Platform.OS === 'android' ? 'tel:108' : 'telprompt:108';
    Linking.openURL(url).catch(() => {});
  }, []);

  const callASHAHelpline = useCallback(() => {
    const url = Platform.OS === 'android' ? 'tel:104' : 'telprompt:104';
    Linking.openURL(url).catch(() => {});
  }, []);

  const rColor = riskColor(riskLevel);
  const refColor = referralColor(referralLevel);
  const actions = reasons.length > 0 ? reasons : IMMEDIATE_ACTIONS[riskLevel];

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isImmediate && !referralConfirmed}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.screenLabel}>Referral Guidance</Text>
          <Text style={styles.diseaseName} numberOfLines={2}>
            {diseaseName}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: insets.bottom + (isImmediate && !referralConfirmed ? 120 : Spacing['2xl'])},
        ]}
        showsVerticalScrollIndicator={false}>

        {/* Emergency disclaimer banner (IMMEDIATE risk only) */}
        {isImmediate && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerTitle}>🚨 EMERGENCY PROTOCOL ACTIVE</Text>
            <Text style={styles.emergencyBannerText}>{Disclaimers.emergency}</Text>
          </View>
        )}

        {/* Risk level badge */}
        <View style={[styles.riskBadge, {backgroundColor: rColor}]}>
          <Text style={styles.riskBadgeText}>{riskLevelLabel(riskLevel)}</Text>
        </View>

        {/* Referral facility card */}
        <View style={[styles.facilityCard, Shadows.md, {borderLeftColor: refColor}]}>
          <Text style={styles.facilityIcon}>{referralIcon(referralLevel)}</Text>
          <View style={styles.facilityTextBlock}>
            <Text style={styles.facilityLabel}>Refer Patient To</Text>
            <Text style={[styles.facilityName, {color: refColor}]}>
              {referralLevelLabel(referralLevel)}
            </Text>
          </View>
        </View>

        {/* Emergency call buttons */}
        {(riskLevel === 'IMMEDIATE' || riskLevel === 'URGENT') && (
          <View style={styles.callRow}>
            <TouchableOpacity
              style={[styles.callButton, {backgroundColor: Colors.danger}]}
              onPress={callAmbulance}
              activeOpacity={0.8}>
              <Text style={styles.callButtonText}>📞 Call 108 Ambulance</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callButton, {backgroundColor: Colors.primary}]}
              onPress={callASHAHelpline}
              activeOpacity={0.8}>
              <Text style={styles.callButtonText}>📞 Health Helpline 104</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Immediate actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.actionsTitle}>
            {riskLevel === 'IMMEDIATE' ? '🚨 Emergency Actions' : '📋 Actions to Take'}
          </Text>
          {IMMEDIATE_ACTIONS[riskLevel].map((action, idx) => (
            <View key={idx} style={styles.actionRow}>
              <View style={[styles.actionBullet, {backgroundColor: rColor}]}>
                <Text style={styles.actionBulletText}>{idx + 1}</Text>
              </View>
              <Text style={styles.actionText}>{action}</Text>
            </View>
          ))}
        </View>

        {/* Triggered reasons */}
        {actions.length > 0 && (
          <View style={styles.reasonsSection}>
            <Text style={styles.reasonsTitle}>🔍 Clinical Reasoning</Text>
            {actions.map((reason, idx) => (
              <View key={idx} style={styles.reasonRow}>
                <Text style={styles.reasonBullet}>•</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        )}

        {/* NHM protocol note */}
        <View style={styles.protocolNote}>
          <Text style={styles.protocolText}>
            This guidance is based on National Health Mission protocols for ASHA workers.
            Always follow local PHC MO instructions and use clinical judgement.
          </Text>
        </View>
      </ScrollView>

      {/* Pinned referral confirmation bar (IMMEDIATE only, until confirmed) */}
      {isImmediate && !referralConfirmed && (
        <View style={[styles.confirmBar, {paddingBottom: insets.bottom + Spacing.md}]}>
          <Text style={styles.confirmBarHint}>
            Confirm you have referred the patient before leaving this screen.
          </Text>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => setReferralConfirmed(true)}
            activeOpacity={0.85}>
            <Text style={styles.confirmButtonText}>
              ✓  I have referred the patient
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  backIcon: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: Typography.semibold,
    lineHeight: 32,
  },
  headerText: {
    flex: 1,
  },
  screenLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  diseaseName: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    lineHeight: Typography.lg * Typography.tight,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  riskBadge: {
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  riskBadgeText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
    textAlign: 'center',
  },
  facilityCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderLeftWidth: 5,
  },
  facilityIcon: {
    fontSize: 32,
  },
  facilityTextBlock: {
    flex: 1,
  },
  facilityLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: Typography.medium,
  },
  facilityName: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    marginTop: 2,
  },
  callRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  callButton: {
    flex: 1,
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  callButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
  },
  actionsSection: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  actionsTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  actionBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionBulletText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
  },
  actionText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sm * Typography.relaxed,
    paddingTop: 2,
  },
  reasonsSection: {
    backgroundColor: 'rgba(59,91,219,0.06)',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  reasonsTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  reasonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  reasonBullet: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.bold,
    marginTop: 1,
  },
  reasonText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.relaxed,
  },
  protocolNote: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  protocolText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    lineHeight: Typography.xs * Typography.relaxed,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // ── Emergency lock styles ──────────────────────────────────────────────────
  emergencyBanner: {
    backgroundColor: Colors.danger,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 6,
  },
  emergencyBannerTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
    letterSpacing: 0.5,
  },
  emergencyBannerText: {
    fontSize: Typography.xs,
    color: Colors.textInverse,
    lineHeight: Typography.xs * Typography.relaxed,
    opacity: 0.92,
  },
  confirmBar: {
    backgroundColor: Colors.danger + 'F0',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  confirmBarHint: {
    fontSize: Typography.xs,
    color: Colors.textInverse,
    textAlign: 'center',
    opacity: 0.9,
  },
  confirmButton: {
    backgroundColor: Colors.textInverse,
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.danger,
  },
});
