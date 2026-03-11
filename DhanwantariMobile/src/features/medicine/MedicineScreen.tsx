/**
 * MedicineScreen.tsx
 *
 * Displays medicines for a specific disease in three sections:
 *   1. Generic Medicines    — standard allopathic
 *   2. JanAushadhi Medicines — generic affordable alternatives
 *   3. Ayurvedic Medicines   — AYUSH traditional remedies
 *
 * Also shows confirmation tests (FYI, not a prescription).
 */

import React, {useEffect, useState, useCallback} from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StatusBar,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getDiseaseById} from '@services/db';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';
import type {Disease, RootStackParamList} from '@store/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicineDetail'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitLines(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ─── Medicine Section ─────────────────────────────────────────────────────────

interface MedicineSectionProps {
  title: string;
  accentColor: string;
  icon: string;
  items: string[];
  emptyText?: string;
}

function MedicineSection({
  title,
  accentColor,
  icon,
  items,
  emptyText,
}: MedicineSectionProps): React.ReactElement {
  if (items.length === 0 && !emptyText) return <></>;

  return (
    <View style={[styles.section, {borderLeftColor: accentColor}]}>
      <Text style={[styles.sectionTitle, {color: accentColor}]}>
        {icon}  {title}
      </Text>
      {items.length > 0 ? (
        items.map((item, idx) => (
          <View key={idx} style={styles.medicineRow}>
            <View style={[styles.medicineBullet, {backgroundColor: accentColor}]} />
            <Text style={styles.medicineText}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MedicineScreen({route, navigation}: Props): React.ReactElement {
  const {diseaseId, diseaseName} = route.params;
  const insets = useSafeAreaInsets();
  const [disease, setDisease] = useState<Disease | null>(null);

  useEffect(() => {
    getDiseaseById(diseaseId)
      .then(setDisease)
      .catch(err => console.warn('[MedicineScreen]', err));
  }, [diseaseId]);

  const openJanAushadhi = useCallback(() => {
    Linking.openURL('https://janaushadhi.gov.in/').catch(() => {
      /* ignore if no browser */
    });
  }, []);

  const genericMeds = splitLines(disease?.generic_medicines);
  const janMeds = splitLines(disease?.janaushadhi_medicines);
  const ayurMeds = splitLines(disease?.ayurvedic_medicines);
  const tests = splitLines(disease?.confirmation_tests_curated ?? disease?.tests);
  const notes = disease?.important_notes?.trim();

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.screenLabel}>Medicines</Text>
          <Text style={styles.diseaseName} numberOfLines={2}>
            {diseaseName}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: insets.bottom + Spacing['2xl']},
        ]}
        showsVerticalScrollIndicator={false}>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerIcon}>⚕️</Text>
          <Text style={styles.disclaimerText}>
            This information is for ASHA workers. Medicines should only be
            dispensed or recommended by a qualified healthcare provider.
          </Text>
        </View>

        {/* Generic Medicines */}
        <MedicineSection
          title="Generic Medicines"
          accentColor={Colors.primary}
          icon="💊"
          items={genericMeds}
          emptyText="No generic medicine data available."
        />

        {/* JanAushadhi */}
        <MedicineSection
          title="JanAushadhi Alternatives"
          accentColor={Colors.success}
          icon="🏥"
          items={janMeds}
        />
        {janMeds.length > 0 && (
          <TouchableOpacity
            style={styles.janAushadhiButton}
            onPress={openJanAushadhi}
            activeOpacity={0.8}>
            <Text style={styles.janAushadhiButtonText}>
              Find Nearest Jan Aushadhi Kendra →
            </Text>
          </TouchableOpacity>
        )}

        {/* Ayurvedic */}
        <MedicineSection
          title="Ayurvedic / AYUSH Remedies"
          accentColor={Colors.warning}
          icon="🌿"
          items={ayurMeds}
        />

        {/* Recommended Tests */}
        {tests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: Colors.muted}]}>
              🔬  Recommended Tests
            </Text>
            {tests.map((t, i) => (
              <View key={i} style={styles.medicineRow}>
                <View style={[styles.medicineBullet, {backgroundColor: Colors.muted}]} />
                <Text style={styles.medicineText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Important Notes */}
        {notes ? (
          <View style={[styles.notesCard, Shadows.sm]}>
            <Text style={styles.notesTitle}>⚠️  Important Notes</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}
      </ScrollView>
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
  disclaimer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59,91,219,0.07)',
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  disclaimerIcon: {
    fontSize: 18,
  },
  disclaimerText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: Typography.xs * Typography.relaxed,
  },
  section: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  medicineBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  medicineText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sm * Typography.relaxed,
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  janAushadhiButton: {
    backgroundColor: Colors.success,
    borderRadius: Radii.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
    marginTop: -Spacing.xs,
  },
  janAushadhiButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textInverse,
  },
  notesCard: {
    backgroundColor: 'rgba(245,124,0,0.08)',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245,124,0,0.20)',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  notesTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.warning,
  },
  notesText: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sm * Typography.relaxed,
  },
});
