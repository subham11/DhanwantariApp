import React, {useRef, useEffect, useCallback, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated as RNAnimated,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {nanoid} from '@reduxjs/toolkit';
import {useAppDispatch, useAppSelector} from '@hooks/useAppDispatch';
import {addMessage, setStreamingMessageId, clearSession} from '@store/chatSlice';
import {ChatMessage, RootStackParamList} from '@store/types';
import {useHealthCheckQuery} from '@services/llmApi';
import {askLLM} from '@cloud/LLMEngine';
import {indexMarkdownReport, searchReport, SAMPLE_BLOOD_REPORT} from '@services/reportIndexer';
import GlassHeader from '@components/glass/GlassHeader';
import GlassCard from '@components/glass/GlassCard';
import AnimatedPressable from '@components/common/AnimatedPressable';
import FeedbackButtons from '@components/common/FeedbackButtons';
import {Colors, Typography, Spacing, Radii, Shadows} from '@theme/tokens';
import {getInitials} from '@utils/analysisEngine';
import {tierLabel} from '@ai/DeviceCapabilityDetector';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const QUICK_QUESTIONS = [
  'Dengue danger signs?',
  'Fever in pregnancy — what to do?',
  'TB DOTS medicines & prices',
  'Diabetes JanAushadhi meds',
];

const WELCOME_INTRO = (name: string, stats: string) =>
  `Namaste ${name}! 🙏\n\nI am DhanwantariAI — your offline clinical decision support assistant.\n\n${stats}\n\nI can help you with symptom analysis, disease information, and medication guidance. All processing happens on your device — no internet required.\n\nWhat would you like to know today?`;

const ChatScreen: React.FC<Props> = ({navigation, route}) => {
  const {profileId} = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const flatListRef = useRef<FlatList>(null);

  const profile = useAppSelector(s =>
    s.profile.profiles.find(p => p.id === profileId),
  );
  const messages = useAppSelector(
    s => s.chat.sessions[profileId] ?? [],
  );
  const isLLMConnected = useAppSelector(s => s.chat.isLLMConnected);
  const deviceTier = useAppSelector(s => s.device.profile?.tier ?? null);

  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const analysisSentRef = useRef(false);

  const {data: healthData} = useHealthCheckQuery(undefined, {
    pollingInterval: 30000,
  });


  // Send welcome message on first load
  useEffect(() => {
    if (messages.length === 0 && profile) {
      const stats = `📊 Your Profile:\n• ${profile.firstName} ${profile.lastName}, Age ${profile.age}\n• BMI: ${profile.bmi?.toFixed(1)} (${profile.bmiCategory})\n• Maintenance Calories: ${profile.maintenanceCalories} kcal/day`;
      const welcomeMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: WELCOME_INTRO(profile.firstName, stats),
        timestamp: new Date().toISOString(),
      };
      dispatch(addMessage({profileId, message: welcomeMsg}));
    }
  }, [profile, messages.length, profileId, dispatch]);

  // Auto-send symptom analysis summary when arriving from SymptomAnalysisScreen
  useEffect(() => {
    const analysisResult = route.params.analysisResult;
    if (!analysisResult || analysisSentRef.current) return;
    analysisSentRef.current = true;

    const conditionsText =
      analysisResult.matchedDiseases.length > 0
        ? analysisResult.matchedDiseases
            .slice(0, 3)
            .map(m => m.disease.name)
            .join(', ')
        : 'No strong matches found by local database';

    const autoText =
      `🩺 Symptom Check Results\n\n` +
      `Symptoms: ${analysisResult.symptoms.join(', ')}\n` +
      `Severity: ${analysisResult.severity}\n` +
      `Probable Conditions: ${conditionsText}\n\n` +
      `Please explain these possible conditions, what I should watch for, and next steps I can take.`;

    // Slight delay so the welcome message renders first
    const timer = setTimeout(() => sendMessage(autoText), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.analysisResult]);

  const handleIndexReport = useCallback(async () => {
    if (isIndexing || isThinking) return;
    setIsIndexing(true);

    // Post user-side trigger message
    const triggerMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: '📄 Analyse my blood test report',
      timestamp: new Date().toISOString(),
    };
    dispatch(addMessage({profileId, message: triggerMsg}));
    setIsThinking(true);

    try {
      const result = await indexMarkdownReport(
        SAMPLE_BLOOD_REPORT,
        'BloodReport_Sample',
      );

      const {formatted} = await searchReport(
        result,
        'hemoglobin glucose thyroid cholesterol anemia',
        6,
      );

      const responseText =
        `📊 **Report Indexed Successfully** _(offline · keyword mode)_\n\n` +
        `**Top findings from your blood report:**\n${formatted}\n\n` +
        `The report has been indexed locally. You can now ask me questions like:\n` +
        `• "What does my TSH result mean?"\n` +
        `• "Am I anaemic?"\n` +
        `• "What should I do about high LDL?"\n\n` +
        `_Note: This used keyword indexing — no AI server required._`;

      const assistantMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
        isOffline: true,
      };
      dispatch(addMessage({profileId, message: assistantMsg}));
    } catch (err) {
      const errMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: `⚠️ Failed to index report: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        isOffline: true,
      };
      dispatch(addMessage({profileId, message: errMsg}));
    } finally {
      setIsThinking(false);
      setIsIndexing(false);
    }
  }, [isIndexing, isThinking, profileId, dispatch]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({animated: true}), 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;
      setInputText('');

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      dispatch(addMessage({profileId, message: userMsg}));
      setIsThinking(true);

      try {
        // Tiered routing: local LLM → Bedrock (if internet available) → offline fallback
        const llmResult = await askLLM(trimmed, profile ?? null, messages);

        const assistantMsg: ChatMessage = {
          id: nanoid(),
          role: 'assistant',
          content: llmResult.response,
          timestamp: new Date().toISOString(),
          isOffline: llmResult.tier === 'offline_fallback',
        };
        dispatch(addMessage({profileId, message: assistantMsg}));
      } catch {
        const errorMsg: ChatMessage = {
          id: nanoid(),
          role: 'assistant',
          content: 'I apologize — I could not generate a response right now.',
          timestamp: new Date().toISOString(),
          isOffline: true,
        };
        dispatch(addMessage({profileId, message: errorMsg}));
      } finally {
        setIsThinking(false);
      }
    },
    [isThinking, messages, profileId, profile, dispatch],
  );

  const renderMessage = useCallback(
    ({item, index}: {item: ChatMessage; index: number}) => {
      const isUser = item.role === 'user';

      // Find the preceding user message as context for feedback re-answer
      let precedingQuery = '';
      if (!isUser) {
        for (let i = index - 1; i >= 0; i--) {
          if (messages[i]?.role === 'user') {
            precedingQuery = messages[i].content;
            break;
          }
        }
      }

      return (
        <View
          style={[
            styles.messageRow,
            isUser ? styles.messageRowUser : styles.messageRowAssistant,
          ]}>
          {!isUser && (
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarSmallText}>D</Text>
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isUser ? styles.bubbleUser : styles.bubbleAssistant,
            ]}>
            {item.isOffline && (
              <View style={styles.offlinePill}>
                <Text style={styles.offlinePillText}>offline</Text>
              </View>
            )}
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
              {item.content}
            </Text>
            <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {!isUser && !item.isStreaming && (
              <FeedbackButtons
                messageId={item.id}
                profileId={profileId}
                currentFeedback={item.feedback}
                originalQuery={precedingQuery}
                originalResponse={item.content}
              />
            )}
          </View>
          {isUser && profile && (
            <View style={[styles.avatarSmall, styles.avatarSmallUser]}>
              <Text style={styles.avatarSmallText}>
                {getInitials(profile.firstName, profile.lastName)}
              </Text>
            </View>
          )}
        </View>
      );
    },
    [profile, profileId, messages],
  );

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Profile not found.</Text>
      </View>
    );
  }

  const statusLabel = isLLMConnected
    ? 'ready'
    : healthData
    ? 'ready'
    : 'offline';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <GlassHeader
        title="DhanwantariAI"
        subtitle={`Offline AI Clinical Support${
          deviceTier ? ` · ${tierLabel(deviceTier)}` : ''
        }`}
        statusDot={statusLabel === 'ready' ? 'ready' : 'offline'}
        leftContent={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.headerBack}>‹</Text>
          </TouchableOpacity>
        }
        rightContent={
          <AnimatedPressable
            style={styles.profileChip}
            onPress={() =>
              navigation.navigate('NewProfile', {editProfileId: profile.id})
            }
            scale={0.95}>
            <View style={styles.profileChipAvatar}>
              <Text style={styles.profileChipAvatarText}>
                {getInitials(profile.firstName, profile.lastName)}
              </Text>
            </View>
            <View style={styles.profileChipTextContainer}>
              <Text style={styles.profileChipName} numberOfLines={1}>
                {`${profile.firstName} ${profile.lastName}`}
              </Text>
              <Text style={styles.profileChipBmi} numberOfLines={1}>
                {`BMI ${profile.bmi?.toFixed(1)} · ${profile.bmiCategory}`}
              </Text>
            </View>
          </AnimatedPressable>
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        {/* Message list */}
        <FlatList
          testID="chat-messages-list"
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messageList,
            {paddingBottom: Spacing['4']},
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={
            isThinking ? (
              <View style={styles.thinkingRow}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>D</Text>
                </View>
                <GlassCard style={styles.thinkingCard}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.thinkingText}>Thinking…</Text>
                </GlassCard>
              </View>
            ) : null
          }
        />

        {/* Quick question chips */}
        {messages.length <= 1 && (
          <View style={styles.chipsContainer}>
            <FlatList
              data={QUICK_QUESTIONS}
              keyExtractor={q => q}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => sendMessage(item)}>
                  <Text style={styles.chipText}>{item}</Text>
                </TouchableOpacity>
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsList}
            />
          </View>
        )}

        {/* Input toolbar */}
        <View
          style={[
            styles.toolbar,
            {paddingBottom: insets.bottom + Spacing['2']},
          ]}>
          <TouchableOpacity
            testID="symptom-checker-btn"
            style={styles.toolbarBtn}
            onPress={() =>
              navigation.navigate('SymptomChecker', {profileId: profile.id})
            }>
            <Text style={styles.toolbarBtnIcon}>🩺</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolbarBtn, isIndexing && styles.toolbarBtnDisabled]}
            onPress={handleIndexReport}
            disabled={isIndexing}>
            <Text style={styles.toolbarBtnIcon}>{isIndexing ? '⏳' : '📄'}</Text>
          </TouchableOpacity>
          <TextInput
            testID="chat-input"
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about symptoms, medicines…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={800}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
            blurOnSubmit={false}
          />
          <AnimatedPressable
            testID="chat-send-btn"
            style={[
              styles.sendBtn,
              !inputText.trim() && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage(inputText)}
            scale={0.9}
            hapticType="impactLight"
            disabled={!inputText.trim() || isThinking}>
            <Text style={styles.sendBtnText}>↑</Text>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  flex: {flex: 1},
  errorText: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 100,
  },
  messageList: {
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['4'],
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing['3'],
    alignItems: 'flex-end',
    gap: Spacing['2'],
  },
  messageRowUser: {justifyContent: 'flex-end'},
  messageRowAssistant: {justifyContent: 'flex-start'},
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarSmallUser: {
    backgroundColor: 'rgba(59,91,219,0.3)',
  },
  avatarSmallText: {
    color: Colors.textInverse,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: Radii.lg,
    padding: Spacing['3'],
    gap: 4,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Radii.sm,
    ...Shadows.sm,
  },
  bubbleAssistant: {
    backgroundColor: Colors.backgroundCard,
    borderBottomLeftRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  bubbleText: {
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    lineHeight: 20,
  },
  bubbleTextUser: {color: Colors.textInverse},
  timestamp: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 2,
  },
  timestampUser: {color: 'rgba(255,255,255,0.6)'},
  offlinePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,124,0,0.15)',
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
    marginBottom: 4,
  },
  offlinePillText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: Typography.medium,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
    paddingHorizontal: Spacing['4'],
    marginTop: Spacing['2'],
  },
  thinkingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['3'],
  },
  thinkingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontStyle: 'italic',
  },
  chipsContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingVertical: Spacing['2'],
  },
  chipsList: {paddingHorizontal: Spacing['4'], gap: Spacing['2']},
  chip: {
    backgroundColor: 'rgba(59,91,219,0.08)',
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(59,91,219,0.2)',
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
  },
  chipText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing['2'],
    paddingHorizontal: Spacing['3'],
    paddingTop: Spacing['2'],
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59,91,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnIcon: {fontSize: 20},
  toolbarBtnDisabled: {opacity: 0.4},
  textInput: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['2'],
    paddingBottom: Spacing['2'],
    maxHeight: 120,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.textMuted,
  },
  sendBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  headerBack: {
    color: Colors.textInverse,
    fontSize: 28,
    lineHeight: 28,
    fontWeight: Typography.medium,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radii.full,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
    maxWidth: 175,
  },
  profileChipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileChipAvatarText: {
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: Typography.bold,
  },
  profileChipTextContainer: {
    flexShrink: 1,
  },
  profileChipName: {
    color: Colors.textInverse,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  profileChipBmi: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    lineHeight: 14,
  },
});

export default ChatScreen;
