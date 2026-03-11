import React, {useEffect, useRef} from 'react';
import {AppState, AppStateStatus, StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {store, persistor} from './src/store/store';
import RootNavigator from './src/navigation/RootNavigator';
import {initDB, seedDiseases} from './src/services/db';
import {getDiseases} from './src/utils/dataLoader';
import {runSync} from './src/services/syncEngine';
import {startFeedbackSync} from './src/services/FeedbackSyncWorker';
import {detectDeviceCapability} from './src/ai/DeviceCapabilityDetector';
import {setDeviceProfile, setConsentGranted} from './src/store/deviceSlice';
import {hasConsent} from './src/privacy/ConsentManager';

function App(): React.JSX.Element {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // ── Startup: init DB then trigger first background sync ─────────────────
    (async () => {
      try {
        await initDB();
        await seedDiseases(getDiseases());
      } catch (e) {
        console.warn('[DB] init failed:', e);
      }

      // Detect device capability tier (cached after first run)
      try {
        const deviceProfile = await detectDeviceCapability();
        store.dispatch(setDeviceProfile(deviceProfile));
      } catch (e) {
        console.warn('[Device] capability detection failed:', e);
      }

      // Restore advisory consent state from AsyncStorage
      try {
        const consented = await hasConsent('advisory_acknowledgement');
        store.dispatch(setConsentGranted(consented));
      } catch (e) {
        console.warn('[Consent] check failed:', e);
      }

      // Non-blocking: fire and forget — errors handled inside runSync
      runSync();

      // Start background feedback queue sync (drains on connectivity)
      startFeedbackSync();
    })();

    // ── Foreground detection: re-sync when app comes back from background ───
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          // App came to foreground — run sync (throttled to once per 6h)
          runSync();
        }
        appState.current = nextState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SafeAreaProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
});

export default App;
