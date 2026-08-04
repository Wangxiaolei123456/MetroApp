import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  createOrder,
  orderTrade,
} from '@/services/mallService';
import {CartGood, CartGroup, DeliveryMode, MallOrder, MallProduct, PayMethod} from '@/types/mall';
import {usePointsStore, selectPointsStats} from '@/store/usePointsStore';
import {useTheme} from '@/theme/ThemeProvider';
import {t} from '@/i18n';
import {spacing} from '@/theme/theme';
import {Card, ScreenHeader} from '@/components/common';

export default function OrderConfirmScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const params = route.params ?? {};

  const balance = usePointsStore(s => selectPointsStats(s).balance);
  const spend = usePointsStore(s => s.spend);
  const p: MallProduct | undefined = params.product;

  const {items, merchantID, delivery: productDelivery}: {
    items: {title: string; image: string; point: number; price: number; qty: number; delivery: DeliveryMode; shopCartID?: number}[];
    merchantID: number;
    delivery: DeliveryMode;
  } = useMemo(() => {
    if (params.fromCart && params.group) {
      const g: CartGroup = params.group;
      const goods: CartGood[] = params.items ?? g.goods.filter((x: CartGood) => x.selected);
      return {
        items: goods.map((x: CartGood) => ({
          title: x.title,
          image: x.logoUrl,
          point: x.point,
          price: x.price,
          qty: x.num,
          delivery: x.delivery,
          shopCartID: x.shopCartID,
        })),
        merchantID: g.merchantID,
        delivery: g.deliveryMode,
      };
    }
    const p: MallProduct = params.product;
    const qty: number = params.qty ?? 1;
    return {
      items: [{title: p.title, image: p.image, point: p.point, price: p.price, qty, delivery: p.delivery}],
      merchantID: p.merchantID,
      delivery: p.delivery,
    };
  }, [params]);

  const allowedDelivery: DeliveryMode[] = useMemo(() => {
    const can1 = items.every(i => i.delivery === 1 || i.delivery === 3);
    const can2 = items.every(i => i.delivery === 2 || i.delivery === 3);
    const opts: DeliveryMode[] = [];
    if (can1) opts.push(1);
    if (can2) opts.push(2);
    return opts.length ? opts : [productDelivery];
  }, [items, productDelivery]);

  const [delivery, setDelivery] = useState<DeliveryMode>(allowedDelivery[0] ?? 1);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>('');

  // 可选支付方式：优先用商品携带的 payMethods；购物车多商品取交集，缺省为积分
  const availablePayMethods: PayMethod[] = useMemo(() => {
    const fromParams = params.payMethods as PayMethod[] | undefined;
    if (Array.isArray(fromParams) && fromParams.length) return fromParams;
    if (p?.payMethods?.length) return p.payMethods;
    return ['points'];
  }, [params.payMethods]);
  const [payMethod, setPayMethod] = useState<PayMethod>(availablePayMethods[0] ?? 'points');

  const totalPoint = items.reduce((s, i) => s + i.point * i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.qty, 0);
  const enough = totalPoint <= balance;

  const confirm = async () => {
    if (busy) return;
    if (payMethod === 'points' && !enough) return;
    setBusy(true);
    try {
      if (payMethod === 'usd') {
        // USD 支付：预留 UptickPay 收银通道（后期接入）。当前仅生成订单并标记支付方式，
        // 真实扣款待 UptickPay 回调后端后确认。这里先进入「待支付」结果页做展示占位。
        setStage(t('mall.stageUsd'));
        const created = await createOrder({
          // USD 下单仍需 orderID 占位；如后端未提供 ordertrade，这里用前端生成的占位单号
          orderID: `usd_${Date.now()}`,
          delivery: delivery === 2 ? 2 : 3,
          point: 0,
          payMethod: 'usd',
        });
        navigation.replace('MallOrderResult', {order: buildOrder(created.id, 'unpaid'), payMethod: 'usd'});
        return;
      }

      // 积分支付：组装 Metro.IOS 下单串 sku_<shopCartID>|<merchantID>|0
      const shopcart_ios = items
        .map(i => `sku_${i.shopCartID ?? 0}|${merchantID}|0`)
        .join(',');

      // 第一步：ordertrade（锁定库存，拿到预售 orderID）
      setStage(t('mall.stageTrade'));
      const trade = await orderTrade({
        shopcart_ios,
        merchantID,
        delivery: delivery === 2 ? 2 : 3,
      });

      // 第二步：创建订单
      setStage(t('mall.stageCreate'));
      const created = await createOrder({
        orderID: trade.orderID,
        delivery: delivery === 2 ? 2 : 3,
        point: trade.point,
        payMethod: 'points',
      });

      // 积分支付：扣减积分并进入支付成功结果页
      await spend(totalPoint, `${t('mall.orderPay')} ${created.id}`);
      navigation.replace('MallOrderResult', {order: buildOrder(created.id, 'paid'), payMethod: 'points'});
    } catch (e: any) {
      navigation.replace('MallOrderResult', {order: buildOrder('', 'cancelled'), payFailed: true, error: e?.message});
    } finally {
      setBusy(false);
    }
  };

  const buildOrder = (id: string, status: MallOrder['status']): MallOrder => ({
    id,
    items: items.map(i => ({
      productId: i.shopCartID ?? 0,
      title: i.title,
      image: i.image,
      point: i.point,
      price: i.price,
      qty: i.qty,
      delivery: i.delivery,
    })),
    totalPoint,
    totalPrice,
    status,
    delivery,
    createdAt: new Date().toISOString(),
  });

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('mall.orderConfirm')} />
      <ScrollView contentContainerStyle={{padding: spacing.lg, paddingBottom: 120}}>
        {/* 配送方式 */}
        <Text style={[sectionTitle, {color: colors.text}]}>{t('mall.delivery')}</Text>
        <View style={{flexDirection: 'row', marginTop: spacing.sm}}>
          {allowedDelivery.map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => setDelivery(d)}
              style={[
                deliveryChip(colors),
                delivery === d && {borderColor: colors.primary, backgroundColor: colors.primary + '18'},
              ]}>
              <Text style={{color: delivery === d ? colors.primary : colors.textSub, fontWeight: '600'}}>
                {t((d === 2 ? 'mall.deliveryPickup' : 'mall.deliveryDelivery') as any)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {delivery === 2 ? (
          <Text style={{color: colors.textSub, fontSize: 12, marginTop: spacing.sm}}>
            {t('mall.pickupTip')}
          </Text>
        ) : (
          <View style={{marginTop: spacing.sm}}>
            <Card style={{padding: spacing.md}}>
              <Text style={{color: colors.text, fontWeight: '600'}}>{t('mall.address')}</Text>
              <Text style={{color: colors.textSub, marginTop: 6}}>
                {t('mall.addressPlaceholder')}
              </Text>
            </Card>
          </View>
        )}

        {/* 商品清单 */}
        <Text style={[sectionTitle, {marginTop: spacing.lg, color: colors.text}]}>{t('mall.orderItems')}</Text>
        {items.map((i, idx) => (
          <Card key={idx} style={{flexDirection: 'row', padding: spacing.sm, marginTop: spacing.sm}}>
            <Image source={{uri: i.image}} style={{width: 56, height: 56, borderRadius: 10, backgroundColor: colors.border}} />
            <View style={{flex: 1, marginLeft: spacing.sm}}>
              <Text numberOfLines={2} style={{color: colors.text, fontWeight: '600'}}>{i.title}</Text>
              <Text style={{color: colors.primary, fontWeight: '700', marginTop: 4}}>
                {i.point} {t('mall.point')} × {i.qty}
              </Text>
            </View>
          </Card>
        ))}

        <Card style={{marginTop: spacing.md, padding: spacing.md}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <Text style={{color: colors.textSub}}>{t('mall.totalPoint')}</Text>
            <Text style={{color: colors.primary, fontWeight: '800'}}>{totalPoint} {t('mall.point')}</Text>
          </View>
          {payMethod === 'usd' && totalPrice > 0 ? (
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
              <Text style={{color: colors.textSub}}>{t('mall.totalPrice')}</Text>
              <Text style={{color: colors.text, fontWeight: '700'}}>${totalPrice.toFixed(2)}</Text>
            </View>
          ) : (
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
              <Text style={{color: colors.textSub}}>{t('mall.totalPrice')}</Text>
              <Text style={{color: colors.text, fontWeight: '700'}}>¥{totalPrice}</Text>
            </View>
          )}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
            <Text style={{color: colors.textSub}}>{t('mall.myPoints')}</Text>
            <Text style={{color: enough ? colors.text : colors.primary, fontWeight: '700'}}>
              {balance} {t('mall.point')}
            </Text>
          </View>
        </Card>

        {/* 支付方式选择 */}
        {availablePayMethods.length > 1 ? (
          <View style={{marginTop: spacing.lg}}>
            <Text style={[sectionTitle, {color: colors.text}]}>{t('mall.payMethod')}</Text>
            <View style={{flexDirection: 'row', marginTop: spacing.sm}}>
              {availablePayMethods.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPayMethod(m)}
                  style={[
                    deliveryChip(colors),
                    payMethod === m && {borderColor: colors.primary, backgroundColor: colors.primary + '18'},
                  ]}>
                  <Text style={{color: payMethod === m ? colors.primary : colors.textSub, fontWeight: '600'}}>
                    {m === 'points' ? t('mall.pointPay') : t('mall.usdPay')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {payMethod === 'usd' ? (
              <Text style={{color: colors.textSub, fontSize: 12, marginTop: spacing.sm}}>
                {t('mall.usdPayTip')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!enough && (
          <Text style={{color: colors.primary, fontSize: 13, marginTop: spacing.sm, textAlign: 'center'}}>
            {t('mall.pointNotEnough')}
          </Text>
        )}
        {busy && stage ? (
          <Text style={{color: colors.textSub, fontSize: 12, marginTop: spacing.sm, textAlign: 'center'}}>
            {stage}…
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          paddingBottom: insets.bottom + spacing.sm,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
        <Text style={{color: colors.text, fontWeight: '800', fontSize: 16}}>
          {payMethod === 'usd'
            ? `$${totalPrice.toFixed(2)}`
            : `${totalPoint} ${t('mall.point')}`}
        </Text>
        <TouchableOpacity
          disabled={busy || (payMethod === 'points' && !enough)}
          onPress={confirm}
          style={[payBtn(colors), (busy || (payMethod === 'points' && !enough)) && {opacity: 0.5}]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{color: '#fff', fontWeight: '700'}}>
              {payMethod === 'usd' ? t('mall.payUsd') : t('mall.payNow')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sectionTitle = {fontWeight: '700' as const, fontSize: 15};
const deliveryChip = (colors: any): any => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  marginRight: spacing.sm,
});
const payBtn = (colors: any): any => ({
  backgroundColor: colors.primary,
  borderRadius: 22,
  height: 44,
  paddingHorizontal: spacing.xl,
  alignItems: 'center',
  justifyContent: 'center',
});
