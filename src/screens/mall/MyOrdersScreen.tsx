import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {fetchOrders} from '@/services/mallService';
import {MallOrder} from '@/types/mall';
import {useTheme} from '@/theme/ThemeProvider';
import {t} from '@/i18n';
import {spacing} from '@/theme/theme';
import {Card, Empty, ScreenHeader} from '@/components/common';

const STATUS_LABEL: Record<string, string> = {
  unpaid: 'mall.statusUnpaid',
  paid: 'mall.statusPaid',
  shipped: 'mall.statusShipped',
  completed: 'mall.statusCompleted',
  cancelled: 'mall.statusCancelled',
};

export default function MyOrdersScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<MallOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders('me').then(data => {
      setOrders(data);
      setLoading(false);
    });
  }, []);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('mall.myOrders')} />
      {loading ? (
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={{flex: 1}}>
          <Empty text={t('mall.emptyOrders')} />
          <View style={{alignItems: 'center', marginTop: spacing.md}}>
            <TouchableOpacity onPress={() => navigation.navigate('MallHome')}>
              <Text style={{color: colors.primary, fontWeight: '600'}}>{t('mall.goShopping')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg}}>
          {orders.map(o => (
            <Card key={o.id} style={{padding: spacing.md, marginBottom: spacing.md}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Text style={{color: colors.textSub, fontSize: 12}}>{o.id}</Text>
                <Text style={{color: colors.primary, fontSize: 12, fontWeight: '700'}}>
                  {t(STATUS_LABEL[o.status] as any)}
                </Text>
              </View>
              {o.items.map((it, i) => (
                <Text key={i} numberOfLines={1} style={{color: colors.text, marginTop: 6}}>
                  {it.title} × {it.qty}
                </Text>
              ))}
              <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm}}>
                <Text style={{color: colors.text, fontWeight: '700'}}>
                  {o.totalPoint} {t('mall.point')}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}
