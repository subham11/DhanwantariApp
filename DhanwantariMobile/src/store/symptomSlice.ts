import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {AnalysisResult} from './types';

interface SymptomState {
  selectedSymptoms: string[];
  lastAnalysis: AnalysisResult | null;
  // keyed by profileId
  analysisHistory: Record<string, AnalysisResult[]>;
}

const initialState: SymptomState = {
  selectedSymptoms: [],
  lastAnalysis: null,
  analysisHistory: {},
};

const symptomSlice = createSlice({
  name: 'symptom',
  initialState,
  reducers: {
    toggleSymptom(state, action: PayloadAction<string>) {
      const sym = action.payload;
      const idx = state.selectedSymptoms.indexOf(sym);
      if (idx === -1) {
        state.selectedSymptoms.push(sym);
      } else {
        state.selectedSymptoms.splice(idx, 1);
      }
    },
    clearSelectedSymptoms(state) {
      state.selectedSymptoms = [];
    },
    setAnalysisResult(
      state,
      action: PayloadAction<{profileId: string; result: AnalysisResult}>,
    ) {
      const {profileId, result} = action.payload;
      state.lastAnalysis = result;
      if (!state.analysisHistory[profileId]) {
        state.analysisHistory[profileId] = [];
      }
      // Keep last 20 analyses
      state.analysisHistory[profileId].unshift(result);
      if (state.analysisHistory[profileId].length > 20) {
        state.analysisHistory[profileId].pop();
      }
    },
    clearAnalysis(state) {
      state.lastAnalysis = null;
      state.selectedSymptoms = [];
    },
  },
});

export const {
  toggleSymptom,
  clearSelectedSymptoms,
  setAnalysisResult,
  clearAnalysis,
} = symptomSlice.actions;

export default symptomSlice.reducer;
