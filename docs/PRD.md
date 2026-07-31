# MetroApp 产品需求文档（PRD）

> 版本：v0.1.0 ｜ 更新日期：2026-07-31
> 状态：基于当前代码实现整理，反映已落地功能

---

## 1. 产品概述

### 1.1 产品定位
MetroApp 是一款基于 **Uptick Origin 链** 的地铁出行激励应用，通过「乘地铁 → 链上打卡 → 获得积分与代币」的闭环，将日常通勤转化为可量化的链上资产与权益。

### 1.2 目标用户
- 日常地铁通勤用户（上海 / 香港首期）
- Web3 钱包用户 / Uptick 生态参与者
- 关注绿色出行、希望获得出行奖励的用户

### 1.3 核心价值
1. **真实出行激励**：基于 GPS 地理围栏识别真实乘车行为，按站发放积分与 UPTICK 代币。
2. **链上资产自主**：内置非托管钱包，奖励直接发放到用户链上地址。
3. **多维度激励体系**：积分 + 任务 + 活动 + 空投 + 排行榜，覆盖短期与长期留存。

---

## 2. 技术架构

### 2.1 技术栈
| 层 | 选型 |
|---|---|
| 框架 | React Native 0.74 + TypeScript 5.4 |
| 状态管理 | Zustand 4 |
| 导航 | React Navigation 6（BottomTabs + NativeStack） |
| 地图 | react-native-maps 1.14 |
| 存储 | AsyncStorage / EncryptedStorage（密钥加密） |
| 链交互 | ethers 6（EVM）、@cosmjs/stargate（Cosmos） |
| 国际化 | 自研 i18n（中/英双语） |

### 2.2 项目结构
```
src/
├── components/      # 通用组件与全局弹窗
├── config/          # 应用配置（积分规则、链参数、防作弊、Google API）
├── data/            # 地铁全网数据（上海/香港真实站点坐标）+ Mock 数据
├── i18n/            # 中英文翻译
├── navigation/      # 根导航（5 Tab + 多 Stack）
├── screens/         # 15 个屏幕
├── services/        # 业务服务（钱包、定位、路线、积分引擎等）
├── store/           # 8 个 Zustand Store
├── theme/           # 主题系统（深色/浅色 + 跟随系统）
├── types/           # 全局类型定义
└── utils/           # 地理计算工具
```

### 2.3 导航结构
5 个一级 Tab：

| Tab | Stack | 可达屏幕 |
|---|---|---|
| 地图 🗺 | MapStack | Map → RoutePlan → StationInfo |
| 行程 🚇 | — | TripScreen |
| 奖励 🎁 | RewardsStack | RewardsHome → Points / Tasks / Activities / Airdrop / Rank |
| 钱包 👛 | — | WalletScreen |
| 我的 👤 | MeStack | Me → Settings / Help |

- 全局弹窗：`StationAlertModal`（到站/换乘提醒）、`TripFinishModal`（行程结算）
- 首次启动未完成引导时展示 `OnboardingScreen`

---

## 3. 功能需求

### 3.1 首次体验与引导（Onboarding）
- **三步引导页**，左右滑动切换（`Animated.ScrollView` + `pagingEnabled`）
- 科技感视觉：网格背景、漂浮粒子、扫描线、3D 全息徽章（轨道环 + 六边形底座）
- 每页：全息徽章图标 + 标题 + 正文（无步骤编号文字）
- 底部：分段能量条进度指示器 + 「下一步」/「开始」按钮（最后一页为霓虹脉冲发光按钮）
- 顶部「跳过」直接完成
- 完成后持久化 `onboarded` 标记，不再展示

### 3.2 地图与导航（Map）

#### 3.2.1 地图主页
- 渲染当前城市地铁 MapView（深色主题自定义样式）
- 实时定位用户位置，判断是否处于站点围栏内
- 底部状态卡片：站内/站外、最近站名与距离
- 入口：规划路线、开始/查看行程
- 有规划路线时地图镜头跟随用户

#### 3.2.2 路线规划
- 起点自动映射到最近站点（`findNearestStation`），支持手动搜索切换
- 终点支持：搜索输入 + 地图点选 + 从车站浏览页回传
- 起终点交换（Swap）
- 选中终点后隐藏输入框与重复建议，显示大字号终点 + 「修改」按钮（避免重复展示）
- **步行导航**：计算到起点站距离、估时，可调起外部地图 App 步行导航
- 路线计算：优先 Google Routes API（多候选），失败降级本地 Dijkstra/Yen 算法
- 多条路线卡片：标签（推荐/最快/最短/换乘最少/备选），选中脉冲发光
- 路线详情时间轴：站点序列 + 换乘标记
- 确认后写入行程计划并跳转行程页

#### 3.2.3 车站浏览
- 两级列表：城市线路 → 选中线路的全部站点
- 点击站点设为终点（跳转路线规划）
- 换乘站标记

### 3.3 行程打卡（Trip）

#### 3.3.1 行程启动
- 无行程时显示开始按钮，可带入规划信息（目的地、途经序列、预估耗时）
- 防作弊开关提示（依据 `APP_CONFIG.antiCheat.enabled`）

#### 3.3.2 实时记录
- GPS 实时定位（`watchLocation`，2.5s 轮询）
- 进站识别触发到站提醒（`notifyStationAlert`）
- 已途经站列表（有效/异常状态标记）
- 进度条基于规划路线计算
- 进度条下方提示「到达终点站将自动结束」

#### 3.3.3 自动结算
- **到达终点站自动检测**：`onGps` 判断 `entered === destStationId` 时自动 `finish({auto: true})`
- 到达终点时清除到站提醒
- 结算弹窗 `TripFinishModal` 展示：站数、距离、时长、积分明细
- 自动结算标注「自动结束」提示
- 历史行程列表：起止站、状态、汇总摘要

### 3.4 积分体系（Points）
- **积分余额**：可用积分（数字滚动动画）、累计、锁定
- **等级系统**：当前等级 → 下一等级、进度条
- **勋章网格**：5 个徽章，基于乘车/钱包状态判断解锁
- **积分明细**：来源标签（乘车/换乘/长途/活动/任务/邀请/新手/兑换）、时间、锁定状态
- **积分规则**（`APP_CONFIG`）：
  - 每站固定积分：10 分
  - 换乘加成：+15 分/次
  - 长途加成：超过 12 站后每站额外 +2 分

### 3.5 Web3 钱包（Wallet）
- **钱包创建**：创建 Uptick 链上钱包（BIP39 助记词）
- **钱包导入**：12 词助记词导入
- **环境切换**：测试网 / 主网
- **资产展示**：EVM 余额、Cosmos/EVM 地址（可复制）
- **代币列表**：EVM/Cosmos 链标签
- **NFT 持仓**列表
- **交易记录**：可跳转区块浏览器
- **乘车奖励说明**：每站 0.01 UPTICK，展示最近发奖结果
- 链上发奖由 treasury 账户向用户 EVM 地址转账（`rewardOnChain: true`）

### 3.6 奖励聚合（Rewards Home）
- 统一入口：积分 / 任务 / 活动 / 空投 / 排行榜
- 底部跳转钱包按钮

### 3.7 任务中心（Tasks）
- 任务类型：每日 / 每周 / 新手
- 任务卡片：类型图标、Chip 标签、描述、奖励、进度条
- 进行中：「模拟进度 +1」按钮
- 已完成：「领取奖励」按钮（写入积分流水）
- 已领取标记

### 3.8 周边活动（Activities）
- 活动卡片：标题、类型（商家/展览/快闪/活动）、关联站点、日期、描述、商家、优惠码、奖励、名额
- **报名**（`enroll`）
- **到店打卡**：获取定位 → 计算到活动点距离 → 围栏内判断 → 发放积分/代币
- 消息反馈：成功 / 距离过远 / 定位失败

### 3.9 空投广场（Airdrop）
- 空投规则展示：每人额度、门槛（积分/站数/活跃天数）、发放进度条
- 资格检查（`checkAll`）：不达标显示原因
- 领取：链上签名 + 广播，展示交易哈希
- 跳转排行榜

### 3.10 排行榜（Rank）
- 两个榜单：乘车站数榜（🚇）、积分榜（🏅）
- 前三名奖牌标记，当前用户行高亮

### 3.11 个人中心（Me）
- 未登录：游客登录 + 手机号登录
- 已登录：头像（首字母）、用户名、登录方式、钱包绑定状态
- 乘坐统计（总程数 / 总站数）
- 邀请码（基于用户 ID 生成）
- 菜单：奖励、设置、帮助
- 退出登录

### 3.12 设置（Settings）
- **外观**：跟随系统 / 深色 / 浅色（默认浅色）
- **语言**：中文 / 英文
- **城市**：上海 / 香港
- **通知**：换乘提醒、活动推送、空投提醒
- **隐私**：定位权限、数据共享
- **关于**：重新查看引导
- 隐私声明

### 3.13 帮助（Help）
- 5 条 FAQ：积分用途、进站识别、私钥安全、防作弊、链接入
- 反馈输入框 + 提交
- 开发者文档入口

---

## 4. 数据模型

### 4.1 城市与地铁数据
- **城市**：上海（id: `demo`，18 条线）、香港（id: `hk`，11 条线）
- 站点坐标为真实 WGS-84 经纬度
- 城市默认围栏半径 600m，站点可单独配置
- 换乘站 `isTransfer` 自动判定（`lineIds.length > 1`）

### 4.2 核心类型（见 `src/types/index.ts`）
- 地理：`GeoPoint`、`City`、`Station`、`MetroLine`、`MetroGraph`
- 导航：`RouteLeg`、`RoutePlan`、`RouteTag`、`RouteOption`
- 行程：`Trip`、`TripStationPass`、`StationAlert`、`TripSummary`、`TripStatus`
- 积分：`PointsTransaction`、`PointsStats`、`UserLevel`、`Badge`、`PointsSource`
- 钱包：`WalletAccount`、`TokenBalance`、`NftAsset`、`ChainTx`、`ChainEnv`
- 活动/任务：`Activity`、`TaskDef`、`UserTask`
- 空投：`AirdropRule`、`Invite`、`RankItem`
- 用户/设置：`UserProfile`、`AuthProvider`、`NotificationSettings`、`PrivacySettings`

---

## 5. 主题与国际化

### 5.1 主题系统
- 三模式：跟随系统 / 深色 / 浅色
- **默认：浅色模式**
- 语义色：primary（#2B5BFF）、go（#00C281）、accent（#00D4C8）、warning/danger/gold/silver/bronze
- `ThemeProvider` 通过 `resolveScheme` 解析，`useThemedStyles` 按主题重建样式
- 支持 `reduceMotion`（无障碍）

### 5.2 国际化
- 双语：中文（默认）/ 英文
- 翻译键覆盖：引导、路线规划、行程、积分、钱包、设置、帮助等

---

## 6. 链上配置

### 6.1 Uptick Origin 链
| 环境 | Chain ID | EVM Chain ID | Symbol | Explorer |
|---|---|---|---|---|
| 测试网 | origin_1170-3 | 1170 | UPTICK | explorer.origin.uptick.network |
| 主网 | uptick_117-1 | 117 | UPTICK | explorer.uptick.network |

### 6.2 乘车奖励
- 每站 0.01 UPTICK，由 treasury 账户链上发放
- `rewardOnChain: true`

### 6.3 防作弊
- 总开关：`enabled: false`（按地铁场景校准，地下丢星不判异常）
- 最大合理速度 50 m/s、超速噪点容忍 25 个、站间最小间隔 20s

---

## 7. 非功能需求

- **性能**：GPS 采样 2.5s 轮询，地图镜头节流跟随
- **安全**：钱包私钥 EncryptedStorage 加密本地存储，绝不上传明文
- **无障碍**：支持 `reduceMotion`，动画可降级
- **可扩展**：城市数据可追加（`CITIES` map），任务/活动可配置化

---

## 8. 已知限制

- Google Routes API Key 硬编码在配置中（生产应迁移至环境变量）
- treasury 密钥在配置中（生产应服务端托管）
- 活动/任务/排行榜数据部分为 Mock
- 防作弊默认关闭（需产品确认阈值后启用）

---

## 附录：屏幕清单

| 屏幕 | 文件 | 所属 Tab |
|---|---|---|
| OnboardingScreen | screens/OnboardingScreen.tsx | 全局（首次） |
| MapScreen | screens/MapScreen.tsx | 地图 |
| RoutePlanScreen | screens/RoutePlanScreen.tsx | 地图 |
| StationInfoScreen | screens/StationInfoScreen.tsx | 地图 |
| TripScreen | screens/TripScreen.tsx | 行程 |
| RewardsHome | screens/RewardsHome.tsx | 奖励 |
| PointsScreen | screens/PointsScreen.tsx | 奖励 |
| TasksScreen | screens/TasksScreen.tsx | 奖励 |
| ActivitiesScreen | screens/ActivitiesScreen.tsx | 奖励 |
| AirdropScreen | screens/AirdropScreen.tsx | 奖励 |
| RankScreen | screens/RankScreen.tsx | 奖励 |
| WalletScreen | screens/WalletScreen.tsx | 钱包 |
| MeScreen | screens/MeScreen.tsx | 我的 |
| SettingsScreen | screens/SettingsScreen.tsx | 我的 |
| HelpScreen | screens/HelpScreen.tsx | 我的 |
