import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  View,
  SectionList,
  TouchableOpacity,
  Animated as RNAnimated,
  StatusBar,
  ScrollView,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppDispatch, useAppSelector} from '@hooks/useAppDispatch';
import {toggleSymptom, clearSelectedSymptoms, setAnalysisResult} from '@store/symptomSlice';
import {analyzeSymptoms} from '@utils/symptomMatcher';
import {buildAnalysisResult} from '@utils/analysisEngine';
import {getSymptomCategories} from '@utils/dataLoader';
import AnimatedPressable from '@components/common/AnimatedPressable';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';
import {RootStackParamList} from '@store/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SymptomChecker'>;

const SymptomCheckerScreen: React.FC<Props> = ({navigation, route}) => {
  const {profileId} = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const selectedSymptoms = useAppSelector(s => s.symptom.selectedSymptoms);
  const profile = useAppSelector(s =>
    s.profile.profiles.find(p => p.id === profileId),
  );

  const categories = getSymptomCategories();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set([categories[0]?.name ?? '']),
  );

  // Sheet slide-in animation
  const slideAnim = useRef(new RNAnimated.Value(60)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(slideAnim, {toValue: 0, useNativeDriver: true, damping: 22, stiffness: 300}),
      RNAnimated.timing(opacityAnim, {toValue: 1, duration: 200, useNativeDriver: true}),
    ]).start();
  }, [slideAnim, opacityAnim]);

  const toggleCategory = useCallback((name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleAnalyze = useCallback(() => {
    if (selectedSymptoms.length === 0) return;
    const matchResult = analyzeSymptoms(selectedSymptoms, profile ?? null);
    const analysisResult = profile
      ? buildAnalysisResult(
          profile,
          selectedSymptoms,
          matchResult.matchedDiseases,
          matchResult.severity,
        )
      : {
          symptoms: selectedSymptoms,
          severity: matchResult.severity,
          personalizedAnalysis: '',
          matchedDiseases: matchResult.matchedDiseases,
          analysedAt: new Date().toISOString(),
        };
    dispatch(setAnalysisResult({profileId, result: analysisResult}));
    navigation.replace('SymptomAnalysis', {
      profileId,
      result: analysisResult,
    });
  }, [selectedSymptoms, profile, profileId, dispatch, navigation]);

  const handleClear = useCallback(() => {
    dispatch(clearSelectedSymptoms());
  }, [dispatch]);

  const sectionData = categories.map(cat => ({
    key: cat.name,
    title: cat.name,
    data: cat.symptoms.map(s => s.name),
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + Spacing['3']}]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🩺</Text>
          <Text style={styles.headerTitle}>Symptom Checker</Text>
        </View>
        {selectedSymptoms.length > 0 ? (
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearBtn}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{width: 50}} />
        )}
      </View>

      <Text style={styles.subtitle}>
        Select the symptoms you are currently experiencing
      </Text>

      {/* Sections */}
      <RNAnimated.View
        style={[
          styles.flex,
          {opacity: opacityAnim, transform: [{translateY: slideAnim}]},
        ]}>
        <SectionList
          sections={sectionData}
          keyExtractor={(item, index) => `${item}-${index}`}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.sectionListContent,
            {paddingBottom: insets.bottom + 100},
          ]}
          renderSectionHeader={({section}) => (
            <TouchableOpacity
              testID={`category-${section.key.replace(/\s+/g, '-')}`}
              style={styles.sectionHeader}
              onPress={() => toggleCategory(section.key)}
              activeOpacity={0.7}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionRight}>
                {section.data.filter(s => selectedSymptoms.includes(s)).length >
                  0 && (
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>
                      {section.data.filter(s => selectedSymptoms.includes(s)).length}
                    </Text>
                  </View>
                )}
                <Text style={styles.sectionChevron}>
                  {expandedCategories.has(section.key) ? '−' : '+'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          renderItem={({item, section}) => {
            if (!expandedCategories.has(section.key)) return null;
            const isSelected = selectedSymptoms.includes(item);
            return (
              <TouchableOpacity
                testID={`symptom-${item.replace(/\s+/g, '-')}`}
                style={[styles.symptomRow, isSelected ? styles.symptomRowSelected : null]}
                onPress={() => dispatch(toggleSymptom(item))}
                activeOpacity={0.7}>
                <View
                  style={[
                    styles.checkbox,
                    isSelected ? styles.checkboxSelected : null,
                  ]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text
                  style={[
                    styles.symptomText,
                    isSelected ? styles.symptomTextSelected : null,
                  ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </RNAnimated.View>

      {/* Footer */}
      <View
        style={[
          styles.footer,
          {paddingBottom: insets.bottom + Spacing['4']},
        ]}>
        {selectedSymptoms.length > 0 && (
          <Text style={styles.footerCount}>
            {selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? 's' : ''} selected
          </Text>
        )}
        <AnimatedPressable
          testID="analyze-symptoms-btn"
          style={[
            styles.analyzeBtn,
            selectedSymptoms.length === 0 ? styles.analyzeBtnDisabled : null,
          ]}
          onPress={handleAnalyze}
          scale={0.97}
          hapticType="impactMedium"
          disabled={selectedSymptoms.length === 0}>
          <Text style={styles.analyzeBtnText}>
            {selectedSymptoms.length === 0
              ? 'Select symptoms to analyze'
              : `Analyze ${selectedSymptoms.length} Symptom${selectedSymptoms.length !== 1 ? 's' : ''}`}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  flex: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['4'],
    paddingBottom: Spacing['3'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerBack: {
    color: Colors.primary,
    fontSize: Typography.md,
    fontWeight: Typography.medium,
    width: 50,
  },
  headerCenter: {flexDirection: 'row', alignItems: 'center', gap: Spacing['2']},
  headerEmoji: {fontSize: 22},
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  clearBtn: {
    color: Colors.danger,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    width: 50,
    textAlign: 'right',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['3'],
    paddingBottom: Spacing['2'],
  },
  sectionListContent: {paddingHorizontal: Spacing['4'], paddingTop: Spacing['2']},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['3'],
    marginBottom: Spacing['1'],
    marginTop: Spacing['2'],
    ...Shadows.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  sectionRight: {flexDirection: 'row', alignItems: 'center', gap: Spacing['2']},
  sectionBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['1'],
  },
  sectionBadgeText: {
    color: Colors.textInverse,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  sectionChevron: {
    color: Colors.textMuted,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    width: 16,
    textAlign: 'center',
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['3'],
    gap: Spacing['3'],
    borderRadius: Radii.md,
    marginBottom: 2,
  },
  symptomRowSelected: {
    backgroundColor: 'rgba(59,91,219,0.06)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radii.sm,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.textInverse,
    fontSize: 13,
    lineHeight: 14,
    fontWeight: Typography.bold,
  },
  symptomText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
  symptomTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.medium,
  },
  footer: {
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['3'],
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: Spacing['2'],
  },
  footerCount: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
  analyzeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing['4'],
    alignItems: 'center',
    ...Shadows.md,
  },
  analyzeBtnDisabled: {
    backgroundColor: Colors.textMuted,
  },
  analyzeBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
});

export default SymptomCheckerScreen;
