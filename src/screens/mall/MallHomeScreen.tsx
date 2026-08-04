import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {fetchProducts} from '@/services/mallService';
import {MallProduct} from '@/types/mall';
import {usePointsStore, selectPointsStats} from '@/store/usePointsStore';
import {useSettingsStore} from '@/store/useSettingsStore';
import {useTheme} from '@/theme/ThemeProvider';
import {t} from '@/i18n';
import {spacing, typography} from '@/theme/theme';
import {Card} from '@/components/common';

export default function MallHomeScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<MallProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<string>('all');

  const balance = usePointsStore(s => selectPointsStats(s).balance);
  const cityId = useSettingsStore(s => s.cityId);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.merchantName));
    return ['all', ...Array.from(set)];
  }, [products]);

  const list = useMemo(
    () => (category === 'all' ? products : products.filter(p => p.merchantName === category)),
    [products, category],
  );

  const load = useCallback(async () => {
    try {
      const data = await fetchProducts(cityId);
      setProducts(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cityId]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (p: MallProduct) =>
    navigation.navigate('MallProductDetail', {product: p});

  const renderItem = ({item}: {item: MallProduct}) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => openDetail(item)}
      style={{width: '48.5%', marginBottom: spacing.md}}>
      <Card style={{padding: spacing.sm}}>
        <Image
          source={{uri: item.image}}
          style={{width: '100%', height: 150, borderRadius: 12, backgroundColor: colors.border}}
        />
        <Text
          numberOfLines={2}
          style={{
            marginTop: spacing.sm,
            color: colors.text,
            fontSize: typography.body,
            fontWeight: '600',
          }}>
          {item.title}
        </Text>
        <View style={{flexDirection: 'row', alignItems: 'baseline', marginTop: 6}}>
          <Text style={{color: colors.primary, fontSize: 16, fontWeight: '800'}}>
            {item.point}
          </Text>
          <Text style={{color: colors.textSub, fontSize: 12, marginLeft: 4}}>
            {t('mall.point')}
          </Text>
          {typeof item.priceUsd === 'number' && item.priceUsd > 0 ? (
            <Text style={{color: colors.text, fontSize: 13, fontWeight: '600', marginLeft: spacing.sm}}>
              ${item.priceUsd.toFixed(2)}
            </Text>
          ) : null}
        </View>
        {/* 支付方式标签 */}
        {item.payMethods && item.payMethods.length > 1 ? (
          <View style={{flexDirection: 'row', marginTop: 4}}>
            {item.payMethods.map((m) => (
              <Text
                key={m}
                style={{
                  fontSize: 11,
                  color: colors.primary,
                  marginRight: 8,
                  fontWeight: '600',
                }}>
                {m === 'points' ? t('mall.pointPay') : t('mall.usdPay')}
              </Text>
            ))}
          </View>
        ) : null}
        <Text
          style={{color: colors.textSub, fontSize: 12, marginTop: 2, textDecorationLine: 'line-through'}}>
          ¥{item.marketPrice}
        </Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      {/* 顶部积分条 */}
      <View
        style={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          backgroundColor: colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View>
          <Text style={{color: '#fff', fontSize: 18, fontWeight: '800'}}>{t('nav.mall')}</Text>
          <Text style={{color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2}}>
            {t('mall.myPoints')}：{balance} {t('mall.point')}
          </Text>
        </View>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MallCart')}
            style={{paddingHorizontal: spacing.md}}>
            <Text style={{color: '#fff', fontSize: 14}}>{t('mall.cart')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('MallOrders')}>
            <Text style={{color: '#fff', fontSize: 14}}>{t('mall.myOrders')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 分类 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: spacing.lg, paddingVertical: spacing.md}}>
        {categories.map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => setCategory(c)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: 16,
              marginRight: spacing.sm,
              backgroundColor: category === c ? colors.primary : colors.card,
            }}>
            <Text
              style={{
                color: category === c ? '#fff' : colors.textSub,
                fontSize: 13,
                fontWeight: '600',
              }}>
              {c === 'all' ? t('mall.all') : c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{justifyContent: 'space-between'}}
          contentContainerStyle={{paddingHorizontal: spacing.lg, paddingBottom: spacing.xl}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={{textAlign: 'center', color: colors.textSub, marginTop: 40}}>
              {t('mall.empty')}
            </Text>
          }
        />
      )}
    </View>
  );
}
