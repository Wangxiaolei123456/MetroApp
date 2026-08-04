// 积分商城数据模型（对齐 Metro.IOS 既有商城服务 /shop/*、/api/user/*）
//
// 字段命名直接沿用 Metro.IOS 服务端返回结构，便于无缝对接：
//   - 商品列表来自 /shop/products（与 H5 /shop/index 同源）
//   - 购物车来自 GET /api/user/shopcart：obj[] -> { merchantID, merchantName, goods[] }
//   - 下单来自 GET /api/user/ordertrade
//   - 用户积分来自 GET /api/user/info：data.totalScore

/** 配送方式：1 配送 | 2 到店自提 | 3 两者 */
export type DeliveryMode = 1 | 2 | 3;

/** 支付方式：points=积分抵扣，usd=美元（预留 UptickPay，后期接入真实收银） */
export type PayMethod = 'points' | 'usd';

export interface MallProduct {
  /** 商品 id（与 H5 详情页 product/id 对应） */
  id: string | number;
  title: string;
  /** 商品主图（相对路径，需经服务端图片前缀补全） */
  image: string;
  /** 人民币售价（配送类使用） */
  price: number;
  /** 兑换所需积分 */
  point: number;
  /** 美元价（由 metro-backend 配置，预留 USD 支付） */
  priceUsd?: number;
  /** 支持的支付方式（由 metro-backend 配置） */
  payMethods?: PayMethod[];
  /** 市场价 */
  marketPrice: number;
  /** 销量 */
  sales: number;
  /** 库存 */
  stock: number;
  /** 单笔最大购买量 */
  maxNum: number;
  /** 商户 id */
  merchantID: number;
  /** 商户名称 */
  merchantName: string;
  /** 配送方式：1 配送 | 2 到店自提 | 3 两者 */
  delivery: DeliveryMode;
  desc?: string;
}

/** /api/user/shopcart 返回的商品行 */
export interface CartGood {
  /** 购物车行 id（下单、改数量、删除都用它） */
  shopCartID: number;
  logoUrl: string;
  title: string;
  point: number;
  price: number;
  marketPrice: number;
  /** 已选数量 */
  num: number;
  /** 单笔最大购买量 */
  maxNum: number;
  /** 该行支持的配送方式 */
  delivery: DeliveryMode;
  selected?: boolean;
}

/** /api/user/shopcart 返回的店铺分组 */
export interface CartGroup {
  merchantID: number;
  merchantName: string;
  deliveryMode: DeliveryMode;
  goods: CartGood[];
}

/** /api/user/shopcart 整体返回（obj[] 数组） */
export type Cart = CartGroup[];

export type OrderStatus = 'unpaid' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export interface OrderItem {
  productId: string | number;
  title: string;
  image: string;
  point: number;
  price: number;
  qty: number;
  delivery: DeliveryMode;
}

export interface MallOrder {
  id: string;
  items: OrderItem[];
  totalPoint: number;
  totalPrice: number;
  status: OrderStatus;
  delivery: DeliveryMode;
  address?: string;
  note?: string;
  createdAt: string;
}

/** 下单参数（对齐 GET /api/user/ordertrade） */
export interface OrderTradeParams {
  /** 形如 sku_<shopCartID>|<merchantID>|0，多个用英文逗号连接 */
  shopcart_ios: string;
  merchantID: number;
  /** 2=配送 3=到店自提 */
  delivery: 2 | 3;
}

/** GET /api/user/ordertrade 返回（对齐 Metro.IOS obj.ordertradeJson） */
export interface OrderTradeResult {
  /** 预售订单号，POST /api/user/order 时使用 */
  orderID: string;
  /** 需抵扣积分 */
  point: number;
  /** 应付金额（元） */
  total: number;
  /** 配送方式：1 配送 | 2 到店自提 | 3 两者 */
  delivery: DeliveryMode;
  /** 保留时间文本，如 "30分钟" */
  holdTimestr?: string;
  /** 商品行 */
  shopCartList?: Array<{
    logoUrl: string;
    title: string;
    point: number;
    price: number;
    marketPrice: number;
    num: number;
    maxNum: number;
    delivery: DeliveryMode;
  }>;
}

/** POST /api/user/order 创建订单返回（对齐 Metro.IOS） */
export interface CreateOrderResult {
  /** 真实订单 id */
  id: string;
  /** 支付状态：'1'=已支付 '0'=未支付 */
  payState: string;
  /** 本次下单使用的支付方式 */
  payMethod?: PayMethod;
}
