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

const Tab = createBottomTabNavigator();
const MapStack = createNativeStackNavigator();
const MeStack = createNativeStackNavigator();

function MapStackScreen() {
  return (
    <MapStack.Navigator screenOptions={{headerShown: false}}>
      <MapStack.Screen name="Map" component={MapScreen} />
      <MapStack.Screen name="RoutePlan" component={RoutePlanScreen} />
      <MapStack.Screen name="StationInfo" component={StationInfoScreen} />
    </MapStack.Navigator>
  );
}

function MeStackScreen() {
  return (
    <MeStack.Navigator screenOptions={{headerShown: false}}>
      <MeStack.Screen name="Me" component={MeScreen} />
      <MeStack.Screen name="Settings" component={SettingsScreen} />
      <MeStack.Screen name="Airdrop" component={AirdropScreen} />
      <MeStack.Screen name="Tasks" component={TasksScreen} />
      <MeStack.Screen name="Activities" component={ActivitiesScreen} />
      <MeStack.Screen name="Rank" component={RankScreen} />
      <MeStack.Screen name="Help" component={HelpScreen} />
    </MeStack.Navigator>
  );
}

const TABS = [
  {name: 'MapTab', component: MapStackScreen, labelKey: 'nav.map' as const, icon: '◎'},
  {name: 'Trip', component: TripScreen, labelKey: 'nav.trip' as const, icon: '▶'},
  {name: 'Points', component: PointsScreen, labelKey: 'nav.points' as const, icon: '◆'},
  {name: 'Wallet', component: WalletScreen, labelKey: 'nav.wallet' as const, icon: '◇'},
  {name: 'MeTab', component: MeStackScreen, labelKey: 'nav.me' as const, icon: '○'},
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
