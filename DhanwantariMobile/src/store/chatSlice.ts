import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {ChatMessage, FeedbackValue} from './types';

interface ChatState {
  // keyed by profileId
  sessions: Record<string, ChatMessage[]>;
  streamingMessageId: string | null;
  isLLMConnected: boolean;
}

const initialState: ChatState = {
  sessions: {},
  streamingMessageId: null,
  isLLMConnected: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage(
      state,
      action: PayloadAction<{profileId: string; message: ChatMessage}>,
    ) {
      const {profileId, message} = action.payload;
      if (!state.sessions[profileId]) {
        state.sessions[profileId] = [];
      }
      state.sessions[profileId].push(message);
    },
    updateStreamingMessage(
      state,
      action: PayloadAction<{
        profileId: string;
        messageId: string;
        content: string;
        done: boolean;
      }>,
    ) {
      const {profileId, messageId, content, done} = action.payload;
      const session = state.sessions[profileId];
      if (!session) return;
      const msg = session.find(m => m.id === messageId);
      if (msg) {
        msg.content = content;
        msg.isStreaming = !done;
      }
      if (done) {
        state.streamingMessageId = null;
      }
    },
    setStreamingMessageId(state, action: PayloadAction<string | null>) {
      state.streamingMessageId = action.payload;
    },
    clearSession(state, action: PayloadAction<string>) {
      delete state.sessions[action.payload];
    },
    setLLMConnected(state, action: PayloadAction<boolean>) {
      state.isLLMConnected = action.payload;
    },
    setMessageFeedback(
      state,
      action: PayloadAction<{
        profileId: string;
        messageId: string;
        feedback: FeedbackValue;
      }>,
    ) {
      const {profileId, messageId, feedback} = action.payload;
      const session = state.sessions[profileId];
      if (!session) return;
      const msg = session.find(m => m.id === messageId);
      if (msg) {
        msg.feedback = feedback;
      }
    },
    updateMessageContent(
      state,
      action: PayloadAction<{
        profileId: string;
        messageId: string;
        content: string;
      }>,
    ) {
      const {profileId, messageId, content} = action.payload;
      const session = state.sessions[profileId];
      if (!session) return;
      const msg = session.find(m => m.id === messageId);
      if (msg) {
        msg.content = content;
      }
    },
  },
});

export const {
  addMessage,
  updateStreamingMessage,
  setStreamingMessageId,
  clearSession,
  setLLMConnected,
  setMessageFeedback,
  updateMessageContent,
} = chatSlice.actions;

export default chatSlice.reducer;
