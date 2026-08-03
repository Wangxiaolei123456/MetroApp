# Metro.IOS（最地铁）产品功能说明

> 适用对象：产品 / 运营 / 验收 / 关注 iOS 端的同学
> 平台视角：本文聚焦 **iOS（iPhone / iPad）** 原生 App「最地铁 / Metro.IOS」的功能、结构与实际行为能力。
> 技术栈：Objective-C + Swift（Web3Auth 部分），原生 iOS 工程，无跨平台框架。

---

## 1. 产品一句话定位

Metro.IOS 是一款面向**地铁通勤用户**的原生 iOS App「最地铁」，围绕**出行规划、到站提醒、乘车记录、积分商城、Web3 钱包**构建完整闭环，并融合了签到、小游戏、资讯、健康码、喜马拉雅内容接入等运营能力。

---

## 2. 整体架构

App 以底部 Tab / 多模块导航组织，主业务目录位于 `Zuiditie/`：

| 模块 | 目录 | 主要职责 |
|---|---|---|
| 首页 | `Zuiditie/首页` | 动态推荐、签到、扫一扫、小游戏、活动入口 |
| 出行 | `Zuiditie/出行` | 路线搜索/方案、首末班车、站点详情、报站提醒、定位 |
| 我的 | `Zuiditie/我的` | 登录注册、资料、积分、卡券、订单、设置、Web3Auth |
| 钱包 | `Zuiditie/我的/钱包` | 余额支付、Web3 区块钱包、转账联系人 |
| 商城 | `Zuiditie/商城` | 积分商城、商品、购物车、订单 |
| 资讯 | `Zuiditie/资讯` | 资讯列表/详情/新版资讯 |
| 健康码 | `Zuiditie/健康码` | 健康码展示 |
| App 入口 | `AppDelegate.m` | 启动、Google 登录(GIDSignIn)、第三方回调 |

---

## 3. 功能模块详述

### 3.1 首页（Home）
- 首页主界面：线路动态、推荐内容、精彩活动展示。
- 签到：连续签到领奖励，含排行榜（`RankController`）。
- 扫一扫：扫码能力。
- 小游戏：挖矿小游戏（`WaKuangViewController`）。
- 活动：精彩活动、参与活动、更多优惠券入口。
- 引导页：首次启动引导。

### 3.2 出行（核心）
- 路线搜索（`SearchLinesViewController`）：按线路/站点检索。
- 路线方案（`FanganLinesViewController`）：多方案对比；含步行方案。
- 路线设置：出行偏好配置。
- 首末班车查询。
- 站点详情（`SiteStationDetail`）：站点信息。
- 报站提醒：到站语音/通知（`ArriveStationNotify`、`PlaningViewController`、`ReportingStationViewController`）。
- 实时定位（`Location`）支持。

### 3.3 我的（Mine）
- 登录注册：`Login` / `Register`，绑定手机、拼图验证、用户协议、修改密码。
- Web3Auth 登录：`Web3AuthManager.swift` / `web3RPC.swift`。
- 编辑资料。
- 我的积分。
- 卡券包。
- 历史乘车路线。
- 我的收藏。
- 消息中心。
- 意见反馈、有奖调查。
- 注销账号、设置。

### 3.4 钱包
- 余额/支付：支付能力（`Controllers` 等）。
- 区块钱包（Web3）：创建/导入/管理（`LxxCreatWallet` 系列），含钱包信息、管理、联系人。
- 钱包联系人：转账联系人管理（`LxxNewContactViewController`）。

### 3.5 商城
- 积分商城（`ScoreShopViewController`）。
- 商品详情。
- 购物车。
- 我的订单。

### 3.6 资讯
- 资讯列表 / 详情（`Controllers` + `Models` + `Views`）。
- 新版资讯（`New资讯`）。

### 3.7 健康码（疫情相关）
- 健康码展示（`HealthcodeViewController`）。

---

## 4. 平台 / 接入能力

- 喜马拉雅内容接入（README 提及）。
- 多语言：`en` / `zh-Hans` / `zh-Hant` 国际化资源（`.lproj`）。
- Google 登录：`AppDelegate` 已接入 `GIDSignIn`。
- Web3Auth：Swift 实现的去中心化登录与 RPC 调用。

---

## 5. 功能点清单（汇总）

| 编号 | 模块 | 功能点 |
|---|---|---|
| F01 | 首页 | 首页主界面（线路动态/推荐） |
| F02 | 首页 | 签到（连续签到 + 排行榜） |
| F03 | 首页 | 扫一扫 |
| F04 | 首页 | 小游戏（挖矿） |
| F05 | 首页 | 精彩活动 / 优惠券入口 |
| F06 | 首页 | 引导页 |
| F07 | 出行 | 路线搜索 |
| F08 | 出行 | 路线方案（多方案对比） |
| F09 | 出行 | 步行方案 |
| F10 | 出行 | 路线设置（偏好） |
| F11 | 出行 | 首末班车查询 |
| F12 | 出行 | 站点详情 |
| F13 | 出行 | 报站提醒（到站语音/通知） |
| F14 | 出行 | 实时定位 |
| F15 | 我的 | 登录注册（含手机绑定/拼图验证/用户协议/改密） |
| F16 | 我的 | Web3Auth 登录 |
| F17 | 我的 | 编辑资料 |
| F18 | 我的 | 我的积分 |
| F19 | 我的 | 卡券包 |
| F20 | 我的 | 历史乘车路线 |
| F21 | 我的 | 我的收藏 |
| F22 | 我的 | 消息中心 |
| F23 | 我的 | 意见反馈 |
| F24 | 我的 | 有奖调查 |
| F25 | 我的 | 注销账号 |
| F26 | 我的 | 设置 |
| F27 | 钱包 | 余额/支付 |
| F28 | 钱包 | 区块钱包（Web3 创建/导入/管理） |
| F29 | 钱包 | 钱包联系人管理 |
| F30 | 商城 | 积分商城 |
| F31 | 商城 | 商品详情 |
| F32 | 商城 | 购物车 |
| F33 | 商城 | 我的订单 |
| F34 | 资讯 | 资讯列表/详情 |
| F35 | 资讯 | 新版资讯 |
| F36 | 健康码 | 健康码展示 |
| F37 | 平台 | 喜马拉雅内容接入 |
| F38 | 平台 | 多语言（en/zh-Hans/zh-Hant） |
| F39 | 平台 | Google 登录 |
| F40 | 平台 | Web3Auth（Swift） |

---

## 6. 与 MetroApp 的区别（说明）

> 注意：本文件原用于描述 React Native 项目 `MetroApp`。现已替换为原生 iOS 项目 `Metro.IOS`（最地铁）的功能说明。两者为不同工程：
> - `MetroApp`：React Native，跨平台，主打"通勤即挖矿 + 链上 UPTICK 代币"。
> - `Metro.IOS`：Objective-C/Swift 原生 iOS，主打"地铁出行规划 + 报站提醒 + 积分商城 + Web3 钱包"。
