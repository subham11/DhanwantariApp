import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {UserProfile} from './types';

interface ProfileState {
  profiles: UserProfile[];
  activeProfileId: string | null;
}

const initialState: ProfileState = {
  profiles: [],
  activeProfileId: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    addProfile(state, action: PayloadAction<UserProfile>) {
      state.profiles.push(action.payload);
    },
    updateProfile(state, action: PayloadAction<UserProfile>) {
      const idx = state.profiles.findIndex(p => p.id === action.payload.id);
      if (idx !== -1) {
        state.profiles[idx] = action.payload;
      }
    },
    deleteProfile(state, action: PayloadAction<string>) {
      state.profiles = state.profiles.filter(p => p.id !== action.payload);
      if (state.activeProfileId === action.payload) {
        state.activeProfileId = state.profiles[0]?.id ?? null;
      }
    },
    setActiveProfile(state, action: PayloadAction<string>) {
      state.activeProfileId = action.payload;
      const profile = state.profiles.find(p => p.id === action.payload);
      if (profile) {
        profile.lastUsedAt = new Date().toISOString();
      }
    },
    clearAllProfiles(state) {
      state.profiles = [];
      state.activeProfileId = null;
    },
  },
});

export const {
  addProfile,
  updateProfile,
  deleteProfile,
  setActiveProfile,
  clearAllProfiles,
} = profileSlice.actions;

export default profileSlice.reducer;
