import React, {useCallback, useEffect, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Animated as RNAnimated,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppDispatch, useAppSelector} from '@hooks/useAppDispatch';
import {deleteProfile, setActiveProfile} from '@store/profileSlice';
import {UserProfile, RootStackParamList} from '@store/types';
import {getInitials} from '@utils/analysisEngine';
import AnimatedPressable from '@components/common/AnimatedPressable';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileList'>;

const ProfileListScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useAppDispatch();
  const profiles = useAppSelector(s => s.profile.profiles);
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(30)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, {toValue: 1, duration: 400, useNativeDriver: true}),
      RNAnimated.spring(slideAnim, {toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200}),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSelectProfile = useCallback(
    (profile: UserProfile) => {
      dispatch(setActiveProfile(profile.id));
      navigation.navigate('Chat', {profileId: profile.id});
    },
    [dispatch, navigation],
  );

  const handleDeleteProfile = useCallback(
    (profile: UserProfile) => {
      Alert.alert(
        'Delete Profile',
        `Are you sure you want to delete "${profile.firstName} ${profile.lastName}"?`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => dispatch(deleteProfile(profile.id)),
          },
        ],
      );
    },
    [dispatch],
  );

  const renderProfile = useCallback(
    ({item, index}: {item: UserProfile; index: number}) => {
      const initials = getInitials(item.firstName, item.lastName);
      const bmiColor =
        item.bmi >= 30
          ? Colors.danger
          : item.bmi >= 25
          ? Colors.warning
          : Colors.success;

      return (
        <RNAnimated.View
          style={{
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
          }}>
          <AnimatedPressable
            testID={`profile-card-${index}`}
            style={styles.profileCard}
            onPress={() => handleSelectProfile(item)}
            onLongPress={() => handleDeleteProfile(item)}
            hapticType="impactMedium">
            {/* Avatar */}
            <View style={[styles.avatar, {backgroundColor: Colors.primary}]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            {/* Info */}
            <View style={styles.profileInfo}>
              <Text testID={`profile-name-${index}`} style={styles.profileName}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={styles.lastUsed}>
                Last used:{' '}
                {new Date(item.lastUsedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>

            {/* BMI */}
            <View style={styles.bmiBlock}>
              <Text style={[styles.bmiValue, {color: bmiColor}]}>
                {item.bmi}
              </Text>
              <Text style={[styles.bmiCategory, {color: bmiColor}]}>
                {item.bmiCategory}
              </Text>
            </View>

            {/* Chevron */}
            <Text style={styles.chevron}>›</Text>
          </AnimatedPressable>
        </RNAnimated.View>
      );
    },
    [fadeAnim, slideAnim, handleSelectProfile, handleDeleteProfile],
  );

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>🏥</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>DhanwantariAI</Text>
          <Text style={styles.headerSubtitle}>
            Select a profile to start a new session
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Classifications')}
          style={styles.headerAction}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.headerActionText}>🗂️</Text>
        </TouchableOpacity>
      </View>

      {/* Profile List */}
      <FlatList
        data={profiles}
        keyExtractor={item => item.id}
        renderItem={renderProfile}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyTitle}>No profiles yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a profile to get started
            </Text>
          </View>
        }
        ListFooterComponent={
          <Text style={styles.hint}>Long-press a profile to delete it</Text>
        }
      />

      {/* New Profile Button */}
      <View
        style={[styles.footer, {paddingBottom: insets.bottom + Spacing['4']}]}>
        <AnimatedPressable
          style={styles.newProfileBtn}
          onPress={() => navigation.navigate('NewProfile', {})}
          hapticType="impactMedium"
          scale={0.97}>
          <Text style={styles.newProfileBtnText}>+ New Profile</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing['5'],
    paddingTop: Spacing['4'],
    paddingBottom: Spacing['5'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['3'],
  },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 36,
  },
  headerText: {flex: 1},
  headerTitle: {
    color: Colors.textInverse,
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: Typography.sm,
    marginTop: 2,
  },
  headerAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionText: {
    fontSize: 24,
  },
  listContent: {
    paddingTop: Spacing['5'],
    paddingBottom: Spacing['4'],
    flexGrow: 1,
  },
  profileCard: {
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing['4'],
    marginVertical: Spacing['2'],
    borderRadius: Radii.xl,
    padding: Spacing['4'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['3'],
    ...Shadows.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.textInverse,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  profileInfo: {flex: 1},
  profileName: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  lastUsed: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    marginTop: 2,
  },
  bmiBlock: {alignItems: 'flex-end'},
  bmiValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  bmiCategory: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  chevron: {
    color: Colors.textMuted,
    fontSize: 24,
    marginLeft: -Spacing['1'],
  },
  hint: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: Typography.sm,
    marginTop: Spacing['3'],
    paddingBottom: Spacing['4'],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing['16'],
    gap: Spacing['3'],
  },
  emptyIcon: {fontSize: 60},
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.base,
  },
  footer: {
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['3'],
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  newProfileBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    paddingVertical: Spacing['4'],
    alignItems: 'center',
    ...Shadows.md,
  },
  newProfileBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    letterSpacing: 0.3,
  },
});

export default ProfileListScreen;
