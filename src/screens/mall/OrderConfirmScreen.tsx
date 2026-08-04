import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {
  createBackendOrder,
  createOrder,
  getBackendOrder,
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
  // USD 收银台：内嵌 WebView 打开的收银台地址（非空时全屏展示 WebView）
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // USD 收银台跳转后，记录后端订单 id，用于回前台时轮询支付状态
  const pendingOrderId = useRef<string | null>(null);
  const pollingRef = useRef(false);
  // 轮询终止信号：组件卸载或订单终态时停止循环
  const stopPollingRef = useRef(false);

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

  // USD 收银台回跳后，循环轮询后端订单状态（后端主动查 Uptick 同步，不依赖回调）。
  // 最多轮询 MAX_POLL 次、间隔 POLL_INTERVAL_MS；paid/cancelled 即停止并跳转结果页。
  const POLL_INTERVAL_MS = 3000;
  const MAX_POLL = 6;
  const pollBackendOrder = useCallback(async (orderId: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    stopPollingRef.current = false;
    try {
      for (let i = 0; i < MAX_POLL; i++) {
        if (stopPollingRef.current) break;
        const o = await getBackendOrder(orderId);
        if (o.status === 'paid') {
          pendingOrderId.current = null;
          navigation.replace('MallOrderResult', {order: buildOrder(o.id, 'paid'), payMethod: 'usd'});
          return;
        }
        if (o.status === 'cancelled') {
          pendingOrderId.current = null;
          navigation.replace('MallOrderResult', {order: buildOrder(o.id, 'cancelled'), payMethod: 'usd', payCancelled: true});
          return;
        }
        // 仍处理中：等待后重试（末次不再 sleep）
        if (i < MAX_POLL - 1) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }
      }
      // 轮询结束仍未确认：进入待支付结果页，用户可去订单列表手动刷新（订单页也会再查 Uptick）。
      pendingOrderId.current = null;
      navigation.replace('MallOrderResult', {order: buildOrder(orderId, 'unpaid'), payMethod: 'usd'});
    } catch {
      // 轮询失败：进入待支付结果页，由用户在订单列表重试
      pendingOrderId.current = null;
      navigation.replace('MallOrderResult', {order: buildOrder(orderId, 'unpaid'), payMethod: 'usd'});
    } finally {
      pollingRef.current = false;
    }
  }, [navigation]);

  // 从收银台返回 App（或页面重新聚焦）时，检查待支付订单状态
  useFocusEffect(
    useCallback(() => {
      if (pendingOrderId.current) {
        pollBackendOrder(pendingOrderId.current);
      }
      // 页面失焦/卸载时停止轮询循环，避免后台无谓请求与导航后跳转
      return () => {
        stopPollingRef.current = true;
      };
    }, [pollBackendOrder]),
  );

  const confirm = async () => {
    if (busy) return;
    if (payMethod === 'points' && !enough) return;
    setBusy(true);
    try {
      if (payMethod === 'usd') {
        // USD 支付：创建后端订单（后端调用 Uptick 生成收银台支付单），拿到 upCheckoutUrl 后跳转。
        setStage(t('mall.stageUsd'));
        const productId = String(p?.id ?? '');
        if (!productId) throw new Error('缺少商品信息');
        const created = await createBackendOrder({
          productId,
          payMethod: 'usd',
          quantity: p ? (params.qty ?? 1) : items.reduce((s, i) => s + i.qty, 0),
          // 必须用 https：自定义 scheme 会被 Stripe/Uptick 忽略并落到 example.com。
          // WebView 拦截 example.com /pay/result 后关闭并轮询，用户看不到该页。
          returnUrl: 'https://example.com/metro/pay/result',
        });
        if (!created.upCheckoutUrl) {
          // 后端未返回收银台地址（如 Uptick 暂不可用）：进入待支付结果页，由用户在订单页重试。
          navigation.replace('MallOrderResult', {order: buildOrder(created.id, 'unpaid'), payMethod: 'usd'});
          return;
        }
        // 跳转 Uptick 收银台：内嵌 WebView；付完回跳 https 占位页 → 拦截关闭 → 轮询订单。
        pendingOrderId.current = created.id;
        setCheckoutUrl(created.upCheckoutUrl);
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

  // 关闭内嵌收银台 WebView，并主动查一次订单最新状态
  const closingCheckoutRef = useRef(false);
  const closeCheckout = useCallback(() => {
    if (closingCheckoutRef.current) return;
    closingCheckoutRef.current = true;
    setCheckoutUrl(null);
    setCheckoutError(null);
    if (pendingOrderId.current) {
      pollBackendOrder(pendingOrderId.current);
    }
  }, [pollBackendOrder]);

  // 支付完成回跳判断。
  // Stripe/Uptick 要求 https returnUrl；付完常落到 example.com。拦到即关 WebView 并轮询。
  const isPayReturnUrl = useCallback((url?: string | null) => {
    if (!url) return false;
    const raw = url.trim();
    const u = raw.toLowerCase();
    if (u.includes('example.com')) return true;
    if (u.includes('/pay/result') || u.includes('/metro/pay')) return true;
    if (u.startsWith('uptickcardible://')) return true;
    if (u.startsWith('intent://') || u.startsWith('android-app://')) return true;
    if (u.startsWith('about:') || u.startsWith('data:')) return false;
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      if (host === 'example.com' || host.endsWith('.example.com')) return true;
      if (parsed.pathname.toLowerCase().includes('/pay/result')) return true;
    } catch {
      // ignore
    }
    return !u.startsWith('http://') && !u.startsWith('https://');
  }, []);

  // 用 ref 避免 Android WebView 回调拿到过期闭包
  const isPayReturnUrlRef = useRef(isPayReturnUrl);
  isPayReturnUrlRef.current = isPayReturnUrl;
  const closeCheckoutRef = useRef(closeCheckout);
  closeCheckoutRef.current = closeCheckout;

  const handleMaybePayReturn = useCallback((url?: string | null) => {
    if (isPayReturnUrlRef.current(url)) {
      closeCheckoutRef.current();
      return true;
    }
    return false;
  }, []);

  // 收银台打开期间后台查单：仅在 paid/cancelled 时离场（不因超时误关正在支付的页）
  useEffect(() => {
    if (!checkoutUrl) {
      closingCheckoutRef.current = false;
      return;
    }
    const orderId = pendingOrderId.current;
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 60; i++) {
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 2000));
        if (cancelled || closingCheckoutRef.current) return;
        try {
          const o = await getBackendOrder(orderId);
          if (cancelled || closingCheckoutRef.current) return;
          if (o.status === 'paid') {
            closingCheckoutRef.current = true;
            pendingOrderId.current = null;
            setCheckoutUrl(null);
            navigation.replace('MallOrderResult', {order: buildOrder(o.id, 'paid'), payMethod: 'usd'});
            return;
          }
          if (o.status === 'cancelled') {
            closingCheckoutRef.current = true;
            pendingOrderId.current = null;
            setCheckoutUrl(null);
            navigation.replace('MallOrderResult', {
              order: buildOrder(o.id, 'cancelled'),
              payMethod: 'usd',
              payCancelled: true,
            });
            return;
          }
        } catch {
          // 忽略单次失败，继续轮询
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkoutUrl, navigation]);

  const retryCheckout = useCallback(() => {
    setCheckoutError(null);
    closingCheckoutRef.current = false;
    // 通过给 url 加随机 query 的方式强制 WebView 重新加载
    if (checkoutUrl) {
      const u = new URL(checkoutUrl);
      u.searchParams.set('_t', String(Date.now()));
      setCheckoutUrl(u.toString());
    }
  }, [checkoutUrl]);

  // 内嵌 WebView 收银台：全屏覆盖；回跳占位页 / 查单成功后关闭并进结果页
  if (checkoutUrl) {
    return (
      <View style={{flex: 1, backgroundColor: '#fff'}}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
          <Text style={{color: colors.text, fontWeight: '700', fontSize: 15}}>{t('mall.payUsd')}</Text>
          <TouchableOpacity onPress={closeCheckout} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
            <Text style={{color: colors.primary, fontWeight: '600'}}>{t('mall.close')}</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{uri: checkoutUrl}}
          style={{flex: 1}}
          startInLoadingState
          scalesPageToFit
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="compatibility"
          allowFileAccess={false}
          thirdPartyCookiesEnabled
          javaScriptCanOpenWindowsAutomatically
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={req => {
            if (handleMaybePayReturn(req.url)) return false;
            return true;
          }}
          onLoadStart={e => {
            handleMaybePayReturn(e.nativeEvent.url);
          }}
          onLoadEnd={e => {
            handleMaybePayReturn(e.nativeEvent.url);
          }}
          onMessage={e => {
            if (e.nativeEvent.data === 'pay_return') {
              closeCheckoutRef.current();
            }
          }}
          // 页面内再兜一层：落到 example.com /pay/result 立刻通知原生关闭
          injectedJavaScript={`
            (function(){
              try {
                var h = (location.hostname || '').toLowerCase();
                var p = (location.pathname || '').toLowerCase();
                var href = (location.href || '').toLowerCase();
                if (h === 'example.com' || h.indexOf('example.com') >= 0 || p.indexOf('/pay/result') >= 0 || href.indexOf('example.com') >= 0) {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage('pay_return');
                }
              } catch (e) {}
            })();
            true;
          `}
          renderError={() => (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg}}>
              <Text style={{color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6}}>
                {t('mall.checkoutLoadErrorTitle')}
              </Text>
              <Text style={{color: colors.textSub, fontSize: 13, marginBottom: spacing.lg}}>
                {checkoutError || t('mall.checkoutLoadErrorHint')}
              </Text>
              <TouchableOpacity
                onPress={retryCheckout}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: 8,
                  marginBottom: spacing.sm,
                }}>
                <Text style={{color: '#fff', fontWeight: '700'}}>{t('mall.retry')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeCheckout}>
                <Text style={{color: colors.textSub, marginTop: spacing.sm}}>{t('mall.close')}</Text>
              </TouchableOpacity>
            </View>
          )}
          onError={e => {
            const {url, domain, description, code} = e.nativeEvent;
            const desc = String(description || '');
            const looksLikePayReturn =
              isPayReturnUrlRef.current(url) ||
              domain === 'undefined' ||
              desc.includes('ERR_UNKNOWN_URL_SCHEME');
            if (looksLikePayReturn && pendingOrderId.current) {
              closeCheckoutRef.current();
              return;
            }
            setCheckoutError(desc || String(code) || 'load error');
          }}
          onHttpError={e => {
            setCheckoutError(`HTTP ${e.nativeEvent.statusCode}`);
          }}
          onNavigationStateChange={nav => {
            handleMaybePayReturn(nav.url);
          }}
        />
      </View>
    );
  }

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
