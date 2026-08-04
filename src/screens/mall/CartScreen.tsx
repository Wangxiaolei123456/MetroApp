import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {fetchCart, removeCartItem, updateCartQty} from '@/services/mallService';
import {CartGroup, CartGood} from '@/types/mall';
import {useUserStore} from '@/store/useUserStore';
import {useTheme} from '@/theme/ThemeProvider';
import {t} from '@/i18n';
import {spacing} from '@/theme/theme';
import {Card, Empty, ScreenHeader} from '@/components/common';

export default function CartScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const userId = useUserStore(s => s.profile?.id ?? 'me');
  const [groups, setGroups] = useState<CartGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const data = await fetchCart(userId);
    setGroups(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (g: CartGroup, good: CartGood) => {
    setGroups(prev =>
      prev.map(pg =>
        pg.merchantID !== g.merchantID
          ? pg
          : {
              ...pg,
              goods: pg.goods.map(gd =>
                gd.shopCartID === good.shopCartID ? {...gd, selected: !gd.selected} : gd,
              ),
            },
      ),
    );
  };

  const changeQty = async (good: CartGood, delta: number) => {
    const next = Math.max(1, Math.min(good.maxNum, good.num + delta));
    if (next === good.num) return;
    setBusyId(good.shopCartID);
    try {
      const data = await updateCartQty(userId, good.shopCartID, next);
      setGroups(data);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (good: CartGood) => {
    setBusyId(good.shopCartID);
    try {
      const data = await removeCartItem(userId, good.shopCartID);
      setGroups(data);
    } finally {
      setBusyId(null);
    }
  };

  const selected = groups.flatMap(g => g.goods).filter(g => g.selected);
  const totalPoint = selected.reduce((s, g) => s + g.point * g.num, 0);
  const totalPrice = selected.reduce((s, g) => s + g.price * g.num, 0);

  const checkout = (g: CartGroup) => {
    const items = g.goods.filter(x => x.selected);
    if (!items.length) return;
    navigation.navigate('MallOrderConfirm', {group: g, items, fromCart: true});
  };

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('mall.cart')} />

      {loading ? (
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <Empty text={t('mall.emptyCart')} />
      ) : (
        <ScrollView contentContainerStyle={{padding: spacing.lg, paddingBottom: 120}}>
          {groups.map(g => (
            <View key={g.merchantID} style={{marginBottom: spacing.lg}}>
              <Text style={{color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: spacing.sm}}>
                {g.merchantName}
              </Text>
              {g.goods.map(good => (
                <Card key={good.shopCartID} style={{padding: spacing.sm, marginBottom: spacing.sm, flexDirection: 'row'}}>
                  <TouchableOpacity onPress={() => toggle(g, good)} style={{marginRight: spacing.sm, justifyContent: 'center'}}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: good.selected ? colors.primary : colors.border,
                        backgroundColor: good.selected ? colors.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {good.selected ? <Text style={{color: '#fff', fontSize: 12}}>✓</Text> : null}
                    </View>
                  </TouchableOpacity>
                  <Image
                    source={{uri: good.logoUrl}}
                    style={{width: 64, height: 64, borderRadius: 10, backgroundColor: colors.border}}
                  />
                  <View style={{flex: 1, marginLeft: spacing.sm}}>
                    <Text numberOfLines={2} style={{color: colors.text, fontWeight: '600'}}>
                      {good.title}
                    </Text>
                    <View style={{flexDirection: 'row', alignItems: 'baseline', marginTop: 4}}>
                      <Text style={{color: colors.primary, fontWeight: '800'}}>{good.point}</Text>
                      <Text style={{color: colors.textSub, fontSize: 11, marginLeft: 4}}>{t('mall.point')}</Text>
                    </View>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between'}}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <TouchableOpacity
                          disabled={busyId === good.shopCartID}
                          onPress={() => changeQty(good, -1)}
                          style={stepBtn(colors)}>
                          <Text style={stepTxt(colors)}>−</Text>
                        </TouchableOpacity>
                        <Text style={{width: 32, textAlign: 'center', color: colors.text, fontWeight: '700'}}>
                          {good.num}
                        </Text>
                        <TouchableOpacity
                          disabled={busyId === good.shopCartID || good.num >= good.maxNum}
                          onPress={() => changeQty(good, 1)}
                          style={stepBtn(colors)}>
                          <Text style={stepTxt(colors)}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => remove(good)}>
                        <Text style={{color: colors.textSub, fontSize: 12}}>{t('mall.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))}
              <TouchableOpacity onPress={() => checkout(g)} style={checkoutBtn(colors)}>
                <Text style={{color: '#fff', fontWeight: '700'}}>
                  {t('mall.checkout')} ({g.goods.filter(x => x.selected).reduce((s, x) => s + x.num, 0)})
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* 合计栏 */}
      {selected.length > 0 && (
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
          <View>
            <Text style={{color: colors.text, fontWeight: '800', fontSize: 16}}>
              {totalPoint} {t('mall.point')}
            </Text>
            {totalPrice > 0 ? (
              <Text style={{color: colors.textSub, fontSize: 12}}>
                ${totalPrice.toFixed(2)}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => {
              const g = groups.find(gr => gr.goods.some(x => x.selected));
              if (g) checkout(g);
            }}
            style={checkoutBtn(colors)}>
            <Text style={{color: '#fff', fontWeight: '700'}}>{t('mall.checkoutSelected')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const stepBtn = (colors: any): any => ({
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: colors.elevated,
  alignItems: 'center',
  justifyContent: 'center',
});
const stepTxt = (colors: any) => ({color: colors.text, fontSize: 16, fontWeight: '700' as const});
const checkoutBtn = (colors: any): any => ({
  alignSelf: 'flex-end',
  backgroundColor: colors.primary,
  borderRadius: 20,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
});
