import {configureStore, combineReducers} from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import profileReducer from './profileSlice';
import chatReducer from './chatSlice';
import symptomReducer from './symptomSlice';
import deviceReducer from './deviceSlice';
import {llmApi} from '@services/llmApi';

const rootReducer = combineReducers({
  profile: profileReducer,
  chat: chatReducer,
  symptom: symptomReducer,
  device: deviceReducer,
  [llmApi.reducerPath]: llmApi.reducer,
});

const persistConfig = {
  key: 'dhanwantari-root',
  version: 1,
  storage: AsyncStorage,
  // Only persist profile, chat, symptom, device — not RTK Query cache
  whitelist: ['profile', 'chat', 'symptom', 'device'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(llmApi.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
