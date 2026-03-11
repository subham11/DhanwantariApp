import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {DeviceProfile, DeviceTier} from './types';

interface DeviceState {
  profile: DeviceProfile | null;
  consentGranted: boolean;
  llmDownloaded: boolean;
  llmDownloadProgress: number; // 0–100
  llmDownloadStatus: 'idle' | 'downloading' | 'done' | 'error';
  llmDownloadError: string | null;
}

const initialState: DeviceState = {
  profile: null,
  consentGranted: false,
  llmDownloaded: false,
  llmDownloadProgress: 0,
  llmDownloadStatus: 'idle',
  llmDownloadError: null,
};

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setDeviceProfile(state, action: PayloadAction<DeviceProfile>) {
      state.profile = action.payload;
    },
    setConsentGranted(state, action: PayloadAction<boolean>) {
      state.consentGranted = action.payload;
    },
    setLLMDownloaded(state, action: PayloadAction<boolean>) {
      state.llmDownloaded = action.payload;
      if (action.payload) {
        state.llmDownloadStatus = 'done';
        state.llmDownloadProgress = 100;
      }
    },
    setLLMDownloadProgress(state, action: PayloadAction<number>) {
      state.llmDownloadProgress = action.payload;
      state.llmDownloadStatus = 'downloading';
    },
    setLLMDownloadStatus(
      state,
      action: PayloadAction<DeviceState['llmDownloadStatus']>,
    ) {
      state.llmDownloadStatus = action.payload;
    },
    setLLMDownloadError(state, action: PayloadAction<string | null>) {
      state.llmDownloadError = action.payload;
      state.llmDownloadStatus = action.payload ? 'error' : 'idle';
    },
  },
});

export const {
  setDeviceProfile,
  setConsentGranted,
  setLLMDownloaded,
  setLLMDownloadProgress,
  setLLMDownloadStatus,
  setLLMDownloadError,
} = deviceSlice.actions;

export type {DeviceState, DeviceTier};
export default deviceSlice.reducer;
