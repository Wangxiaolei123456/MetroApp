import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {fallbackImage, fetchProducts} from '@/services/mallService';
import {MallProduct} from '@/types/mall';
import {usePointsStore, selectPointsStats} from '@/store/usePointsStore';
import {useSettingsStore} from '@/store/useSettingsStore';
import {useTheme} from '@/theme/ThemeProvider';
import {t} from '@/i18n';
import {radius, spacing, typography} from '@/theme/theme';
import {Card} from '@/components/common';

const CATEGORY_LABELS: Record<string, string> = {
  all: '',
};

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

      {/* 分类标签（扁平横排，避免被 ScrollView horizontal 拉伸） */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
        }}>
        {categories.map(c => {
          const active = category === c;
          const label = CATEGORY_LABELS[c] ?? c;
          return (
            <TouchableOpacity
              key={c}
              activeOpacity={0.85}
              onPress={() => setCategory(c)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? colors.primary : colors.card,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                alignSelf: 'flex-start',
              }}>
              <Text
                style={{
                  color: active ? '#fff' : colors.textSub,
                  fontSize: 13,
                  fontWeight: '600',
                }}>
                {c === 'all' ? t('mall.all') : label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 商品列表 */}
      {loading ? (
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          renderItem={({item}) => (
            <ProductCard
              item={item}
              colors={colors}
              onPress={() => openDetail(item)}
            />
          )}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{justifyContent: 'space-between'}}
          contentContainerStyle={{paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl}}
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

/* ----------- 商品卡片 ----------- */
function ProductCard({
  item,
  colors,
  onPress,
}: {
  item: MallProduct;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
}) {
  const [imgSrc, setImgSrc] = useState<string>(item.image);
  const [errored, setErrored] = useState<boolean>(false);

  // 商品更新或 image 变化时重置
  useEffect(() => {
    setImgSrc(item.image);
    setErrored(false);
  }, [item.id, item.image]);

  const hasUsd = typeof item.priceUsd === 'number' && item.priceUsd > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{width: '48.5%', marginBottom: spacing.md}}>
      <Card style={{padding: spacing.sm, overflow: 'hidden'}}>
        {/* 图片区：固定 1:1 方形，背景兜底 */}
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: radius.md,
            backgroundColor: colors.border,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {!errored && imgSrc ? (
            <Image
              source={{uri: imgSrc}}
              style={{width: '100%', height: '100%'}}
              resizeMode="cover"
              onError={() => {
                if (!errored) {
                  setErrored(true);
                  setImgSrc(fallbackImage(item.id));
                }
              }}
            />
          ) : (
            <Text style={{fontSize: 36}}>{emojiFor(item.id)}</Text>
          )}
        </View>

        {/* 标题 */}
        <Text
          numberOfLines={2}
          style={{
            marginTop: spacing.sm,
            color: colors.text,
            fontSize: typography.h2,
            fontWeight: '600',
            minHeight: typography.h2 * 2 + 4,
            lineHeight: typography.h2 + 2,
          }}>
          {item.title}
        </Text>

        {/* 价格行：积分价 + USD 价 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            marginTop: spacing.xs,
            flexWrap: 'wrap',
          }}>
          <Text style={{color: colors.primary, fontSize: 18, fontWeight: '800'}}>
            {item.point}
          </Text>
          <Text style={{color: colors.textSub, fontSize: 12, marginLeft: 4}}>
            {t('mall.point')}
          </Text>
          {hasUsd ? (
            <Text
              style={{
                color: colors.text,
                fontSize: 13,
                fontWeight: '600',
                marginLeft: spacing.sm,
              }}>
              ${item.priceUsd.toFixed(2)}
            </Text>
          ) : null}
        </View>

        {/* 支付方式 + 市场价（小字一行） */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 6,
          }}>
          <View style={{flexDirection: 'row', flexShrink: 1, flexWrap: 'wrap'}}>
            {(item.payMethods ?? ['points']).map(m => (
              <Text
                key={m}
                style={{
                  fontSize: 11,
                  color: m === 'points' ? colors.primary : colors.accent,
                  marginRight: 6,
                  fontWeight: '600',
                }}>
                {m === 'points' ? t('mall.pointPay') : t('mall.usdPay')}
              </Text>
            ))}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

/* 商品缺图时的 emoji 占位（稳定按 id 取） */
const EMOJI_POOL = ['🎫', '☕', '🚇', '🎁', '🎧', '🛍️', '🎟️', '💳', '🥤', '📱'];
function emojiFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EMOJI_POOL[h % EMOJI_POOL.length];
}