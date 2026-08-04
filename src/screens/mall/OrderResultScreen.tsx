import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {MallOrder} from '@/types/mall';
import {useTheme} from '@/theme/ThemeProvider';
import {t} from '@/i18n';
import {spacing} from '@/theme/theme';
import {ScreenHeader} from '@/components/common';

export default function OrderResultScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const order: MallOrder = route.params?.order;
  const payCancelled: boolean = route.params?.payCancelled;
  const payFailed: boolean = route.params?.payFailed;
  const payMethod: 'points' | 'usd' | undefined = route.params?.payMethod;
  const error: string = route.params?.error;

  const isUnpaidUsd = payMethod === 'usd' && order?.status === 'unpaid';
  const ok = !payCancelled && !payFailed && !isUnpaidUsd;
  const icon = isUnpaidUsd ? '$' : ok ? '✓' : payCancelled ? '!' : '×';
  const iconBg = isUnpaidUsd ? colors.primary : ok ? colors.primary : payCancelled ? colors.textSub : '#E05A5A';
  const title = isUnpaidUsd
    ? t('mall.payUsdPending')
    : ok
    ? t('mall.paySuccess')
    : payCancelled
    ? t('mall.payCancelled')
    : t('mall.payFailed');

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('mall.orderResult')} />
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg}}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
          }}>
          <Text style={{color: '#fff', fontSize: 36, fontWeight: '800'}}>{icon}</Text>
        </View>
        <Text style={{color: colors.text, fontSize: 20, fontWeight: '800'}}>{title}</Text>
        {order?.id ? (
          <Text style={{color: colors.textSub, marginTop: spacing.sm, fontSize: 13}}>
            {t('mall.orderNo')}：{order.id}
          </Text>
        ) : null}
        {error ? (
          <Text style={{color: colors.primary, marginTop: spacing.sm, fontSize: 12, textAlign: 'center'}}>
            {error}
          </Text>
        ) : null}
        {isUnpaidUsd ? (
          <Text style={{color: colors.textSub, marginTop: spacing.sm, fontSize: 12, textAlign: 'center'}}>
            {t('mall.usdPayTip')}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() => navigation.navigate('MallOrders')}
          style={{
            marginTop: spacing.xl,
            backgroundColor: colors.primary,
            borderRadius: 22,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.sm,
          }}>
          <Text style={{color: '#fff', fontWeight: '700'}}>{t('mall.viewOrders')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('MallHome')} style={{marginTop: spacing.md}}>
          <Text style={{color: colors.textSub}}>{t('mall.backToMall')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
