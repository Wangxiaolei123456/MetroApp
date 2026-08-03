# MetroApp 与 Metro.IOS 项目对比

> 对比对象：
> - **MetroApp**：`/Users/starrymedia/work/MetroApp` —— React Native 跨平台 App，定位"通勤即挖矿 + 链上 UPTICK 代币"。
> - **Metro.IOS**：`/Users/starrymedia/work/Metro.IOS` —— Objective-C/Swift 原生 iOS App「最地铁」，定位"地铁出行规划 + 运营生态 + Web3 钱包"。
>
> 本文从技术栈、功能、数据、商业模式四个维度做异同对比，供产品/技术决策参考。

---

## 一、相同点（Same）

| 维度 | 共同点 |
|---|---|
| 1. 目标用户 | 均以 **地铁通勤用户** 为核心，解决出行与乘车记录需求。 |
| 2. 平台 | 均支持 **iOS** 平台运行（MetroApp 额外支持 Android）。 |
| 3. 出行核心 | 都具备 **路线规划 / 站点查询 / 乘车记录** 类功能。 |
| 4. 钱包/区块链 | 都包含 **Web3 钱包** 能力（助记词、地址管理、链上交互）。 |
| 5. 积分体系 | 都设计了 **积分** 作为用户激励（MetroApp 积分 + UPTICK；Metro.IOS 积分商城）。 |
| 6. 定位能力 | 都使用设备 **GPS 定位** 支撑出行场景。 |
| 7. 多语言 | 都支持国际化（MetroApp 中/英切换；Metro.IOS 含 en/zh-Hans/zh-Hant）。 |
| 8. 主题/体验 | 都考虑深色模式、引导页等基础体验。 |

---

## 二、不同点（Different）

### 2.1 技术栈

| 项目 | MetroApp | Metro.IOS（最地铁） |
|---|---|---|
| 语言 | TypeScript + React (JSX) | Objective-C + Swift |
| 框架 | React Native 0.74 | 原生 UIKit（无跨平台框架） |
| 状态管理 | zustand | 原生 MVC（Controller/Model/View） |
| 网络 | fetch / ethers RPC | AFNetworking |
| 存储 | AsyncStorage + EncryptedStorage | FMDB（SQLite）+ Keychain |
| 地图 | react-native-maps（跨平台） | 原生 MapKit（推测） |
| 包管理 | npm/yarn | CocoaPods |
| 构建 | Metro bundler | Xcode + CocoaPods |

### 2.2 功能广度

| 维度 | MetroApp | Metro.IOS（最地铁） |
|---|---|---|
| 出行规划 | ✅ 双引擎（Google + 本地 Dijkstra/Yen） | ✅ 路线搜索/方案/步行/首末班车 |
| 报站提醒 | ❌ | ✅ 到站语音/通知（核心差异化） |
| 商城/电商 | ❌ | ✅ 积分商城/商品/购物车/订单/支付宝SDK |
| 签到/小游戏 | ❌ | ✅ 连续签到+排行、挖矿小游戏 |
| 资讯 | ❌ | ✅ 资讯列表/详情/新版 |
| 健康码 | ❌ | ✅ 健康码展示（疫情相关） |
| 喜马拉雅 | ❌ | ✅ 已集成 XMSDK |
| 登录体系 | 钱包即身份（BIP39） | 账号体系（手机/拼图验证/改密）+ Web3Auth + Google |
| 链上代币激励 | ✅ UPTICK（乘车发放、可上链） | ⚠️ Web3 钱包能力，但非"乘车挖矿"模型 |
| 空投/任务/活动 | ✅ 空投广场、任务、活动、排行榜 | ✅ 活动、优惠券（偏运营） |
| 消息中心/反馈 | ❌ | ✅ 消息中心、意见反馈、有奖调查 |

### 2.3 数据来源

| 项目 | 数据方式 |
|---|---|
| MetroApp | 站点数据由 `scripts/build-metro.mjs` 从开源 GitHub 数据集（上海/香港）构建期生成，App 运行时不联网抓取；链上数据走 RPC/Blockscout。 |
| Metro.IOS | 业务数据依赖后端 API（AFNetworking 请求）；本地用 FMDB 持久化；地图/站点数据推测来自自有服务端。 |

### 2.4 商业模式侧重

| 项目 | 侧重 |
|---|---|
| MetroApp | **Web3 激励型**：通勤行为 → 积分 + UPTICK 链上代币 → 空投/兑换，偏"行为即资产"。 |
| Metro.IOS | **运营电商型**：出行工具 + 积分商城 + 支付 + 内容(喜马拉雅) + 活动，偏"工具带流量、流量做转化"。 |

---

## 三、一句话总结

- **MetroApp** 是"用 React Native 做的、带链上代币激励的通勤记录工具"，技术现代、跨端、Web3 属性强。
- **Metro.IOS（最地铁）** 是"用原生 Objective-C/Swift 写成的、功能齐全的地铁出行运营 App"，功能面更广（电商/内容/签到/报站），商业化程度更高。

两者在"地铁出行 + 钱包 + 积分"上有交集，但在 **技术实现、功能广度、商业定位** 上属于两条不同路线：一个是跨端 Web3 激励实验，一个是成熟原生出行产品。

---

## 四、可借鉴点（供决策参考）

- MetroApp 可借鉴 Metro.IOS 的 **报站提醒、签到、商城、资讯** 等提升留存与商业化的模块。
- Metro.IOS 可借鉴 MetroApp 的 **链上代币激励闭环（乘车即挖矿）** 与跨平台能力，降低多端维护成本。
