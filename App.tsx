import React, {useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from '@/navigation/RootNavigator';
import {StationAlertModal} from '@/components/StationAlertModal';
import {TripFinishModal} from '@/components/TripFinishModal';
import {useUserStore} from '@/store/useUserStore';
import {usePointsStore} from '@/store/usePointsStore';
import {useTripStore} from '@/store/useTripStore';
import {useWalletStore} from '@/store/useWalletStore';
import {useSettingsStore} from '@/store/useSettingsStore';
import {OnboardingScreen} from '@/screens/OnboardingScreen';
import {ThemeProvider, useTheme} from '@/theme/ThemeProvider';
import {darkColors} from '@/theme/theme';

export default function App() {
  const [ready, setReady] = useState(false);
  const initUser = useUserStore((s) => s.init);
  const initPoints = usePointsStore((s) => s.load);
  const initTrip = useTripStore((s) => s.init);
  const initWallet = useWalletStore((s) => s.init);
  const initSettings = useSettingsStore((s) => s.init);

  useEffect(() => {
    (async () => {
      await Promise.all([initUser(), initPoints(), initTrip(), initWallet(), initSettings()]);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: darkColors.background}}>
        <ActivityIndicator size="large" color={darkColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const {navTheme, colors} = useTheme();
  const onboarded = useSettingsStore((s) => s.onboarded);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);

  // 首次启动：未看过引导则展示 Onboarding，完成后持久化 onboarded
  if (!onboarded) {
    return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{flex: 1, backgroundColor: colors.background}}>
        <RootNavigator />
        <StationAlertModal />
        <TripFinishModal />
      </View>
    </NavigationContainer>
  );
}
