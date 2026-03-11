/**
 * FeedbackSyncWorker.ts
 *
 * Background worker that processes the thumbs-down feedback queue.
 * - Listens to @react-native-community/netinfo for connectivity changes
 * - When internet becomes available, drains the pending queue
 * - Calls BedrockEscalationHandler for each item to get a better answer
 * - Updates local SQLite queue and dispatches Redux action to update chat
 *
 * Lifecycle:
 *   Call startFeedbackSync() once on app launch (e.g. in App.tsx after initDB).
 *   Call stopFeedbackSync() on unmount if needed.
 */

import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import {store} from '@store/store';
import {updateMessageContent, setMessageFeedback} from '@store/chatSlice';
import {escalateToBedrock} from '@cloud/BedrockEscalationHandler';
import {
  getPendingItems,
  markProcessing,
  markCompleted,
  markFailed,
} from './FeedbackQueueService';
import type {FeedbackQueueItem} from '@store/types';

let _unsubscribe: (() => void) | null = null;
let _processing = false;

// ─── Public API ───────────────────────────────────────────────────────────────

export function startFeedbackSync(): void {
  if (_unsubscribe) return; // already running

  _unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

  // Also attempt immediate drain in case we already have connectivity
  NetInfo.fetch().then(state => {
    if (state.isConnected && state.isInternetReachable !== false) {
      drainQueue();
    }
  });
}

export function stopFeedbackSync(): void {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
}

// ─── Connectivity handler ─────────────────────────────────────────────────────

function handleConnectivityChange(state: NetInfoState): void {
  if (state.isConnected && state.isInternetReachable !== false) {
    drainQueue();
  }
}

// ─── Queue processor ─────────────────────────────────────────────────────────

async function drainQueue(): Promise<void> {
  if (_processing) return;
  _processing = true;

  try {
    const items = await getPendingItems();
    for (const item of items) {
      await processItem(item);
    }
  } finally {
    _processing = false;
  }
}

async function processItem(item: FeedbackQueueItem): Promise<void> {
  try {
    await markProcessing(item.id);

    const result = await escalateToBedrock(item.originalQuery);

    if (result.mode === 'unavailable') {
      await markFailed(item.id);
      return;
    }

    // Save the Bedrock response to the queue
    await markCompleted(item.id, result.answer);

    // Update the chat message in Redux with the improved response
    store.dispatch(
      updateMessageContent({
        profileId: item.profileId,
        messageId: item.messageId,
        content:
          `${result.answer}\n\n` +
          `_☁️ Re-answered by DhanwantariAI cloud (Bedrock) after your feedback._`,
      }),
    );

    // Reset feedback since the message has been re-answered
    store.dispatch(
      setMessageFeedback({
        profileId: item.profileId,
        messageId: item.messageId,
        feedback: null,
      }),
    );
  } catch {
    await markFailed(item.id);
  }
}
