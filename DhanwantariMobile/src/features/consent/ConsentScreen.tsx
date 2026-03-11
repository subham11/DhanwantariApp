/**
 * ConsentScreen.tsx
 *
 * Advisory consent screen — shown once on first launch.
 * Blocks all clinical navigation until the ASHA worker
 * explicitly acknowledges the advisory notice.
 *
 * Compliance:
 *   - CDSCO Class A clinical decision support (non-diagnostic)
 *   - Digital Personal Data Protection Act 2023 (DPDP) §7(a)
 *   - v2.2 §8.2 ASHA Consent Layer
 */

import React, {useState} from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';
import type {RootStackParamList} from '@store/types';
import {grantConsent} from '../../privacy/ConsentManager';
import {useAppDispatch} from '@hooks/useAppDispatch';
import {setConsentGranted} from '@store/deviceSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'Consent'>;

// ─── Consent text ─────────────────────────────────────────────────────────────

const ADVISORY_TITLE = 'DhanwantariAI — Clinical Advisory Notice';

const SECTIONS = [
  {
    icon: '⚕️',
    heading: 'Clinical Decision Support Only',
    body:
      'DhanwantariAI is a Class A clinical decision support tool designed exclusively for trained ASHA workers. It does NOT diagnose disease. All outputs are advisory. Final clinical decisions must be made by qualified healthcare professionals.',
  },
  {
    icon: '🔒',
    heading: 'Data Privacy (DPDP Act 2023)',
    body:
      'This app processes health information locally on your device. No personally identifiable patient information is sent to external servers. Cloud escalation uses anonymised symptom summaries only. Data is used solely to improve clinical guidance quality.',
  },
  {
    icon: '🏥',
    heading: 'Emergency Protocol',
    body:
      'When the app flags IMMEDIATE risk, the ASHA worker must call 108 (Ambulance) and contact the nearest PHC Medical Officer. Do not delay referral for any clinical decision support output.',
  },
  {
    icon: '📋',
    heading: 'CDSCO Classification',
    body:
      'Registered under CDSCO Medical Device Rules 2017 as a Class A (low-risk) software as medical device (SaMD). Not intended for autonomous diagnosis, screening, or treatment planning.',
  },
  {
    icon: '🌿',
    heading: 'Ayurvedic & AYUSH References',
    body:
      'Traditional medicine references are informational only. AYUSH suggestions do not replace allopathic diagnosis or NHM standard treatment protocols.',
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ConsentScreen({navigation}: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await grantConsent('advisory_acknowledgement');
      dispatch(setConsentGranted(true));
      navigation.replace('ProfileList');
    } catch (e) {
      console.warn('[Consent] grant failed:', e);
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header */}
      <View style={styles.headerBand}>
        <Text style={styles.appName}>🌿 DhanwantariAI</Text>
        <Text style={styles.versionTag}>v2.2 · CDSCO Class A</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: insets.bottom + 120},
        ]}
        showsVerticalScrollIndicator={false}>

        {/* Title */}
        <Text style={styles.title}>{ADVISORY_TITLE}</Text>
        <Text style={styles.subtitle}>
          Please read and acknowledge the following before using DhanwantariAI
          for clinical decision support.
        </Text>

        {/* Consent sections */}
        {SECTIONS.map((s, i) => (
          <View key={i} style={[styles.sectionCard, Shadows.sm]}>
            <Text style={styles.sectionIcon}>{s.icon}</Text>
            <View style={styles.sectionBody}>
              <Text style={styles.sectionHeading}>{s.heading}</Text>
              <Text style={styles.sectionText}>{s.body}</Text>
            </View>
          </View>
        ))}

        {/* Consent statement */}
        <View style={styles.consentStatement}>
          <Text style={styles.consentStatementText}>
            By tapping <Text style={styles.bold}>"I Understand — Continue"</Text>{' '}
            you confirm that:{'\n'}
            {'\u2022'} You are a trained ASHA / Health Worker{'\n'}
            {'\u2022'} You will use this tool as advisory support only{'\n'}
            {'\u2022'} You will not delay emergency referrals for any app output{'\n'}
            {'\u2022'} You accept the data privacy terms above
          </Text>
        </View>
      </ScrollView>

      {/* Pinned CTA */}
      <View
        style={[styles.ctaContainer, {paddingBottom: insets.bottom + Spacing.md}]}>
        <TouchableOpacity
          style={[styles.acceptButton, loading && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={loading}
          activeOpacity={0.85}>
          {loading ? (
            <ActivityIndicator size="small" color={Colors.textInverse} />
          ) : (
            <Text style={styles.acceptButtonText}>
              ✓  I Understand — Continue
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          Consent is stored locally. You can review it in Settings.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBand: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  appName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
    letterSpacing: 0.5,
  },
  versionTag: {
    fontSize: Typography.xs,
    color: Colors.primaryLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    lineHeight: Typography.lg * Typography.tight,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    lineHeight: Typography.sm * Typography.relaxed,
  },
  sectionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  sectionIcon: {
    fontSize: 26,
    lineHeight: 32,
  },
  sectionBody: {
    flex: 1,
    gap: 4,
  },
  sectionHeading: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  sectionText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    lineHeight: Typography.xs * Typography.relaxed,
  },
  consentStatement: {
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  consentStatementText: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sm * Typography.relaxed,
  },
  bold: {
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  ctaContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },
  footerNote: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
