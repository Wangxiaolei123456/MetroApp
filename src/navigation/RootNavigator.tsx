import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Text, View} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';
import {useT} from '@/i18n';

import {MapScreen} from '@/screens/MapScreen';
import {RoutePlanScreen} from '@/screens/RoutePlanScreen';
import {StationInfoScreen} from '@/screens/StationInfoScreen';
import {TripScreen} from '@/screens/TripScreen';
import {PointsScreen} from '@/screens/PointsScreen';
import {WalletScreen} from '@/screens/WalletScreen';
import {MeScreen} from '@/screens/MeScreen';
import {SettingsScreen} from '@/screens/SettingsScreen';
import {AirdropScreen} from '@/screens/AirdropScreen';
import {TasksScreen} from '@/screens/TasksScreen';
import {ActivitiesScreen} from '@/screens/ActivitiesScreen';
import {RankScreen} from '@/screens/RankScreen';
import {HelpScreen} from '@/screens/HelpScreen';
import {RewardsHome} from '@/screens/RewardsHome';
import {DashboardScreen} from '@/screens/DashboardScreen';
import {LoginScreen} from '@/screens/LoginScreen';

const Tab = createBottomTabNavigator();
const MapStack = createNativeStackNavigator();
const MeStack = createNativeStackNavigator();
const RewardsStack = createNativeStackNavigator();
const WalletStack = createNativeStackNavigator();

function MapStackScreen() {
  return (
    <MapStack.Navigator screenOptions={{headerShown: false}}>
      <MapStack.Screen name="Map" component={MapScreen} />
      <MapStack.Screen name="RoutePlan" component={RoutePlanScreen} />
      <MapStack.Screen name="StationInfo" component={StationInfoScreen} />
    </MapStack.Navigator>
  );
}

// 把原本埋在「我的」深层的激励模块（积分/任务/活动/空投/排行）聚合为一级「奖励」Tab。
function RewardsTabScreen() {
  return (
    <RewardsStack.Navigator screenOptions={{headerShown: false}}>
      <RewardsStack.Screen name="RewardsHome" component={RewardsHome} />
      <RewardsStack.Screen name="Points" component={PointsScreen} />
      <RewardsStack.Screen name="Tasks" component={TasksScreen} />
      <RewardsStack.Screen name="Activities" component={ActivitiesScreen} />
      <RewardsStack.Screen name="Airdrop" component={AirdropScreen} />
      <RewardsStack.Screen name="Rank" component={RankScreen} />
      <RewardsStack.Screen name="Dashboard" component={DashboardScreen} />
    </RewardsStack.Navigator>
  );
}

// 「我的」精简为个人主页 + 设置 + 帮助，激励相关入口统一收归到「奖励」Tab。
function MeStackScreen() {
  return (
    <MeStack.Navigator screenOptions={{headerShown: false}}>
      <MeStack.Screen name="Me" component={MeScreen} />
      <MeStack.Screen name="Settings" component={SettingsScreen} />
      <MeStack.Screen name="Help" component={HelpScreen} />
      <MeStack.Screen name="Login" component={LoginScreen} />
    </MeStack.Navigator>
  );
}

// 钱包 Tab：未登录时跳到 LoginScreen 引导社交登录，已登录后展示钱包资产。
function WalletTabScreen() {
  return (
    <WalletStack.Navigator screenOptions={{headerShown: false}}>
      <WalletStack.Screen name="Wallet" component={WalletScreen} />
      <WalletStack.Screen name="Login" component={LoginScreen} />
    </WalletStack.Navigator>
  );
}

// Tab 图标改用语义化 emoji 提升识别度；如需更专业的矢量图标，可替换为 react-native-vector-icons。
const TABS = [
  {name: 'MapTab', component: MapStackScreen, labelKey: 'nav.map' as const, icon: '🗺'},
  {name: 'Trip', component: TripScreen, labelKey: 'nav.trip' as const, icon: '🚇'},
  {name: 'RewardsTab', component: RewardsTabScreen, labelKey: 'nav.rewards' as const, icon: '🎁'},
  {name: 'Wallet', component: WalletTabScreen, labelKey: 'nav.wallet' as const, icon: '👛'},
  {name: 'MeTab', component: MeStackScreen, labelKey: 'nav.me' as const, icon: '👤'},
];

export function RootNavigator() {
  const tr = useT();
  const {colors} = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryBright,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 4,
        },
        tabBarLabelStyle: {fontSize: 10, fontWeight: '600', letterSpacing: 0.2},
        tabBarItemStyle: {paddingTop: 2},
      }}>
      {TABS.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            title: tr(t.labelKey),
            tabBarIcon: ({color, focused}) => (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? colors.primarySoft : 'transparent',
                  borderWidth: focused ? 1 : 0,
                  borderColor: focused ? colors.primary + '44' : 'transparent',
                }}>
                <Text
                  style={{
                    fontSize: focused ? 14 : 13,
                    color,
                    fontWeight: focused ? '800' : '500',
                  }}>
                  {t.icon}
                </Text>
              </View>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
