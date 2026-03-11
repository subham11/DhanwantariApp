import React, {useRef, useEffect, useCallback, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Animated as RNAnimated,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {nanoid} from '@reduxjs/toolkit';
import {useAppDispatch, useAppSelector} from '@hooks/useAppDispatch';
import {useChatCompletionMutation} from '@services/llmApi';
import {buildSystemPrompt, generateOfflineResponse} from '@services/offlineFallback';
import {clearSelectedSymptoms} from '@store/symptomSlice';
import {AnalysisResult, RootStackParamList, FeedbackValue} from '@store/types';
import {assessRisk, riskLevelLabel, referralLevelLabel} from '@ai/RuleEngine';
import {enqueueFeedback} from '@services/FeedbackQueueService';
import {SeverityBadge, MatchBadge} from '@components/common/Badges';
import ConditionCard from '@components/common/ConditionCard';
import GlassCard from '@components/glass/GlassCard';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SymptomAnalysis'>;

// Renders text with **bold** markdown handled inline
const MarkdownText: React.FC<{children: string; style?: object}> = ({children, style}) => {
  const parts = children.split(/\*\*(.*?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{fontWeight: '700'}}>{part}</Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
};

const SymptomAnalysisScreen: React.FC<Props> = ({navigation, route}) => {
  const {profileId, result} = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const profile = useAppSelector(s => s.profile.profiles.find(p => p.id === profileId));

  const [llmAnalysis, setLlmAnalysis] = useState<string | null>(null);
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const llmFetchedRef = useRef(false);
  const [showAllConditions, setShowAllConditions] = useState(false);
  const [chatCompletion] = useChatCompletionMutation();
  const [analysisFeedback, setAnalysisFeedback] = useState<FeedbackValue>(null);
  const analysisFeedbackIdRef = useRef(nanoid());

  const ruleResult = React.useMemo(
    () => assessRisk(result.symptoms, result.matchedDiseases),
    [result.symptoms, result.matchedDiseases],
  );

  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(30)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, {toValue: 1, duration: 350, useNativeDriver: true}),
      RNAnimated.spring(slideAnim, {toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260}),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // LLM fallback: when the symptom matcher finds no diseases, ask the LLM directly
  useEffect(() => {
    if (result.matchedDiseases.length > 0 || llmFetchedRef.current) return;
    llmFetchedRef.current = true;
    setIsLlmLoading(true);

    const symptomsList = result.symptoms.join(', ');
    const systemPrompt = profile
      ? buildSystemPrompt(profile)
      : 'You are DhanwantariAI, a clinical decision support assistant.';
    const userPrompt =
      `Patient reports these symptoms: ${symptomsList}. Overall severity: ${result.severity}. ` +
      'The local disease database found no strong matches for these specific symptoms. ' +
      'Based purely on clinical knowledge, please suggest 2–3 possible conditions consistent with ' +
      'these symptoms, a brief plain-text explanation for each, and practical next steps the patient ' +
      'can take. Do NOT invent match-tier labels (e.g. High Match / Medium Match) — just plain text. ' +
      'Focus on conditions common in the Indian subcontinent. Keep the response concise and structured.';

    chatCompletion({
      model: 'local-model',
      messages: [
        {role: 'system', content: systemPrompt},
        {role: 'user', content: userPrompt},
      ],
      max_tokens: 512,
      temperature: 0.7,
      stream: false,
    })
      .unwrap()
      .then(res => {
        setLlmAnalysis(res.choices?.[0]?.message?.content ?? null);
      })
      .catch(() => {
        // LLM unreachable — use the offline engine
        setLlmAnalysis(
          generateOfflineResponse(
            `I have these symptoms: ${symptomsList}`,
            profile ?? null,
            [],
          ),
        );
      })
      .finally(() => setIsLlmLoading(false));
  }, [result, profile, chatCompletion]);

  const handleAnalysisFeedback = useCallback(
    async (value: 'up' | 'down') => {
      const newValue: FeedbackValue = analysisFeedback === value ? null : value;
      setAnalysisFeedback(newValue);

      if (newValue === 'down') {
        const queryText = `Symptoms: ${result.symptoms.join(', ')} | Severity: ${result.severity}`;
        const responseText = llmAnalysis ?? result.personalizedAnalysis ?? '';
        await enqueueFeedback(
          analysisFeedbackIdRef.current,
          profileId,
          queryText,
          responseText,
        );
      }
    },
    [analysisFeedback, result, llmAnalysis, profileId],
  );

  const handleDone = useCallback(() => {
    dispatch(clearSelectedSymptoms());
    navigation.navigate('Chat', {profileId, analysisResult: result});
  }, [dispatch, navigation, profileId, result]);

  const severityColor =
    result.severity === 'Severe'
      ? Colors.danger
      : result.severity === 'Moderate'
      ? Colors.warning
      : Colors.success;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Nav */}
      <View style={[styles.nav, {paddingTop: insets.top + Spacing['2']}]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.navBack}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Analysis Results</Text>
        <TouchableOpacity onPress={handleDone}>
          <Text style={styles.navDone}>Done</Text>
        </TouchableOpacity>
      </View>

      <RNAnimated.ScrollView
        style={[styles.flex, {opacity: fadeAnim, transform: [{translateY: slideAnim}]}]}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: insets.bottom + Spacing['8']},
        ]}
        showsVerticalScrollIndicator={false}>

        {/* Symptoms card */}
        <GlassCard
          style={styles.symptomsCard}
          accentColor={Colors.primary}
          tintColor="rgba(59,91,219,0.82)">
          <Text style={styles.symptomsLabel}>SYMPTOMS REPORTED</Text>
          <View style={styles.symptomsChips}>
            {result.symptoms.map(s => (
              <View key={s} style={styles.symptomChip}>
                <Text style={styles.symptomChipText}>{s}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Severity banner */}
        <View style={[styles.severityBanner, {borderLeftColor: severityColor}]}>
          <View style={styles.severityLeft}>
            <Text style={styles.severityTitle}>Clinical Severity</Text>
            <Text style={styles.severityHint}>
              Based on symptom count and critical indicators
            </Text>
          </View>
          <SeverityBadge severity={result.severity} />
        </View>

        {/* Personalized Analysis */}
        {result.personalizedAnalysis && (
          <View style={styles.analysisSection}>
            <Text style={styles.sectionHeading}>📋 Personalized Analysis</Text>
            <View style={[styles.analysisCard, {borderLeftColor: Colors.success}]}>
              <Text style={styles.analysisText}>{result.personalizedAnalysis}</Text>
            </View>
          </View>
        )}

        {/* Probable Conditions */}
        <View style={styles.conditionsSection}>
          <Text style={styles.sectionHeading}>
            🔍 Probable Conditions ({result.matchedDiseases.length})
          </Text>
          {result.matchedDiseases.length === 0 ? (
            <View style={styles.noMatchCard}>
              {isLlmLoading ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={Colors.primary}
                    style={{marginBottom: Spacing['2']}}
                  />
                  <Text style={styles.noMatchText}>
                    Consulting AI for possible conditions…
                  </Text>
                </>
              ) : llmAnalysis ? (
                <>
                  <MarkdownText style={styles.analysisText}>{llmAnalysis}</MarkdownText>
                  <View style={styles.feedbackRow}>
                    <TouchableOpacity
                      style={[
                        styles.feedbackBtn,
                        analysisFeedback === 'up' && styles.feedbackBtnActiveUp,
                      ]}
                      onPress={() => handleAnalysisFeedback('up')}>
                      <Text style={styles.feedbackIcon}>👍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.feedbackBtn,
                        analysisFeedback === 'down' && styles.feedbackBtnActiveDown,
                      ]}
                      onPress={() => handleAnalysisFeedback('down')}>
                      <Text style={styles.feedbackIcon}>👎</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.noMatchText}>
                  No strong matches found. Please consult a healthcare
                  professional for a proper diagnosis.
                </Text>
              )}
            </View>
          ) : (
            <>
              {/* RuleEngine risk banner */}
              <View
                style={[
                  styles.ruleEngineBanner,
                  {
                    borderLeftColor:
                      ruleResult.riskLevel === 'IMMEDIATE'
                        ? Colors.error
                        : ruleResult.riskLevel === 'URGENT'
                        ? Colors.warning
                        : Colors.success,
                  },
                ]}>
                <View style={styles.ruleEngineBannerLeft}>
                  <Text style={styles.ruleEngineBannerTitle}>
                    {ruleResult.riskLevel === 'IMMEDIATE'
                      ? '🚨 Emergency — Seek Immediate Care'
                      : ruleResult.riskLevel === 'URGENT'
                      ? '⚠️ Urgent — Visit Facility Soon'
                      : '✅ Routine — Manage & Monitor'}
                  </Text>
                  <Text style={styles.ruleEngineBannerSub}>
                    {riskLevelLabel(ruleResult.riskLevel)} ·{' '}
                    {referralLevelLabel(ruleResult.referralLevel)}
                  </Text>
                  {ruleResult.triggeredRules.length > 0 && (
                    <Text style={styles.ruleEngineBannerReason} numberOfLines={2}>
                      {ruleResult.triggeredRules[0]}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.referralBtn}
                  onPress={() =>
                    navigation.navigate('ReferralGuidance', {
                      diseaseId: result.matchedDiseases[0]?.disease.id ?? '',
                      diseaseName: result.matchedDiseases[0]?.disease.name ?? 'General',
                      riskLevel: ruleResult.riskLevel,
                      referralLevel: ruleResult.referralLevel,
                      reasons: ruleResult.triggeredRules,
                    })
                  }>
                  <Text style={styles.referralBtnText}>🏥 Guidance</Text>
                </TouchableOpacity>
              </View>

              {(showAllConditions
                ? result.matchedDiseases
                : result.matchedDiseases.slice(0, 3)
              ).map((disease, index) => (
                <View key={disease.disease.id}>
                  <ConditionCard match={disease} index={index} />
                  <View style={styles.conditionActions}>
                    <TouchableOpacity
                      style={[styles.conditionActionBtn, styles.conditionActionBtnMed]}
                      onPress={() =>
                        navigation.navigate('MedicineDetail', {
                          diseaseId: disease.disease.id,
                          diseaseName: disease.disease.name,
                        })
                      }>
                      <Text style={styles.conditionActionBtnText}>💊 Medicines</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.conditionActionBtn, styles.conditionActionBtnRef]}
                      onPress={() =>
                        navigation.navigate('ReferralGuidance', {
                          diseaseId: disease.disease.id,
                          diseaseName: disease.disease.name,
                          riskLevel: ruleResult.riskLevel,
                          referralLevel: ruleResult.referralLevel,
                          reasons: ruleResult.triggeredRules,
                        })
                      }>
                      <Text style={styles.conditionActionBtnText}>🏥 Referral</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {result.matchedDiseases.length > 3 && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => setShowAllConditions(v => !v)}>
                  <Text style={styles.showMoreText}>
                    {showAllConditions
                      ? '▲ Show less'
                      : `▼ ${result.matchedDiseases.length - 3} more conditions…`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerIcon}>⚕️</Text>
          <Text style={styles.disclaimerText}>
            This is an AI-assisted decision support tool and is NOT a substitute for professional medical diagnosis or treatment. Always consult a qualified healthcare provider.
          </Text>
        </View>

        {/* Chat CTA */}
        <TouchableOpacity style={styles.chatCta} onPress={handleDone}>
          <Text style={styles.chatCtaText}>💬 Discuss with DhanwantariAI</Text>
        </TouchableOpacity>
      </RNAnimated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  flex: {flex: 1},
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['5'],
    paddingBottom: Spacing['3'],
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  navBack: {
    color: Colors.primary,
    fontSize: Typography.md,
    fontWeight: Typography.medium,
    width: 60,
  },
  navTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  navDone: {
    color: Colors.primary,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    width: 60,
    textAlign: 'right',
  },
  scrollContent: {
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['4'],
    gap: Spacing['4'],
  },
  symptomsCard: {padding: Spacing['4']},
  symptomsLabel: {
    color: Colors.textInverse,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    letterSpacing: 1.2,
    marginBottom: Spacing['3'],
  },
  symptomsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing['2'],
  },
  symptomChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radii.full,
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['2'],
  },
  symptomChipText: {
    color: Colors.textInverse,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  severityBanner: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    borderLeftWidth: 4,
    padding: Spacing['4'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  severityLeft: {gap: 4, flex: 1},
  severityTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  severityHint: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  analysisSection: {gap: Spacing['2']},
  sectionHeading: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  analysisCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    borderLeftWidth: 4,
    padding: Spacing['4'],
    ...Shadows.sm,
  },
  analysisText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    lineHeight: 22,
  },
  conditionsSection: {gap: Spacing['3']},
  noMatchCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    padding: Spacing['4'],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noMatchText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    lineHeight: 22,
    textAlign: 'center',
  },
  showMoreBtn: {
    alignSelf: 'center',
    marginTop: Spacing['2'],
    paddingVertical: Spacing['2'],
    paddingHorizontal: Spacing['5'],
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  showMoreText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  disclaimerCard: {
    backgroundColor: 'rgba(245,124,0,0.06)',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,124,0,0.2)',
    padding: Spacing['4'],
    flexDirection: 'row',
    gap: Spacing['3'],
    alignItems: 'flex-start',
  },
  disclaimerIcon: {fontSize: 18, marginTop: 1},
  disclaimerText: {
    flex: 1,
    color: Colors.warning,
    fontSize: Typography.xs,
    lineHeight: 18,
  },
  chatCta: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing['4'],
    alignItems: 'center',
    ...Shadows.md,
  },
  chatCtaText: {
    color: Colors.textInverse,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  // RuleEngine banner
  ruleEngineBanner: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.lg,
    borderLeftWidth: 4,
    padding: Spacing['4'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing['3'],
    ...Shadows.sm,
  },
  ruleEngineBannerLeft: {flex: 1, gap: 3},
  ruleEngineBannerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },
  ruleEngineBannerSub: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  ruleEngineBannerReason: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontStyle: 'italic',
    marginTop: 2,
  },
  referralBtn: {
    backgroundColor: 'rgba(103,58,183,0.12)',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
    borderWidth: 1,
    borderColor: 'rgba(103,58,183,0.3)',
  },
  referralBtnText: {
    color: Colors.primary,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  // Per-condition action buttons
  conditionActions: {
    flexDirection: 'row',
    gap: Spacing['2'],
    marginTop: -Spacing['2'],
    marginBottom: Spacing['2'],
    paddingHorizontal: Spacing['1'],
  },
  conditionActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing['2'],
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  conditionActionBtnMed: {
    backgroundColor: 'rgba(33,150,243,0.08)',
    borderColor: 'rgba(33,150,243,0.3)',
  },
  conditionActionBtnRef: {
    backgroundColor: 'rgba(103,58,183,0.08)',
    borderColor: 'rgba(103,58,183,0.3)',
  },
  conditionActionBtnText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  // Feedback buttons
  feedbackRow: {
    flexDirection: 'row',
    gap: Spacing['1'],
    marginTop: Spacing['2'],
    justifyContent: 'flex-end',
  },
  feedbackBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBtnActiveUp: {
    backgroundColor: 'rgba(46,125,50,0.12)',
  },
  feedbackBtnActiveDown: {
    backgroundColor: 'rgba(211,47,47,0.12)',
  },
  feedbackIcon: {
    fontSize: 16,
  },
});

export default SymptomAnalysisScreen;
