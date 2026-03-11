import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {nanoid} from '@reduxjs/toolkit';
import {useAppDispatch, useAppSelector} from '@hooks/useAppDispatch';
import {addProfile, updateProfile} from '@store/profileSlice';
import {UserProfile, ActivityLevel, Gender, RootStackParamList} from '@store/types';
import {
  calculateBMI,
  getBMICategory,
  calculateMaintenanceCalories,
  getActivityLevelLabel,
} from '@utils/analysisEngine';
import AnimatedPressable from '@components/common/AnimatedPressable';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'NewProfile'>;

const GENDERS: Gender[] = ['male', 'female', 'other'];
const ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

const NewProfileScreen: React.FC<Props> = ({navigation, route}) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const editProfileId = route.params?.editProfileId;
  const existingProfile = useAppSelector(s =>
    s.profile.profiles.find(p => p.id === editProfileId),
  );

  const [firstName, setFirstName] = useState(existingProfile?.firstName ?? '');
  const [lastName, setLastName] = useState(existingProfile?.lastName ?? '');
  const [age, setAge] = useState(existingProfile?.age.toString() ?? '');
  const [gender, setGender] = useState<Gender>(existingProfile?.gender ?? 'male');
  const [heightCm, setHeightCm] = useState(
    existingProfile?.heightCm.toString() ?? '',
  );
  const [weightKg, setWeightKg] = useState(
    existingProfile?.weightKg.toString() ?? '',
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    existingProfile?.activityLevel ?? 'light',
  );

  const bmi = calculateBMI(parseFloat(heightCm) || 0, parseFloat(weightKg) || 0);
  const bmiCategory = getBMICategory(bmi);
  const maintenanceCalories =
    bmi > 0
      ? calculateMaintenanceCalories({
          age: parseInt(age, 10) || 25,
          gender,
          heightCm: parseFloat(heightCm) || 170,
          weightKg: parseFloat(weightKg) || 70,
          activityLevel,
        })
      : 0;

  // Animate in the BMI card
  const bmiCardScale = useRef(new RNAnimated.Value(bmi > 0 ? 1 : 0.8)).current;
  const bmiCardOpacity = useRef(new RNAnimated.Value(bmi > 0 ? 1 : 0)).current;

  useEffect(() => {
    if (bmi > 0) {
      RNAnimated.parallel([
        RNAnimated.spring(bmiCardScale, {toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280}),
        RNAnimated.timing(bmiCardOpacity, {toValue: 1, duration: 200, useNativeDriver: true}),
      ]).start();
    }
  }, [bmi, bmiCardScale, bmiCardOpacity]);

  const bmiColor =
    bmi >= 30 ? Colors.danger : bmi >= 25 ? Colors.warning : Colors.success;

  const canSave =
    firstName.trim() &&
    lastName.trim() &&
    parseInt(age, 10) > 0 &&
    parseFloat(heightCm) > 0 &&
    parseFloat(weightKg) > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const profile: UserProfile = {
      id: editProfileId ?? nanoid(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      age: parseInt(age, 10),
      gender,
      heightCm: parseFloat(heightCm),
      weightKg: parseFloat(weightKg),
      activityLevel,
      bmi,
      bmiCategory,
      maintenanceCalories,
      hereditaryDiseases: existingProfile?.hereditaryDiseases ?? [],
      createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    if (editProfileId) {
      dispatch(updateProfile(profile));
      navigation.goBack();
    } else {
      dispatch(addProfile(profile));
      navigation.replace('Chat', {profileId: profile.id});
    }
  }, [canSave, editProfileId, firstName, lastName, age, gender, heightCm, weightKg, activityLevel, bmi, bmiCategory, maintenanceCalories, existingProfile, dispatch, navigation]);

  const renderField = (
    label: string,
    value: string,
    onChangeText: (v: string) => void,
    placeholder: string,
    keyboardType: 'default' | 'numeric' = 'default',
  ) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        returnKeyType="done"
        blurOnSubmit={true}
        autoCorrect={false}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Top nav */}
      <View style={[styles.nav, {paddingTop: insets.top}]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.navBack}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          {editProfileId ? 'Edit Profile' : 'New Profile'}
        </Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom: insets.bottom + 100},
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Name row */}
        <View style={styles.row}>
          {renderField('FIRST NAME', firstName, setFirstName, 'e.g. Saty')}
          {renderField('LAST NAME', lastName, setLastName, 'e.g. Kumar')}
        </View>

        {/* Age + Gender row */}
        <View style={styles.row}>
          {renderField('AGE', age, setAge, 'e.g. 46', 'numeric')}
          <View style={[styles.field, {flex: 1.5}]}>
            <Text style={styles.fieldLabel}>GENDER</Text>
            <View style={styles.segmentRow}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.segment,
                    gender === g && styles.segmentActive,
                  ]}
                  onPress={() => setGender(g)}>
                  <Text
                    style={[
                      styles.segmentText,
                      gender === g && styles.segmentTextActive,
                    ]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Height + Weight row */}
        <View style={styles.row}>
          {renderField('HEIGHT (CM)', heightCm, setHeightCm, 'e.g. 170', 'numeric')}
          {renderField('WEIGHT (KG)', weightKg, setWeightKg, 'e.g. 72', 'numeric')}
        </View>

        {/* Activity Level */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ACTIVITY LEVEL</Text>
          <View style={styles.activityContainer}>
            {ACTIVITY_LEVELS.map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.activityOption,
                  activityLevel === level && styles.activityOptionActive,
                ]}
                onPress={() => setActivityLevel(level)}>
                <Text
                  style={[
                    styles.activityText,
                    activityLevel === level && styles.activityTextActive,
                  ]}
                  numberOfLines={1}>
                  {getActivityLevelLabel(level)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* BMI Card */}
        <RNAnimated.View
          style={[
            styles.bmiCard,
            {transform: [{scale: bmiCardScale}], opacity: bmiCardOpacity},
          ]}>
          <View style={styles.bmiItem}>
            <Text style={styles.bmiItemLabel}>BMI</Text>
            <Text style={[styles.bmiItemValue, {color: bmi > 0 ? bmiColor : Colors.textMuted}]}>
              {bmi > 0 ? bmi.toFixed(1) : '—'}
            </Text>
            {bmi > 0 && (
              <Text style={[styles.bmiItemSubvalue, {color: bmiColor}]}>
                {bmiCategory}
              </Text>
            )}
          </View>
          <View style={styles.bmiDivider} />
          <View style={styles.bmiItem}>
            <Text style={styles.bmiItemLabel}>MAINTENANCE CALORIES</Text>
            <Text style={styles.bmiItemValue}>
              {maintenanceCalories > 0 ? `${maintenanceCalories}` : '—'}
            </Text>
            {maintenanceCalories > 0 && (
              <Text style={styles.bmiItemSubvalue}>kcal/day</Text>
            )}
          </View>
        </RNAnimated.View>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            All data stays on your device. Nothing is sent to any server.
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View
        style={[
          styles.saveContainer,
          {paddingBottom: insets.bottom + Spacing['4']},
        ]}>
        <AnimatedPressable
          style={[styles.saveBtn, !canSave ? styles.saveBtnDisabled : null]}
          onPress={handleSave}
          scale={0.97}
          hapticType="impactMedium"
          disabled={!canSave}>
          <Text style={styles.saveBtnText}>Save &amp; Start Chat</Text>
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
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
  scroll: {
    paddingHorizontal: Spacing['5'],
    paddingTop: Spacing['5'],
    gap: Spacing['4'],
  },
  row: {
    flexDirection: 'row',
    gap: Spacing['4'],
  },
  field: {flex: 1, gap: Spacing['2']},
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['3'],
    fontSize: Typography.base,
    color: Colors.textPrimary,
    ...Shadows.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing['1'],
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing['2'],
    borderRadius: Radii.md,
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segmentText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  segmentTextActive: {
    color: Colors.textInverse,
  },
  activityContainer: {gap: Spacing['1']},
  activityOption: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['3'],
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  activityOptionActive: {
    backgroundColor: 'rgba(59,91,219,0.08)',
    borderColor: Colors.primary,
  },
  activityText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
  activityTextActive: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },
  bmiCard: {
    backgroundColor: 'rgba(59,91,219,0.06)',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(59,91,219,0.15)',
    flexDirection: 'row',
    padding: Spacing['4'],
    marginTop: Spacing['2'],
  },
  bmiItem: {flex: 1, alignItems: 'center', gap: 4},
  bmiDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing['3'],
  },
  bmiItemLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  bmiItemValue: {
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  bmiItemSubvalue: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    color: Colors.textMuted,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46,125,50,0.08)',
    borderRadius: Radii.md,
    padding: Spacing['3'],
    gap: Spacing['2'],
  },
  privacyIcon: {fontSize: 16},
  privacyText: {
    flex: 1,
    color: Colors.success,
    fontSize: Typography.sm,
  },
  saveContainer: {
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['3'],
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing['4'],
    alignItems: 'center',
    ...Shadows.md,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.textMuted,
  },
  saveBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
});

export default NewProfileScreen;
