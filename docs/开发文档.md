# MetroApp 开发文档

> 版本：v0.1.0 ｜ 更新日期：2026-07-31
> 适用对象：参与 MetroApp 开发的工程师

---

## 1. 快速开始

### 1.1 环境要求
- Node.js ≥ 18
- React Native 0.74 开发环境（iOS: Xcode 15+ / CocoaPods；Android: Android Studio）
- Yarn（项目使用 yarn.lock）

### 1.2 安装与运行
```bash
# 安装依赖
yarn install

# iOS 首次需安装 Pod
cd ios && pod install && cd ..

# 启动 Metro
yarn start

# 运行 iOS / Android
yarn ios
yarn android
```

### 1.3 常用脚本
| 命令 | 说明 |
|---|---|
| `yarn start` | 启动 Metro Bundler |
| `yarn ios` | 运行 iOS 模拟器/真机 |
| `yarn android` | 运行 Android 模拟器/真机 |
| `yarn lint` | ESLint 检查（.ts/.tsx） |
| `yarn typecheck` | TypeScript 类型检查（`tsc --noEmit`） |

### 1.4 路径别名
项目使用 `babel-plugin-module-resolver`，`@/` 映射到 `src/`：
```ts
import {Button} from '@/components/common';
import {useT} from '@/i18n';
import {useTheme} from '@/theme/ThemeProvider';
```
`tsconfig.json` 同步配置了 `paths`，IDE 可正确跳转。

---

## 2. 整体架构

### 2.1 分层
```
┌─────────────────────────────────────┐
│              App.tsx               │  启动入口：初始化 Store + 引导判定 + 导航容器
├─────────────────────────────────────┤
│  navigation/RootNavigator.tsx      │  5 Tab + 3 Stack 路由
├─────────────────────────────────────┤
│         screens/ (15 个屏幕)        │  UI 层，仅消费 Store + 通用组件
├─────────────────────────────────────┤
│  components/  (通用组件 + 全局弹窗)  │  Card / Button / HeroCard / motion / Modal
├─────────────────────────────────────┤
│           store/ (8 个 Store)       │  Zustand 状态管理，持久化到 AsyncStorage
├─────────────────────────────────────┤
│         services/ (13 个服务)       │  纯逻辑层：路线/定位/行程/积分/钱包
├─────────────────────────────────────┤
│  data / config / types / utils /   │  静态数据、配置、类型、工具
└─────────────────────────────────────┘
```

### 2.2 启动流程
`App.tsx` 中并行初始化所有 Store，完成后渲染：

```ts
useEffect(() => {
  (async () => {
    await Promise.all([
      initUser(), initPoints(), initTrip(),
      initWallet(), initSettings(),
    ]);
    setReady(true);
  })();
}, []);
```

- `ready === false`：显示 Loading（深色背景 + ActivityIndicator）
- `ready === true`：
  - `onboarded === false` → 显示 `OnboardingScreen`，完成后 `setOnboarded(true)`
  - `onboarded === true` → `ThemeProvider` 包裹 `NavigationContainer` + `RootNavigator` + 全局弹窗

### 2.3 导航结构
`RootNavigator` 使用 BottomTabs：

| Tab | component | 内部 Stack |
|---|---|---|
| MapTab | MapStackScreen | Map → RoutePlan → StationInfo |
| Trip | TripScreen | — |
| RewardsTab | RewardsTabScreen | RewardsHome → Points/Tasks/Activities/Airdrop/Rank |
| Wallet | WalletScreen | — |
| MeTab | MeStackScreen | Me → Settings/Help |

所有 Stack `headerShown: false`，Tab 图标用 emoji + 选中态圆角背景。Tab 配置集中在 `TABS` 数组，方便增删。

---

## 3. 状态管理（Store）

### 3.1 Store 一览
| Store | 文件 | 职责 |
|---|---|---|
| useUserStore | store/useUserStore.ts | 用户登录态、乘坐统计、邀请码 |
| useSettingsStore | store/useSettingsStore.ts | 通知/隐私/城市/语言/主题/引导标记 |
| useTripStore | store/useTripStore.ts | 活跃行程、历史、到站提醒、结算 |
| usePlanStore | store/usePlanStore.ts | 路线规划结果（供行程页使用） |
| usePointsStore | store/usePointsStore.ts | 积分流水、统计、等级 |
| useWalletStore | store/useWalletStore.ts | 钱包元数据、余额、交易、乘车奖励账本 |
| useTaskStore | store/useTaskStore.ts | 用户任务进度与领取状态 |
| useActivityStore | store/useActivityStore.ts | 活动报名与到店打卡 |

### 3.2 设计约定
- **持久化**：`storage.get/set`（AsyncStorage，JSON 序列化），键名统一在 `STORAGE_KEYS`。
- **敏感数据**：助记词用 `secureStore`（`react-native-encrypted-storage`，iOS Keychain / Android Keystore）。
- **跨 Store 调用**：通过 `OtherStore.getState().action()` / `OtherStore.getState().xxx` 直接读取，避免循环依赖。
- **init 模式**：每个 Store 暴露 `init()`，在 `App.tsx` 并行调用，从持久层恢复状态。

### 3.3 行程结算闭环（核心）
```
TripScreen watchLocation(2.5s)
  → useTripStore.onGps(location)
    → tripEngine.recordGps(trip, location)
      → findEnclosingStation → 进站/离站事件
    → 若 entered === destStationId → finish({auto: true})
  → finish()
    → tripEngine.finalizeTrip(trip)
      → computeSummary（站数/距离/线路）
      → validateTrip（防作弊）
    → pointsEngine.buildTripTransactions（积分流水，30% 锁定）
    → usePointsStore.addTransactions(txs)
    → useUserStore.addRide() / addStops(n)
    → useWalletStore.creditRideTokens(n)  ← 链上发放 UPTICK
    → set({finishResult, finishAuto})
  → TripFinishModal 展示结算
```

---

## 4. 服务层（Services）

### 4.1 服务清单
| 服务 | 文件 | 说明 |
|---|---|---|
| storage | services/storage.ts | AsyncStorage 封装 + EncryptedStorage 加密 |
| location | services/location.ts | GPS 定位：权限、多策略降级、watch |
| geofence | services/geofence.ts | 围栏判定：findEnclosingStation / GeofenceTracker |
| metroRouting | services/metroRouting.ts | 本地 Dijkstra + Yen K-短路多候选路线 |
| googleRouting | services/googleRouting.ts | Google Routes API 公交路线 |
| tripEngine | services/tripEngine.ts | 行程：创建/记录GPS/结算/防作弊 |
| pointsEngine | services/pointsEngine.ts | 积分计算、流水生成、统计聚合 |
| walletService | services/walletService.ts | Cosmos 钱包：创建/导入/签名/转账/发奖 |
| evmWallet | services/evmWallet.ts | EVM 地址派生、余额查询、原生币发奖 |
| bip39Wrapper | services/bip39Wrapper.ts | BIP39 助记词生成/校验（polyfill） |
| authService | services/authService.ts | 登录/游客 |
| airdropService | services/airdropService.ts | 空投资格计算与领取 |
| arrivalAnnounce | services/arrivalAnnounce.ts | 到站提醒构造 |

### 4.2 路线规划（双引擎）
```
RoutePlanScreen
  → planRoutesGoogle(fromStation, toStation, lang)   // 优先 Google Routes API
    成功 → 返回 RouteOption[]（多候选 + 标签）
    失败/无结果 ↓ 降级
  → planRoutes(graph, fromId, toId)                   // 本地 Dijkstra + Yen
    → yenKPaths(graph, from, to, K=4)                 // 4 条不同走向候选
    → labelRoutes()                                    // 打标：推荐/最快/最短/换乘最少/备选
```

- **Google**：`travelMode: TRANSIT`，`computeAlternativeRoutes: true`，限制 SUBWAY/TRAIN/LIGHT_RAIL。
- **本地**：站点 + 线路建邻接图，边权按 `CostMode`（balanced/time/distance/transfers）赋值，Yen 算法生成 K 短路。
- **标签策略**：第 0 条固定 `recommended`，其余仅当严格优于推荐时才打 `fast/short/fewTransfers`。

### 4.3 定位策略
- `getCurrentLocation(opts?)`：优先 GPS（`enableHighAccuracy`），超时降级网络/Wi-Fi（`balanced`）。
  - `opts.fresh`：禁用缓存（模拟器改点、手动重新定位）。
  - Android：`forceLocationManager: true` 绕过 Google Fused（国内机更稳）。
- `watchLocation(onUpdate, onError?)`：`distanceFilter: 0`，`interval: 1000ms`，`fastestInterval: 500ms`。
- `LOCATION_MOCK`：沙箱模式沿线路摆动模拟轨迹（开发演示用）。

### 4.4 钱包与链上
- **地址派生**：ETH coin type（`m/44'/60'/0'/0/0`），同一助记词同时产出 EVM `0x...` 与 Cosmos `uptick...` 地址。
- **余额查询**：EVM 走 `eth_getBalance` JSON-RPC；Cosmos 暂未接入浏览器。
- **交易记录**：从 EVM 区块浏览器（Blockscout API）抓取 `txlist`。
- **乘车奖励发放**：`evmWallet.sendEvmNativeReward` 由 treasury 账户签名，向用户 EVM 地址转原生 UPTICK，`tx.wait(1)` 确认。
- **WALLET_MOCK**：`false` 走真实链上；`true` 返回假哈希（演示）。

---

## 5. 主题系统

### 5.1 文件
- `theme/theme.ts`：`darkColors` / `lightColors` / `spacing` / `typography` / `radius` / `makeShadows` / `makeTextStyles`
- `theme/ThemeProvider.tsx`：`ThemeProvider` + `useTheme` + `useThemedStyles`

### 5.2 用法
```tsx
// 组件内
const {colors, shadows, isDark, reduceMotion} = useTheme();

// 按主题重建 StyleSheet
const styles = useThemedStyles((c, isDark) => StyleSheet.create({
  card: {backgroundColor: c.card, ...},
}));
```

### 5.3 主题切换
- `useSettingsStore.colorScheme`：`'system' | 'light' | 'dark'`，默认 `'light'`。
- `resolveScheme(pref, system)`：`system` 模式跟随 `Appearance.getColorScheme()`。
- `Appearance.addChangeListener` 监听系统主题变化，实时切换。
- `StatusBar` 跟随主题切换 `barStyle`。

### 5.4 无障碍
- `AccessibilityInfo.isReduceMotionEnabled()` → `reduceMotion`。
- 所有动画组件在 `reduceMotion === true` 时跳过循环动画，仅保留静态状态。

---

## 6. 国际化（i18n）

- 文件：`i18n/index.ts`
- 导出：`useT()`（Hook，返回 `t` 函数）、`t`（非 Hook 场景）、`SUPPORTED_LANGS`
- 语言：`zh`（默认）/ `en`
- 翻译键为扁平结构：`'nav.map'`、`'onboarding.p1Title'`、`'svc.loc.timeout'` 等
- 插值：`t('common.stops', {n: 5})` → `"5 站"`
- 类型：`TKey` 由 `zh` 的 key 自动推导，缺失键编译报错

### 6.1 新增翻译键
```ts
// i18n/index.ts
const zh = {
  // ...
  'feature.newTitle': '新功能',
  'feature.newBody': '描述...',
};
const en: Record<TKey, string> = {
  // ...
  'feature.newTitle': 'New Feature',
  'feature.newBody': 'Description...',
};
```
`en` 必须覆盖所有 `zh` 的 key，否则 `tsc` 报错。

---

## 7. 通用组件

文件：`components/common.tsx`

| 组件 | 用途 | 关键 props |
|---|---|---|
| `ScreenHeader` | 页面头部（带返回） | `title`、`subtitle?`、`right?` |
| `Card` | 普通卡片 | `children`、`onPress?` |
| `HeroCard` | 渐变大号卡片（积分/钱包余额） | `color?` |
| `SectionTitle` | 区块标题 | `children`、`right?` |
| `Button` | 主按钮 | `variant: primary/go/ghost/danger/soft`、`size: md/sm` |
| `Row` | 键值行 | `label`、`value` |
| `ListItem` | 列表项（图标+标题+副标题+箭头） | `icon`、`label`、`sub?`、`onPress` |
| `IconBubble` | 图标圆角底座 | `icon`、`color?`、`size?` |
| `ProgressBar` | 带动画进度条 | `pct`、`color?`、`height?` |
| `Stat` | 数字+标签指标 | `value`、`label`、`animate?` |
| `Empty` | 空态 | `text`、`icon?` |
| `Chip` | 小标签 | `text`、`color?` |

动画组件：`components/motion.tsx` → `AnimatedProgressBar`、`CrossfadeNumber`
特效：`components/FireworksBurst.tsx` → 结算烟花

---

## 8. 数据层

### 8.1 地铁数据
- 文件：`data/metroData.ts`（自动生成，勿手改；重生成见 `scripts/build-metro.mjs`）
- 城市图：`CITIES: Record<string, MetroGraph>`，键 `demo`(上海)、`hk`(香港)
- 入口：`getCityGraph(cityId)`、`DEFAULT_CITY_ID`、`SUPPORTED_CITIES`
- 站点坐标为真实 WGS-84，`segmentDistances` 由 `fillDistances` 用 haversine 自动计算
- 换乘站：`isTransfer = lineIds.length > 1`

### 8.2 Mock 数据
- 文件：`data/mockData.ts`
- 内容：`TASK_DEFS`（任务定义）、`USER_LEVELS`（等级表）、`ACTIVITIES`（活动样本）、`AIRDROPS`（空投规则）、`RANK_SAMPLE`（排行榜样本）

### 8.3 配置
- 文件：`config/app.ts`
- `APP_CONFIG`：积分规则、防作弊阈值、链环境、乘车奖励、treasury 密钥
- `GOOGLE_MAPS_CONFIG`：Routes API Key、endpoint、超时
- `UPTICK_CONFIG`：测试网/主网链参数（chainId、RPC、denom、explorer、EVM）

---

## 9. 类型定义

文件：`types/index.ts`，按需求模块分组（A-H）：

| 模块 | 核心类型 |
|---|---|
| A 地图导航 | `GeoPoint`、`City`、`Station`、`MetroLine`、`MetroGraph`、`RouteLeg`、`RoutePlan`、`RouteOption`、`RouteTag` |
| B 行程打卡 | `Trip`、`TripStationPass`、`StationAlert`、`TripSummary`、`TripStatus` |
| C 积分 | `PointsTransaction`、`PointsStats`、`UserLevel`、`Badge`、`PointsSource` |
| D 钱包 | `WalletAccount`、`TokenBalance`、`NftAsset`、`ChainTx`、`ChainEnv` |
| E 活动任务 | `Activity`、`TaskDef`、`UserTask`、`ActivityType`、`TaskType` |
| F 空投 | `AirdropRule`、`Invite`、`RankItem` |
| G 用户设置 | `UserProfile`、`AuthProvider`、`NotificationSettings`、`PrivacySettings` |

---

## 10. 开发规范

### 10.1 新增屏幕
1. 在 `src/screens/` 新建 `XxxScreen.tsx`，导出命名组件。
2. 在 `RootNavigator.tsx` 对应 Stack 注册 `<XxxStack.Screen name="Xxx" component={XxxScreen} />`。
3. 跳转：`navigation.navigate('Xxx', {params})`。
4. 若需要全局弹窗，在 `App.tsx` 的 `NavigationContainer` 同级挂载。

### 10.2 新增 Store
```ts
import {create} from 'zustand';
import {storage, STORAGE_KEYS} from '@/services/storage';

interface FooState {
  bar: string;
  init: () => Promise<void>;
  setBar: (v: string) => Promise<void>;
}

export const useFooStore = create<FooState>((set, get) => ({
  bar: '',
  async init() {
    const v = await storage.get<string>(STORAGE_KEYS.foo);
    set({bar: v ?? ''});
  },
  async setBar(v) {
    set({bar: v});
    await storage.set(STORAGE_KEYS.foo, v);
  },
}));
```
- 在 `App.tsx` 的 `Promise.all` 中加入 `initFoo()`。
- 在 `STORAGE_KEYS` 中新增键名。

### 10.3 样式约定
- 间距用 `spacing.*`，字号用 `typography.*`，圆角用 `radius.*`。
- 颜色一律从 `useTheme().colors` 取，禁止硬编码。
- 动态样式用 `useThemedStyles(factory)`，factory 应为模块级函数以保持引用稳定。

### 10.4 动画
- 优先 `Animated` + `useNativeDriver: true`。
- 循环动画必须检查 `reduceMotion`，为 true 时跳过。
- 入场动画用 `Animated.spring` / `Animated.timing`，`Easing` 控制曲线。

### 10.5 提交前检查
```bash
yarn typecheck   # tsc --noEmit
yarn lint        # eslint
```
两项均通过后再提交。

---

## 11. 常见问题

### Q: iOS EncryptedStorage 不生效？
A: 执行 `cd ios && pod install` 后重新构建。未链接时会自动回退 AsyncStorage（仅开发/演示）。

### Q: 模拟器定位不更新？
A: `getCurrentLocation({fresh: true})` 禁用缓存；或开启 `LOCATION_MOCK = true` 模拟轨迹。

### Q: Google Routes API 报错？
A: 检查 `GOOGLE_MAPS_CONFIG.apiKey`；网络不通时会自动降级到本地 Dijkstra/Yen。

### Q: 钱包余额显示 0？
A: EVM 余额走真实 JSON-RPC，确认 `UPTICK_CONFIG[env].evmRpc` 可达；无网时返回 `'0'`。

### Q: 新增城市？
A: 在 `data/metroData.ts` 添加 `City` + `Station[]` + `MetroLine[]`，注册到 `CITIES`，并在 `SUPPORTED_CITIES` 加条目。
