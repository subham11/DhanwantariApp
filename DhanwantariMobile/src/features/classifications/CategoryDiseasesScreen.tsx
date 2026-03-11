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
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {
  getDiseasesByCategory,
  getAllDiseaseCategories,
  updateDiseaseCategory,
  renameCategory,
  mergeDiseaseCategory,
} from '@services/db';
import AnimatedPressable from '@components/common/AnimatedPressable';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';
import {RootStackParamList} from '@store/types';
import type {Disease} from '@store/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryDiseases'>;

function formatCategory(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const GENDER_LABELS: Record<string, string> = {
  male: '♂ Male',
  female: '♀ Female',
  both: '⚥ Both',
};

// ─── Move Disease Modal ───────────────────────────────────────────────────────

interface MoveDiseaseModalProps {
  visible: boolean;
  disease: Disease | null;
  currentCategory: string;
  allCategories: string[];
  onMove: (diseaseId: string, newCategory: string) => void;
  onCancel: () => void;
}

const MoveDiseaseModal: React.FC<MoveDiseaseModalProps> = ({
  visible,
  disease,
  currentCategory,
  allCategories,
  onMove,
  onCancel,
}) => {
  const [newCategory, setNewCategory] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewCategory('');
      setCustomInput('');
      setShowCustom(false);
    }
  }, [visible]);

  const otherCategories = allCategories.filter(c => c !== currentCategory);

  const handleSelect = (cat: string) => {
    if (!disease) return;
    onMove(disease.id, cat);
  };

  const handleCustomConfirm = () => {
    if (!disease) return;
    const trimmed = customInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    onMove(disease.id, trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={moveStyles.overlay}>
        <View style={moveStyles.sheet}>
          <Text style={moveStyles.title}>
            Move "{disease?.name ?? ''}"
          </Text>
          <Text style={moveStyles.subtitle}>
            Select a destination category:
          </Text>

          {otherCategories.length > 0 && (
            <View style={moveStyles.categoryList}>
              {otherCategories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    moveStyles.categoryOption,
                    newCategory === cat && moveStyles.categoryOptionSelected,
                  ]}
                  onPress={() => handleSelect(cat)}>
                  <Text
                    style={[
                      moveStyles.categoryOptionText,
                      newCategory === cat && moveStyles.categoryOptionTextSelected,
                    ]}>
                    {formatCategory(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={moveStyles.newCategoryToggle}
            onPress={() => setShowCustom(v => !v)}>
            <Text style={moveStyles.newCategoryToggleText}>
              {showCustom ? '▾' : '▸'} New category…
            </Text>
          </TouchableOpacity>

          {showCustom && (
            <View style={moveStyles.customRow}>
              <TextInput
                style={moveStyles.customInput}
                placeholder="Category name"
                placeholderTextColor={Colors.textMuted}
                value={customInput}
                onChangeText={setCustomInput}
                returnKeyType="done"
                onSubmitEditing={handleCustomConfirm}
              />
              <TouchableOpacity
                style={[
                  moveStyles.customConfirmBtn,
                  !customInput.trim() && {opacity: 0.4},
                ]}
                onPress={handleCustomConfirm}
                disabled={!customInput.trim()}>
                <Text style={moveStyles.customConfirmText}>Move</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={moveStyles.cancelBtn} onPress={onCancel}>
            <Text style={moveStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Rename Category Modal ────────────────────────────────────────────────────

interface RenameModalProps {
  visible: boolean;
  current: string;
  allCategories: string[];
  onRename: (newName: string) => void;
  onCancel: () => void;
}

const RenameModal: React.FC<RenameModalProps> = ({
  visible,
  current,
  allCategories,
  onRename,
  onCancel,
}) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue(formatCategory(current));
  }, [visible, current]);

  const handleConfirm = () => {
    const trimmed = value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed || trimmed === current) { onCancel(); return; }
    const isExisting = allCategories.includes(trimmed) && trimmed !== current;
    if (isExisting) {
      Alert.alert(
        'Merge Confirmation',
        `"${formatCategory(trimmed)}" already exists. Merge all diseases from "${formatCategory(current)}" into it?`,
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
      <View style={renameStyles.overlay}>
        <View style={renameStyles.sheet}>
          <Text style={renameStyles.title}>Rename "{formatCategory(current)}"</Text>
          <TextInput
            style={renameStyles.input}
            value={value}
            onChangeText={setValue}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <View style={renameStyles.actions}>
            <TouchableOpacity style={renameStyles.cancelBtn} onPress={onCancel}>
              <Text style={renameStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[renameStyles.confirmBtn, !value.trim() && {opacity: 0.45}]}
              onPress={handleConfirm}
              disabled={!value.trim()}>
              <Text style={renameStyles.confirmText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const CategoryDiseasesScreen: React.FC<Props> = ({navigation, route}) => {
  const {category} = route.params;
  const insets = useSafeAreaInsets();

  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [movingDisease, setMovingDisease] = useState<Disease | null>(null);
  const [showRename, setShowRename] = useState(false);
  // Track the current category label (may change after rename)
  const [currentCategory, setCurrentCategory] = useState(category);

  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  const loadData = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const [d, cats] = await Promise.all([
        getDiseasesByCategory(cat),
        getAllDiseaseCategories(),
      ]);
      setDiseases(d);
      setAllCategories(cats.map(c => c.category));
    } catch {
      setDiseases([]);
    } finally {
      setLoading(false);
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      loadData(currentCategory);
    }, [loadData, currentCategory]),
  );

  const handleMove = useCallback(
    async (diseaseId: string, newCat: string) => {
      setMovingDisease(null);
      try {
        await updateDiseaseCategory(diseaseId, newCat);
        await loadData(currentCategory);
      } catch {
        Alert.alert('Error', 'Could not move disease. Please try again.');
      }
    },
    [currentCategory, loadData],
  );

  const handleRename = useCallback(
    async (newName: string) => {
      setShowRename(false);
      const isExisting = allCategories.includes(newName) && newName !== currentCategory;
      try {
        if (isExisting) {
          await mergeDiseaseCategory(currentCategory, newName);
          // Navigate back as this category no longer exists
          navigation.goBack();
        } else {
          await renameCategory(currentCategory, newName);
          setCurrentCategory(newName);
          await loadData(newName);
        }
      } catch {
        Alert.alert('Error', 'Could not rename category. Please try again.');
      }
    },
    [currentCategory, allCategories, loadData, navigation],
  );

  const filteredDiseases = query.trim()
    ? diseases.filter(d =>
        d.name.toLowerCase().includes(query.toLowerCase()),
      )
    : diseases;

  const renderDisease = useCallback(
    ({item}: {item: Disease}) => (
      <AnimatedPressable
        onPress={() => setMovingDisease(item)}
        hapticType="selection"
        style={styles.diseaseCard}>
        <View style={styles.diseaseInfo}>
          <Text style={styles.diseaseName}>{item.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>
                {GENDER_LABELS[item.gender] ?? item.gender}
              </Text>
            </View>
            <Text style={styles.symptomCount}>
              {item.symptom_count} symptom{item.symptom_count !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.moveHint}>Move ›</Text>
      </AnimatedPressable>
    ),
    [],
  );

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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {formatCategory(currentCategory)}
          </Text>
          {!loading && (
            <Text style={styles.headerSubtitle}>
              {diseases.length} disease{diseases.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.renameBtn}
          onPress={() => setShowRename(true)}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.renameBtnText}>Rename</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search diseases…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          Tap a disease to move it to a different category.
        </Text>
      </View>

      {/* List */}
      <RNAnimated.View style={[{flex: 1}, {opacity: fadeAnim}]}>
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading…</Text>
          </View>
        ) : filteredDiseases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>
              {query ? '🔎' : '📭'}
            </Text>
            <Text style={styles.emptyTitle}>
              {query ? 'No matches' : 'No diseases'}
            </Text>
            <Text style={styles.emptyText}>
              {query
                ? `No diseases match "${query}".`
                : 'This category has no diseases yet.\nMove diseases here from another category.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredDiseases}
            keyExtractor={item => item.id}
            renderItem={renderDisease}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </RNAnimated.View>

      {/* Modals */}
      <MoveDiseaseModal
        visible={movingDisease !== null}
        disease={movingDisease}
        currentCategory={currentCategory}
        allCategories={allCategories}
        onMove={handleMove}
        onCancel={() => setMovingDisease(null)}
      />
      <RenameModal
        visible={showRename}
        current={currentCategory}
        allCategories={allCategories}
        onRename={handleRename}
        onCancel={() => setShowRename(false)}
      />
    </View>
  );
};

export default CategoryDiseasesScreen;

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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  renameBtn: {
    width: 60,
    alignItems: 'flex-end',
  },
  renameBtnText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing['4'],
    marginTop: Spacing['3'],
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
  },
  searchIcon: {
    fontSize: 15,
    marginRight: Spacing['2'],
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    padding: 0,
  },

  // Info banner
  infoBanner: {
    marginHorizontal: Spacing['4'],
    marginTop: Spacing['3'],
    padding: Spacing['2'],
    backgroundColor: '#EFF3FF',
    borderRadius: Radii.sm,
  },
  infoBannerText: {
    fontSize: Typography.xs,
    color: Colors.textBlue,
    textAlign: 'center',
  },

  // Disease card
  listContent: {
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['3'],
    paddingBottom: Spacing['8'],
  },
  diseaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['3'],
    marginBottom: Spacing['2'],
    ...Shadows.sm,
  },
  diseaseInfo: {
    flex: 1,
  },
  diseaseName: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
  },
  metaBadge: {
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
  },
  metaBadgeText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  symptomCount: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  moveHint: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.medium,
    marginLeft: Spacing['2'],
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['8'],
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing['3'],
  },
  emptyTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing['2'],
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: Typography.sm * Typography.relaxed,
  },
});

const moveStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: Radii['2xl'],
    borderTopRightRadius: Radii['2xl'],
    padding: Spacing['5'],
    paddingBottom: Spacing['8'],
    ...Shadows.md,
  },
  title: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing['1'],
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginBottom: Spacing['4'],
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing['2'],
    marginBottom: Spacing['3'],
  },
  categoryOption: {
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
    borderRadius: Radii.full,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryOptionText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  categoryOptionTextSelected: {
    color: '#fff',
  },
  newCategoryToggle: {
    paddingVertical: Spacing['2'],
    marginBottom: Spacing['2'],
  },
  newCategoryToggleText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.medium,
  },
  customRow: {
    flexDirection: 'row',
    gap: Spacing['2'],
    marginBottom: Spacing['3'],
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  customConfirmBtn: {
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['2'],
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    justifyContent: 'center',
  },
  customConfirmText: {
    fontSize: Typography.sm,
    color: '#fff',
    fontWeight: Typography.semibold,
  },
  cancelBtn: {
    paddingVertical: Spacing['3'],
    alignItems: 'center',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing['2'],
  },
  cancelText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
});

const renameStyles = StyleSheet.create({
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
    marginBottom: Spacing['4'],
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
