/**
 * 本地运行配置（零依赖，无需 babel 插件或 .env 加载器）。
 *
 * 设置运营后端地址（H2–H6：活动/空投/排行榜/看板/推送）：
 *   - 留空 ''          → App 使用内置本地种子数据，功能不降级（离线可用）。
 *   - 填后端地址       → App 从该地址拉取真实运营数据，失败回落本地种子。
 *
 * 示例：
 *   export const METRO_API_BASE = 'http://192.168.1.10:3000';
 *   export const METRO_API_BASE = 'http://10.0.2.2:3000'; // 安卓模拟器访问宿主机
 *
 * 注意：改完需重新 build（yarn ios / yarn android）。
 */
export const METRO_API_BASE = 'http://192.168.111.176:3000';
