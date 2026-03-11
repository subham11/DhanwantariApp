import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux';
import {RootStackParamList} from '@store/types';
import type {RootState} from '@store/store';

import ConsentScreen from '@features/consent/ConsentScreen';
import ProfileListScreen from '@features/profile/ProfileListScreen';
import NewProfileScreen from '@features/profile/NewProfileScreen';
import ChatScreen from '@features/chat/ChatScreen';
import SymptomCheckerScreen from '@features/symptoms/SymptomCheckerScreen';
import SymptomAnalysisScreen from '@features/symptoms/SymptomAnalysisScreen';
import ClassificationsScreen from '@features/classifications/ClassificationsScreen';
import CategoryDiseasesScreen from '@features/classifications/CategoryDiseasesScreen';
import MedicineScreen from '@features/medicine/MedicineScreen';
import ReferralGuidanceScreen from '@features/referral/ReferralGuidanceScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const consentGranted = useSelector((s: RootState) => s.device.consentGranted);

  return (
  <Stack.Navigator
    initialRouteName={consentGranted ? 'ProfileList' : 'Consent'}
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      contentStyle: {backgroundColor: 'transparent'},
    }}>
    <Stack.Screen
      name="Consent"
      component={ConsentScreen}
      options={{gestureEnabled: false, animation: 'fade'}}
    />
    <Stack.Screen name="ProfileList" component={ProfileListScreen} />
    <Stack.Screen
      name="NewProfile"
      component={NewProfileScreen}
      options={{animation: 'slide_from_bottom'}}
    />
    <Stack.Screen name="Chat" component={ChatScreen} />
    <Stack.Screen
      name="SymptomChecker"
      component={SymptomCheckerScreen}
      options={{animation: 'slide_from_bottom'}}
    />
    <Stack.Screen name="SymptomAnalysis" component={SymptomAnalysisScreen} />
    <Stack.Screen name="Classifications" component={ClassificationsScreen} />
    <Stack.Screen name="CategoryDiseases" component={CategoryDiseasesScreen} />
    <Stack.Screen
      name="MedicineDetail"
      component={MedicineScreen}
      options={{animation: 'slide_from_right'}}
    />
    <Stack.Screen
      name="ReferralGuidance"
      component={ReferralGuidanceScreen}
      options={{animation: 'slide_from_bottom'}}
    />
  </Stack.Navigator>
  );
};

export default RootNavigator;
