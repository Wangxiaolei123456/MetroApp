import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {addToCart, fallbackImage} from '@/services/mallService';
import {MallProduct} from '@/types/mall';
import {usePointsStore, selectPointsStats} from '@/store/usePointsStore';
import {useUserStore} from '@/store/useUserStore';
import {useTheme} from '@/theme/ThemeProvider';
import {t} from '@/i18n';
import {spacing} from '@/theme/theme';
import {Card, ScreenHeader} from '@/components/common';

const DELIVERY_LABEL: Record<number, string> = {
  1: 'mall.deliveryDelivery',
  2: 'mall.deliveryPickup',
  3: 'mall.deliveryBoth',
};

export default function ProductDetailScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const product: MallProduct = route.params.product;
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [imgSrc, setImgSrc] = useState<string>(product.image);
  const [imgErrored, setImgErrored] = useState<boolean>(false);

  useEffect(() => {
    setImgSrc(product.image);
    setImgErrored(false);
  }, [product.id, product.image]);

  const userId = useUserStore(s => s.profile?.id ?? 'me');
  const balance = usePointsStore(s => selectPointsStats(s).balance);
  const needPoint = product.point * qty;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  };

  const doAdd = async () => {
    setBusy(true);
    try {
      await addToCart(userId, product, qty);
      flash(t('mall.addedToCart'));
    } finally {
      setBusy(false);
    }
  };

  const doBuy = () => {
    if (needPoint > balance) {
      flash(t('mall.pointNotEnough'));
      return;
    }
    navigation.navigate('MallOrderConfirm', {product, qty, fromCart: false, payMethods: product.payMethods});
  };

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('mall.productDetail')} />
      <ScrollView contentContainerStyle={{paddingBottom: 100}}>
        <View
          style={{
            width: '100%',
            height: 280,
            backgroundColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {!imgErrored && imgSrc ? (
            <Image
              source={{uri: imgSrc}}
              style={{width: '100%', height: '100%'}}
              resizeMode="cover"
              onError={() => {
                if (!imgErrored) {
                  setImgErrored(true);
                  setImgSrc(fallbackImage(product.id));
                }
              }}
            />
          ) : (
            <Text style={{fontSize: 72}}>{emojiFor(product.id)}</Text>
          )}
        </View>
        <View style={{padding: spacing.lg}}>
          <Text style={{color: colors.text, fontSize: 20, fontWeight: '800'}}>
            {product.title}
          </Text>
          <View style={{flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm}}>
            <Text style={{color: colors.primary, fontSize: 26, fontWeight: '800'}}>
              {product.point}
            </Text>
            <Text style={{color: colors.textSub, fontSize: 13, marginLeft: 6}}>
              {t('mall.point')}
            </Text>
            {typeof product.priceUsd === 'number' && product.priceUsd > 0 ? (
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14,
                  marginLeft: spacing.md,
                  fontWeight: '600',
                }}>
                ${product.priceUsd.toFixed(2)}
              </Text>
            ) : null}
          </View>

          {/* 支付方式标签 */}
          {product.payMethods && product.payMethods.length ? (
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm}}>
              <Text style={{color: colors.textSub, fontSize: 13, marginRight: 8}}>{t('mall.payMethod')}</Text>
              {product.payMethods.map((m) => (
                <View
                  key={m}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12,
                    marginRight: 8,
                    backgroundColor: m === 'usd' ? colors.primary + '22' : colors.primary + '18',
                  }}>
                  <Text style={{color: colors.primary, fontSize: 12, fontWeight: '600'}}>
                    {m === 'points' ? t('mall.pointPay') : t('mall.usdPay')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Card style={{marginTop: spacing.md, padding: spacing.md}}>
            <Row label={t('mall.price')} value={`$${product.price.toFixed(2)}`} />
            <Row label={t('mall.sales')} value={String(product.sales)} />
            <Row label={t('mall.stock')} value={String(product.stock)} />
            <Row label={t('mall.delivery')} value={t(DELIVERY_LABEL[product.delivery] as any)} />
            <Row label={t('mall.merchant')} value={product.merchantName} />
          </Card>

          {product.desc ? (
            <Text style={{color: colors.textSub, fontSize: 14, marginTop: spacing.md, lineHeight: 22}}>
              {product.desc}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          paddingBottom: insets.bottom + spacing.sm,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginRight: spacing.md}}>
          <TouchableOpacity
            disabled={qty <= 1}
            onPress={() => setQty(q => Math.max(1, q - 1))}
            style={stepperBtn(colors)}>
            <Text style={stepperText(colors)}>−</Text>
          </TouchableOpacity>
          <Text style={{width: 36, textAlign: 'center', color: colors.text, fontWeight: '700'}}>
            {qty}
          </Text>
          <TouchableOpacity
            disabled={qty >= product.maxNum}
            onPress={() => setQty(q => Math.min(product.maxNum, q + 1))}
            style={stepperBtn(colors)}>
            <Text style={stepperText(colors)}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          disabled={busy}
          onPress={doAdd}
          style={[actionBtn(colors, false), {flex: 1}]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={actionText}>{t('mall.addToCart')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={doBuy} style={[actionBtn(colors, true), {flex: 1, marginLeft: spacing.sm}]}>
          <Text style={actionText}>{t('mall.buyNow')}</Text>
        </TouchableOpacity>
      </View>

      {toast ? (
        <View
          style={{
            position: 'absolute',
            bottom: 120,
            alignSelf: 'center',
            backgroundColor: 'rgba(0,0,0,0.8)',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: 20,
          }}>
          <Text style={{color: '#fff', fontSize: 13}}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Row({label, value}: {label: string; value: string}) {
  const theme = useTheme();
  const colors = theme.colors;
  return (
    <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8}}>
      <Text style={{color: colors.textSub, fontSize: 14}}>{label}</Text>
      <Text style={{color: colors.text, fontSize: 14, fontWeight: '600'}}>{value}</Text>
    </View>
  );
}

const stepperBtn = (colors: any): any => ({
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: colors.elevated,
  alignItems: 'center',
  justifyContent: 'center',
});
const stepperText = (colors: any) => ({fontSize: 18, fontWeight: '700' as const, color: colors.text});
const actionBtn = (colors: any, primary: boolean): any => ({
  backgroundColor: primary ? colors.primary : colors.elevated,
  borderRadius: 22,
  height: 44,
  alignItems: 'center',
  justifyContent: 'center',
});
const actionText = {color: '#fff', fontSize: 15, fontWeight: '700' as const};

const EMOJI_POOL = ['🎫', '☕', '🚇', '🎁', '🎧', '🛍️', '🎟️', '💳', '🥤', '📱'];
function emojiFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EMOJI_POOL[h % EMOJI_POOL.length];
}
