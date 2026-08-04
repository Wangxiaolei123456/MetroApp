import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Linking, View} from 'react-native';
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
import {fetchSupportedCities} from '@/data/metroData';
import {ThemeProvider, useTheme} from '@/theme/ThemeProvider';
import {darkColors} from '@/theme/theme';
import {handleIncomingUrl, WEB3AUTH_REDIRECT_SCHEME} from '@/services/web3Auth';

export default function App() {
  const [ready, setReady] = useState(false);
  const initUser = useUserStore((s) => s.init);
  const initPoints = usePointsStore((s) => s.load);
  const initTrip = useTripStore((s) => s.init);
  const initWallet = useWalletStore((s) => s.init);
  const initSettings = useSettingsStore((s) => s.init);

  useEffect(() => {
    (async () => {
      // 先从运营后端拉取真实城市列表（覆盖本地默认），再初始化各 store。
      await fetchSupportedCities();
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

  // 处理 WebAuth 社交登录的 deep link 回调：浏览器跳回 App 时把 URL 交给 SDK。
  // 这是修复「登录中卡住」的关键——SDK 内部仅靠 Linking 事件等待，
  // 从后台恢复/冷启动时事件常投递不到，需 App 层主动转发。
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      if (url.startsWith(WEB3AUTH_REDIRECT_SCHEME)) {
        void handleIncomingUrl(url);
      }
    };
    // 冷启动：URL 通过 getInitialURL 传入（App 被浏览器 redirect 唤醒）
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    // 运行中：App 在前台收到回调
    const subscription = Linking.addEventListener('url', ({url}) => handleUrl(url));
    return () => subscription.remove();
  }, []);

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
