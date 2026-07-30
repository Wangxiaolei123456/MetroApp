import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StatusBar, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from '@/navigation/RootNavigator';
import {useUserStore} from '@/store/useUserStore';
import {usePointsStore} from '@/store/usePointsStore';
import {useTripStore} from '@/store/useTripStore';
import {useWalletStore} from '@/store/useWalletStore';
import {useSettingsStore} from '@/store/useSettingsStore';
import {colors} from '@/theme/theme';

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
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} translucent={false} />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
