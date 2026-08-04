import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {fetchOrders, listBackendOrders} from '@/services/mallService';
import {BackendOrder, MallOrder, PayMethod} from '@/types/mall';
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
  created: 'mall.statusUnpaid',
  done: 'mall.statusCompleted',
};

/**
 * 把后端 BackendOrder 映射成 MallOrder（供列表统一渲染）。
 * 后端订单无购物车明细时，仅展示总价/状态/时间。
 */
function mapBackendOrder(o: BackendOrder): MallOrder {
  const status: MallOrder['status'] =
    o.status === 'paid' || o.status === 'done'
      ? 'paid'
      : o.status === 'cancelled'
      ? 'cancelled'
      : 'unpaid';
  const payMethod: PayMethod = (o.payMethod as PayMethod) || 'usd';
  return {
    id: o.id,
    items: [
      {
        productId: 0,
        title: `${payMethod === 'usd' ? 'USD' : '积分'} 订单`,
        image: '',
        point: o.totalPoint || 0,
        price: o.totalUsd || 0,
        qty: o.quantity || 1,
        delivery: 1,
      },
    ],
    totalPoint: o.totalPoint || 0,
    totalPrice: payMethod === 'usd' ? o.totalUsd || 0 : o.totalPoint || 0,
    status,
    delivery: 1,
    createdAt: o.createdAt,
  };
}

export default function MyOrdersScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<MallOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // 优先拉取后端（UptickPay）订单：包含 USD/积分的真实订单。
    // 后端为空时回退 Metro.IOS 的 H5 接口（兼容旧链路）。
    const backend = await listBackendOrders();
    if (backend.length > 0) {
      setOrders(backend.map(mapBackendOrder));
      return;
    }
    const legacy = await fetchOrders('me');
    setOrders(legacy);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({item}) => (
            <Card style={{padding: spacing.md, marginBottom: spacing.md}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Text style={{color: colors.textSub, fontSize: 12}}>{item.id}</Text>
                <Text style={{color: colors.primary, fontSize: 12, fontWeight: '700'}}>
                  {t(STATUS_LABEL[item.status] as any)}
                </Text>
              </View>
              {item.items.map((it, i) => (
                <Text key={i} numberOfLines={1} style={{color: colors.text, marginTop: 6}}>
                  {it.title} × {it.qty}
                </Text>
              ))}
              <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm}}>
                <Text style={{color: colors.text, fontWeight: '700'}}>
                  {item.totalPrice > 0 && item.totalPoint !== item.totalPrice
                    ? `$${item.totalPrice.toFixed(2)}`
                    : `${item.totalPoint} ${t('mall.point')}`}
                </Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}