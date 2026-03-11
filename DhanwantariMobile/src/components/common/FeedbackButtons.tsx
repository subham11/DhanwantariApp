/**
 * FeedbackButtons.tsx
 *
 * Thumbs-up / thumbs-down feedback buttons for AI responses.
 * On thumbs-down, enqueues the item into the persistent feedback queue
 * for re-answering via Bedrock when connectivity is available.
 */

import React, {useCallback} from 'react';
import {StyleSheet, Text, View, TouchableOpacity} from 'react-native';
import {useAppDispatch} from '@hooks/useAppDispatch';
import {setMessageFeedback} from '@store/chatSlice';
import {enqueueFeedback} from '@services/FeedbackQueueService';
import type {FeedbackValue} from '@store/types';
import {Colors, Typography, Spacing, Radii} from '@theme/tokens';

interface Props {
  messageId: string;
  profileId: string;
  currentFeedback: FeedbackValue | undefined;
  originalQuery: string;
  originalResponse: string;
}

const FeedbackButtons: React.FC<Props> = ({
  messageId,
  profileId,
  currentFeedback,
  originalQuery,
  originalResponse,
}) => {
  const dispatch = useAppDispatch();

  const handleFeedback = useCallback(
    async (value: 'up' | 'down') => {
      // Toggle off if same button pressed again
      const newValue: FeedbackValue = currentFeedback === value ? null : value;

      dispatch(
        setMessageFeedback({profileId, messageId, feedback: newValue}),
      );

      // Enqueue for Bedrock re-answer on thumbs-down
      if (newValue === 'down') {
        await enqueueFeedback(
          messageId,
          profileId,
          originalQuery,
          originalResponse,
        );
      }
    },
    [currentFeedback, dispatch, messageId, profileId, originalQuery, originalResponse],
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          currentFeedback === 'up' && styles.buttonActive,
        ]}
        onPress={() => handleFeedback('up')}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text
          style={[
            styles.icon,
            currentFeedback === 'up' && styles.iconActive,
          ]}>
          👍
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.button,
          currentFeedback === 'down' && styles.buttonActiveDown,
        ]}
        onPress={() => handleFeedback('down')}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text
          style={[
            styles.icon,
            currentFeedback === 'down' && styles.iconActive,
          ]}>
          👎
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing['1'],
    marginTop: 4,
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonActive: {
    backgroundColor: 'rgba(46,125,50,0.12)',
  },
  buttonActiveDown: {
    backgroundColor: 'rgba(211,47,47,0.12)',
  },
  icon: {
    fontSize: 14,
    opacity: 0.5,
  },
  iconActive: {
    opacity: 1,
  },
});

export default React.memo(FeedbackButtons);
