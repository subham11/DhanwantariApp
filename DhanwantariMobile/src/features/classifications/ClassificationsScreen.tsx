import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Animated as RNAnimated,
  StatusBar,
  Pressable,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {
  getAllDiseaseCategories,
  renameCategory,
  mergeDiseaseCategory,
} from '@services/db';
import {getSymptomCategories} from '@utils/dataLoader';
import AnimatedPressable from '@components/common/AnimatedPressable';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';
import {RootStackParamList} from '@store/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Classifications'>;

type Tab = 'diseases' | 'symptoms';

// Colour palette cycled for category cards
const CATEGORY_COLORS = [
  '#3B5BDB',
  '#2E7D32',
  '#D32F2F',
  '#F57C00',
  '#7B1FA2',
  '#0097A7',
  '#5D4037',
  '#455A64',
  '#C0392B',
  '#1565C0',
];

function categoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

function formatCategory(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Modal: add new category ──────────────────────────────────────────────────

interface AddCategoryModalProps {
  visible: boolean;
  existingCategories: string[];
  onAdd: (name: string) => void;
  onCancel: () => void;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  visible,
  existingCategories,
  onAdd,
  onCancel,
}) => {
  const [value, setValue] = useState('');

  const handleConfirm = () => {
    const trimmed = value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    if (existingCategories.includes(trimmed)) {
      Alert.alert('Duplicate', `Category "${formatCategory(trimmed)}" already exists.`);
      return;
    }
    onAdd(trimmed);
    setValue('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>New Category</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. Pediatric, Oncology…"
            placeholderTextColor={Colors.textMuted}
            value={value}
            onChangeText={setValue}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <Text style={modalStyles.hint}>
            Spaces will be converted to underscores. The category will be empty
            until you move diseases into it.
          </Text>
          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={() => { setValue(''); onCancel(); }}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.confirmBtn, !value.trim() && {opacity: 0.45}]}
              onPress={handleConfirm}
              disabled={!value.trim()}>
              <Text style={modalStyles.confirmText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Modal: rename category ───────────────────────────────────────────────────

interface RenameCategoryModalProps {
  visible: boolean;
  original: string;
  existingCategories: string[];
  onRename: (newName: string) => void;
  onCancel: () => void;
}

const RenameCategoryModal: React.FC<RenameCategoryModalProps> = ({
  visible,
  original,
  existingCategories,
  onRename,
  onCancel,
}) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue(formatCategory(original));
  }, [visible, original]);

  const handleConfirm = () => {
    const trimmed = value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed || trimmed === original) { onCancel(); return; }
    if (existingCategories.includes(trimmed)) {
      Alert.alert(
        'Merge Confirmation',
        `"${formatCategory(trimmed)}" already exists. Merge all diseases from "${formatCategory(original)}" into it?`,
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Merge', style: 'destructive', onPress: () => onRename(trimmed)},
        ],
      );
      return;
    }
    onRename(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>Rename "{formatCategory(original)}"</Text>
          <TextInput
            style={modalStyles.input}
            value={value}
            onChangeText={setValue}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <Text style={modalStyles.hint}>
            If the new name matches an existing category, diseases will be merged.
          </Text>
          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onCancel}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.confirmBtn, !value.trim() && {opacity: 0.45}]}
              onPress={handleConfirm}
              disabled={!value.trim()}>
              <Text style={modalStyles.confirmText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ClassificationsScreen: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>('diseases');
  const [diseaseCategories, setDiseaseCategories] = useState<
    {category: string; count: number}[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  // Custom empty categories not yet in DB (no diseases assigned yet)
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);

  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  const symptomCategories = getSymptomCategories();

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await getAllDiseaseCategories();
      setDiseaseCategories(cats);
    } catch (e) {
      // DB not yet ready (first load), fall back gracefully
      setDiseaseCategories([]);
    } finally {
      setLoading(false);
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories]),
  );

  const handleAddCategory = useCallback(
    (name: string) => {
      setShowAddModal(false);
      if (!pendingCategories.includes(name)) {
        setPendingCategories(prev => [...prev, name]);
      }
    },
    [pendingCategories],
  );

  const handleRename = useCallback(
    async (newName: string) => {
      if (!renameTarget) return;
      setRenameTarget(null);
      const isExisting = diseaseCategories.some(c => c.category === newName);
      try {
        if (isExisting) {
          await mergeDiseaseCategory(renameTarget, newName);
        } else {
          await renameCategory(renameTarget, newName);
        }
        await loadCategories();
      } catch {
        Alert.alert('Error', 'Could not rename category. Please try again.');
      }
    },
    [renameTarget, diseaseCategories, loadCategories],
  );

  const allExistingCategories = [
    ...diseaseCategories.map(c => c.category),
    ...pendingCategories,
  ];

  // Combine DB categories + pending new ones for display
  const displayCategories: {category: string; count: number}[] = [
    ...diseaseCategories,
    ...pendingCategories.map(c => ({category: c, count: 0})),
  ];

  // ─── Render items ────────────────────────────────────────────────────────────

  const renderDiseaseCategory = useCallback(
    ({item, index}: {item: {category: string; count: number}; index: number}) => {
      const color = categoryColor(item.category);
      const label = formatCategory(item.category);

      return (
        <AnimatedPressable
          onPress={() =>
            navigation.navigate('CategoryDiseases', {category: item.category})
          }
          hapticType="selection"
          style={styles.categoryCard}>
          {/* Colour swatch */}
          <View style={[styles.swatch, {backgroundColor: color}]}>
            <Text style={styles.swatchLetter}>
              {label.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.categoryName}>{label}</Text>
            <Text style={styles.categoryCount}>
              {item.count === 0
                ? 'No diseases yet'
                : `${item.count} disease${item.count !== 1 ? 's' : ''}`}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.renameBtn}
            onPress={() => setRenameTarget(item.category)}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Text style={styles.renameBtnText}>✎</Text>
          </TouchableOpacity>

          <Text style={styles.chevron}>›</Text>
        </AnimatedPressable>
      );
    },
    [navigation],
  );

  const renderSymptomCategory = useCallback(
    ({item}: {item: {name: string; symptoms: {name: string}[]}}) => {
      const color = categoryColor(item.name);
      return (
        <View style={styles.categoryCard}>
          <View style={[styles.swatch, {backgroundColor: color}]}>
            <Text style={styles.swatchLetter}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.categoryCount}>
              {item.symptoms.length} symptom
              {item.symptoms.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.readOnlyBadge}>
            <Text style={styles.readOnlyText}>built-in</Text>
          </View>
        </View>
      );
    },
    [],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + Spacing['3']}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Classifications</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'diseases' && styles.tabActive]}
          onPress={() => setActiveTab('diseases')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'diseases' && styles.tabTextActive,
            ]}>
            Disease Categories
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'symptoms' && styles.tabActive]}
          onPress={() => setActiveTab('symptoms')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'symptoms' && styles.tabTextActive,
            ]}>
            Symptom Groups
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <RNAnimated.View style={[{flex: 1}, {opacity: fadeAnim}]}>
        {activeTab === 'diseases' ? (
          <>
            {loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Loading…</Text>
              </View>
            ) : displayCategories.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🗂️</Text>
                <Text style={styles.emptyTitle}>No categories yet</Text>
                <Text style={styles.emptyText}>
                  Tap "+" below to create your first disease category.
                </Text>
              </View>
            ) : (
              <FlatList
                data={displayCategories}
                keyExtractor={item => item.category}
                renderItem={renderDiseaseCategory}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}

            {/* FAB */}
            <TouchableOpacity
              style={[styles.fab, {bottom: insets.bottom + Spacing['6']}]}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}>
              <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.readOnlyBanner}>
              <Text style={styles.readOnlyBannerText}>
                Symptom groups are built-in and determine how symptoms are
                organised in the checker. They cannot be edited here.
              </Text>
            </View>
            <FlatList
              data={symptomCategories}
              keyExtractor={item => item.name}
              renderItem={renderSymptomCategory}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </RNAnimated.View>

      {/* Modals */}
      <AddCategoryModal
        visible={showAddModal}
        existingCategories={allExistingCategories}
        onAdd={handleAddCategory}
        onCancel={() => setShowAddModal(false)}
      />
      <RenameCategoryModal
        visible={renameTarget !== null}
        original={renameTarget ?? ''}
        existingCategories={allExistingCategories}
        onRename={handleRename}
        onCancel={() => setRenameTarget(null)}
      />
    </View>
  );
};

export default ClassificationsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['4'],
    paddingBottom: Spacing['3'],
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '300',
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 36,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing['3'],
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['4'],
    paddingBottom: Spacing['16'],
  },

  // Category card
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['3'],
    marginBottom: Spacing['3'],
    ...Shadows.sm,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing['3'],
  },
  swatchLetter: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: '#fff',
  },
  cardBody: {
    flex: 1,
  },
  categoryName: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  renameBtn: {
    padding: Spacing['1'],
    marginRight: Spacing['2'],
  },
  renameBtnText: {
    fontSize: Typography.md,
    color: Colors.primary,
  },
  chevron: {
    fontSize: Typography.xl,
    color: Colors.textMuted,
    fontWeight: Typography.light,
  },
  readOnlyBadge: {
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
    marginRight: Spacing['2'],
  },
  readOnlyText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['8'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing['4'],
  },
  emptyTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing['2'],
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: Typography.sm * Typography.relaxed,
  },

  // Read-only banner (symptom tab)
  readOnlyBanner: {
    margin: Spacing['4'],
    padding: Spacing['3'],
    backgroundColor: '#EFF3FF',
    borderRadius: Radii.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  readOnlyBannerText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.relaxed,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing['5'],
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  fabIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: Typography.light,
    lineHeight: 32,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['5'],
  },
  sheet: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.xl,
    padding: Spacing['5'],
    ...Shadows.md,
  },
  title: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing['4'],
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['3'],
    fontSize: Typography.base,
    color: Colors.textPrimary,
    marginBottom: Spacing['2'],
  },
  hint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginBottom: Spacing['4'],
    lineHeight: Typography.xs * Typography.relaxed,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing['3'],
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing['3'],
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: Spacing['3'],
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: Typography.base,
    color: '#fff',
    fontWeight: Typography.semibold,
  },
});
