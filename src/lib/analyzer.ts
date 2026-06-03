/**
 * MX 海外仓库存管理系统 — 核心计算引擎
 * Design: Precision Data Terminal
 *
 * SKU 映射规则（完全依赖 Excel「SKU匹配表」Sheet，禁止自动规范化匹配）：
 * - A列：店铺（TTS MX-AR / TTS MX-NE / TTS MX-SJ / MX-AR 美客多 / MX-NE 美客多）
 * - B列：店铺SKU（平台原始 SKU）
 * - C列：海外仓SKU1（直接成品 SKU，可能为空）
 * - D列：组合品1（子 SKU）
 * - E列：组合品2（子 SKU）
 *
 * 三种映射情况：
 * 1. 只有C列：直接用 C 列 key 查仓库库存（单品直接映射）
 * 2. C+D/E 均有值：优先用 C 列成品库存；成品不足时用 min(D库存, E库存) 补充
 * 3. C为空，只有D/E：直接用 min(D库存, E库存) 作为可用量
 *
 * 注意：D/E 列的值直接作为仓库 key 查找，不拆解+号
 */

// ─── 类型定义 ───────────────────────────────────────────────────────────────

export type StatusLevel = 'red' | 'orange' | 'yellow' | 'green' | 'gray';

export interface ListingRow {
  seller_sku: string;
  listing_id: string;
  platform: 'TTS' | 'MKD';
  shop: string;
  platform_qty: number;
  wh_total: number;
  stock_surplus: number;
  listing_daily: number;
  days_of_stock: number;
  status: string;
  status_level: StatusLevel;
  suggest_add: number;
  suggest_reduce: number;
  suggest_adjust: number;
  sku_id: string;
  brand: string;
  // 近15天和30天销量（该 Listing 级别）
  listing_s15: number;
  listing_s30: number;
  // 映射类型
  wh_sku_type: 'direct' | 'insufficient' | 'assembled' | 'single' | 'none';
  wh_supplement?: number;   // 可组合补充数量（C不足时 min(D,E)）
  wh_direct_qty?: number;   // C列成品库存
  wh_comp_extra?: number;   // D/E子SKU可额外组合数量（C不足时）
  // 映射详情（用于 Listing 动态联动）
  wh_sku1?: string;         // C列海外仓SKU1
  comp1?: string;           // D列组合品1
  comp2?: string;           // E列组合品2
  // 原始仓库库存（用于全局资源池联动，不受其他 Listing 影响）
  wh_raw_qty?: number;      // C列成品原始库存
  comp1_raw_qty?: number;   // D列单品原始库存
  comp2_raw_qty?: number;   // E列单品原始库存
  // 库存类型说明（用于 Listing 表展示）
  // 'single'：单品，如 AR108
  // 'bundle_with_parts'：成套+拆解，有成品也可单品组套，如 AR108+439
  // 'parts_only'：纯拆解，没有组好的套装，必须用单品组套
  wh_sku_category?: 'single' | 'bundle_with_parts' | 'parts_only';
}

export interface PurchaseRow {
  seller_sku: string;           // 海外仓 SKU（主键）
  brand: string;
  wh_total: number;
  in_transit: number;           // 在途库存
  buffer: number;
  wh_allocatable: number;
  total_platform: number;       // 全平台合计上架库存
  redundant: number;
  // 5个店铺分列销量（30天）
  tts_ar_s30: number;           // TTS MX-AR
  tts_ne_s30: number;           // TTS MX-NE
  tts_sj_s30: number;           // TTS MX-SJ
  mkd_ar_s30: number;           // MKD MX-AR
  mkd_ne_s30: number;           // MKD MX-NE
  // 合计
  tts_s30: number;
  mkd_s30: number;
  all_s30: number;
  daily_avg: number;
  days_of_stock: number;
  target_60: number;
  suggest_purchase: number;     // 库存需求 = max(0, 60天目标 - 仓库库存)
  still_needed: number;         // 仍有需求 = max(0, 库存需求 - 在途库存)
  status: string;
  status_level: StatusLevel;
}

export interface TrendRow {
  seller_sku: string;           // 海外仓 SKU（以 C 列 whSku1 为主键，assembled 时用 comp1+comp2）
  brand: string;
  all_s30: number;              // 全平台合计30天
  all_s15: number;              // 全平台合计近15天
  prev15: number;               // 全平台合计前15天
  // 5个店铺分列销量（30天）
  tts_ar_s30: number;           // TTS MX-AR
  tts_ne_s30: number;           // TTS MX-NE
  tts_sj_s30: number;           // TTS MX-SJ
  mkd_ar_s30: number;           // MKD MX-AR
  mkd_ne_s30: number;           // MKD MX-NE
  // 兼容旧字段（合计）
  tts_s30: number;
  mkd_s30: number;
  trend: string;
  hot: string;
  hot_level: StatusLevel;
}

export interface SkuMatchRow {
  platform: 'TTS' | 'MKD';
  shop: string;
  seller_sku: string;
  product_id: string;
  sku_id: string;
  wh_sku: string;
  wh_sku_matched: boolean;
  wh_sku_type: 'direct' | 'insufficient' | 'assembled' | 'single' | 'none';
  wh_supplement?: number;
  platform_qty: number;
  wh_qty: number;           // 产品库存（单品或成套原装）
  wh_assemble_qty: number;  // 可组合数量（单品可拆解组合的数量）
  wh_total_qty: number;     // 总可用库存 = 产品库存 + 可组合数量
  days_of_stock: number;    // 产品库存可售天数
  days_of_total: number;    // 总可用库存可售天数
}

export interface AnalysisStats {
  totalSkus: number;
  totalListings: number;
  urgentCount: number;
  hotCount: number;
  declineCount: number;
  purchaseNeeded: number;
  dataDate: string;
  ttsShops: number;
  mkdShops: number;
}

export interface AnalysisResult {
  listingAdj: ListingRow[];
  purchase: PurchaseRow[];
  trend: TrendRow[];
  skuMatch: SkuMatchRow[];
  stats: AnalysisStats;
}

// ─── SKU 映射表结构 ──────────────────────────────────────────────────────────

export interface SkuMapping {
  shop: string;       // A列：店铺
  platformSku: string; // B列：店铺SKU
  whSku1: string | null; // C列：海外仓SKU1（成品，直接查仓库）
  comp1: string | null;  // D列：组合品1（子SKU，直接作为仓库key）
  comp2: string | null;  // E列：组合品2（子SKU，直接作为仓库key）
}

// 映射字典 key: `${shop}|||${platformSku}`
type SkuMappingDict = Map<string, SkuMapping>;

// ─── 虚拟 SKU 排除列表 ───────────────────────────────────────────────────────

const VIRTUAL_SKUS = new Set(['', 'nan', '000', 'AR000']);

function isVirtualSku(sku: unknown): boolean {
  if (!sku) return true;
  const s = String(sku).trim();
  return VIRTUAL_SKUS.has(s) || s === '';
}

function cleanSku(sku: unknown): string {
  return String(sku ?? '').trim();
}

// ─── 品牌识别 ────────────────────────────────────────────────────────────────

function getBrand(sku: string): string {
  if (sku.startsWith('AR')) return 'AR';
  if (sku.startsWith('NE')) return 'NE';
  return '-';
}

// ─── 日期解析 ────────────────────────────────────────────────────────────────

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const s = String(val).trim();

  // 格式1: MM/DD/YYYY H:MM:SS AM/PM (TTS标准)
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (m1) {
    let h = parseInt(m1[4]);
    const ampm = m1[7].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return new Date(
      parseInt(m1[3]), parseInt(m1[1]) - 1, parseInt(m1[2]),
      h, parseInt(m1[5]), parseInt(m1[6])
    );
  }

  // 格式2: YYYY-MM-DD HH:MM:SS
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (m2) {
    return new Date(
      parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]),
      parseInt(m2[4]), parseInt(m2[5]), parseInt(m2[6])
    );
  }

  // 格式3: Excel 序列号
  const n = Number(val);
  if (!isNaN(n) && n > 40000 && n < 60000) {
    return new Date((n - 25569) * 86400 * 1000);
  }

  return null;
}

// ─── SheetJS 数据读取工具 ────────────────────────────────────────────────────

type WorkbookType = any; // SheetJS XLSX.WorkBook

function getSheet(wb: WorkbookType, name: string): any | null {
  return wb.Sheets[name] ?? null;
}

function sheetToRows(sheet: any, opts?: any): any[][] {
  const XLSX = (window as any).XLSX;
  if (!XLSX || !sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, ...opts });
}

/** 动态查找列索引（按表头关键词） */
function findColIdx(headers: unknown[], keywords: string[], fallback: number): number {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? '').trim();
    if (keywords.some(kw => h.includes(kw) || h === kw)) return i;
  }
  return fallback;
}

// ─── SKU 映射表解析 ──────────────────────────────────────────────────────────

/**
 * 解析「SKU匹配表」Sheet，建立精确映射字典
 * key: `${shop}|||${platformSku}`
 * 完全禁止自动规范化匹配，硬性读取映射表内容
 */
function parseSkuMapping(wb: WorkbookType): SkuMappingDict {
  const sheet = getSheet(wb, 'SKU匹配表');
  if (!sheet) return new Map();

  const rows = sheetToRows(sheet);
  if (rows.length < 2) return new Map();

  const dict: SkuMappingDict = new Map();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const shop = String(row[0] ?? '').trim();
    const platformSku = String(row[1] ?? '').trim();

    // 跳过空行（shop 和 sku 均为空）
    if (!shop || !platformSku) continue;

    const whSku1 = row[2] ? String(row[2]).trim() : null;
    const comp1 = row[3] ? String(row[3]).trim() : null;
    const comp2 = row[4] ? String(row[4]).trim() : null;

    const key = `${shop}|||${platformSku}`;
    dict.set(key, { shop, platformSku, whSku1, comp1, comp2 });
  }

  return dict;
}

/**
 * 根据映射表店铺名称获取标准化店铺代码
 * TTS MX-AR → MX-AR（TTS）
 * MX-AR 美客多 → MX-AR（MKD）
 */
function getMappingShopKey(shop: string, platform: 'TTS' | 'MKD'): string {
  // TTS 店铺：去掉 "TTS " 前缀
  if (shop.startsWith('TTS ')) return shop.replace('TTS ', '');
  // 美客多店铺：去掉 " 美客多" 后缀
  if (shop.includes('美客多')) return shop.replace(' 美客多', '');
  return shop;
}

/**
 * 从映射字典中查找映射（支持多种店铺名称格式）
 * 映射表 A 列格式：TTS MX-AR / TTS MX-NE / TTS MX-SJ / MX-AR 美客多 / MX-NE 美客多
 * 平台数据格式：shop=MX-AR, platform=TTS 或 MKD
 */
function lookupMapping(
  mappingDict: SkuMappingDict,
  shop: string,
  platform: 'TTS' | 'MKD',
  platformSku: string
): SkuMapping | null {
  // 构造映射表中的店铺名称
  let mappingShop: string;
  if (platform === 'TTS') {
    mappingShop = `TTS ${shop}`;
  } else {
    mappingShop = `${shop} 美客多`;
  }

  const key = `${mappingShop}|||${platformSku}`;
  return mappingDict.get(key) ?? null;
}

/**
 * 根据映射计算可用仓库库存
 * 返回 { qty, type, directQty, compExtra, supplement }
 *
 * 三种情况：
 * 1. 只有 whSku1（C列）：直接查仓库
 * 2. whSku1 + comp1/comp2：优先成品，不足时用子SKU补充
 * 3. 只有 comp1/comp2（C为空）：min(comp1库存, comp2库存)
 */
function resolveWhQty(
  mapping: SkuMapping,
  whDict: Map<string, number>
): {
  qty: number;
  type: 'direct' | 'insufficient' | 'assembled' | 'single' | 'none';
  directQty: number;
  compExtra: number;
  supplement: number;
  whSkuDisplay: string;
} {
  const { whSku1, comp1, comp2 } = mapping;
  const hasC = !!whSku1;
  const hasDE = !!(comp1 || comp2);

  if (!hasC && !hasDE) {
    return { qty: 0, type: 'none', directQty: 0, compExtra: 0, supplement: 0, whSkuDisplay: '' };
  }

  // 情况1：只有C列（单品直接映射）
  if (hasC && !hasDE) {
    const qty = whDict.get(whSku1!) ?? 0;
    return { qty, type: 'single', directQty: qty, compExtra: 0, supplement: 0, whSkuDisplay: whSku1! };
  }

  // 情况3：C为空，只有D/E（必须拆解组合）
  if (!hasC && hasDE) {
    const q1 = comp1 ? (whDict.get(comp1) ?? 0) : Infinity;
    const q2 = comp2 ? (whDict.get(comp2) ?? 0) : Infinity;
    const qty = Math.min(q1 === Infinity ? 0 : q1, q2 === Infinity ? 0 : q2);
    const parts = [comp1, comp2].filter(Boolean) as string[];
    return {
      qty,
      type: 'assembled',
      directQty: 0,
      compExtra: qty,
      supplement: 0,
      whSkuDisplay: parts.join(' + '),
    };
  }

  // 情况2：C+D/E 均有值（有成品也有拆解方案）
  const directQty = whDict.get(whSku1!) ?? 0;
  const q1 = comp1 ? (whDict.get(comp1) ?? 0) : Infinity;
  const q2 = comp2 ? (whDict.get(comp2) ?? 0) : Infinity;
  const compMin = Math.min(q1 === Infinity ? 0 : q1, q2 === Infinity ? 0 : q2);

  // 总可用量 = 成品 + 子SKU可额外组合
  const totalQty = directQty + compMin;

  if (directQty > 0 && compMin > 0) {
    // 有成品，也有子SKU可补充
    return {
      qty: totalQty,
      type: 'insufficient',
      directQty,
      compExtra: compMin,
      supplement: compMin,
      whSkuDisplay: whSku1!,
    };
  } else if (directQty > 0) {
    // 只有成品
    return {
      qty: directQty,
      type: 'direct',
      directQty,
      compExtra: 0,
      supplement: 0,
      whSkuDisplay: whSku1!,
    };
  } else {
    // 成品为0，用子SKU
    return {
      qty: compMin,
      type: 'assembled',
      directQty: 0,
      compExtra: compMin,
      supplement: 0,
      whSkuDisplay: [comp1, comp2].filter(Boolean).join(' + '),
    };
  }
}

// ─── Sheet 解析函数 ──────────────────────────────────────────────────────────

interface TtsProduct {
  product_id: string;
  sku_id: string;
  seller_sku: string;
  quantity: number;
  shop: string;
}

/** 解析 TTS 商品表（从 index=5 开始，字段按表头名称匹配） */
function parseTtsProducts(wb: WorkbookType, shopCode: string): TtsProduct[] {
  const sheetName = `${shopCode} TTS商品表`;
  const sheet = getSheet(wb, sheetName);
  if (!sheet) return [];

  const rows = sheetToRows(sheet);
  if (rows.length < 6) return [];

  const header = rows[0] as unknown[];
  const pidIdx = findColIdx(header, ['product_id'], 0);
  const skuIdIdx = findColIdx(header, ['sku_id'], 3);
  const qtyIdx = findColIdx(header, ['quantity', '数量'], 6);
  const sellerSkuIdx = findColIdx(header, ['seller_sku', '商家 SKU'], 7);

  const results: TtsProduct[] = [];
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    const seller_sku = cleanSku(row[sellerSkuIdx]);
    if (isVirtualSku(seller_sku)) continue;

    const product_id = String(row[pidIdx] ?? '').trim();
    // 跳过模板说明行
    if (['不可编辑', '必填', 'V3'].some(kw => product_id.includes(kw))) continue;

    const sku_id = String(row[skuIdIdx] ?? '').trim();
    const quantity = parseInt(String(row[qtyIdx] ?? '0')) || 0;

    results.push({ product_id, sku_id, seller_sku, quantity, shop: shopCode });
  }
  return results;
}

interface TtsOrder {
  seller_sku: string;
  sku_id: string;
  qty: number;
  date: Date;
  shop: string;
}

/** 解析 TTS 订单表（从 index=2 开始） */
function parseTtsOrders(wb: WorkbookType, shopCode: string): TtsOrder[] {
  const sheetName = `${shopCode} TTS订单`;
  const sheet = getSheet(wb, sheetName);
  if (!sheet) return [];

  const rows = sheetToRows(sheet);
  if (rows.length < 3) return [];

  const header = rows[0] as unknown[];
  const statusIdx = findColIdx(header, ['Order Status'], 1);
  const cancelIdx = findColIdx(header, ['Cancelation/Return Type', 'Cancellation/Return Type'], 2);
  const sellerSkuIdx = findColIdx(header, ['Seller SKU'], 6);
  const skuIdIdx = findColIdx(header, ['SKU ID'], 7);
  const qtyIdx = findColIdx(header, ['Quantity'], 9);
  const dateIdx = findColIdx(header, ['Created Time'], 24);

  const results: TtsOrder[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const status = String(row[statusIdx] ?? '').trim();
    const cancelType = String(row[cancelIdx] ?? '').trim();

    // 过滤无效订单
    if (status === '已取消' || status === '未支付') continue;
    if (cancelType === 'Cancel' || cancelType === 'Return/Refund') continue;

    const seller_sku = cleanSku(row[sellerSkuIdx]);
    if (isVirtualSku(seller_sku)) continue;

    const date = parseDate(row[dateIdx]);
    if (!date) continue;

    const sku_id = String(row[skuIdIdx] ?? '').trim();
    const qty = parseInt(String(row[qtyIdx] ?? '1')) || 1;

    results.push({ seller_sku, sku_id, qty, date, shop: shopCode });
  }
  return results;
}

interface MkdProduct {
  listing_id: string;
  seller_sku: string;
  title: string;
  platform_qty: number;
  status: string;
  shop: string;
}

/** 解析美客多商品表（从 index=5 开始，按列位置读取，跳过 SKU 为空的汇总行） */
function parseMkdProducts(wb: WorkbookType, shopCode: string): MkdProduct[] {
  const sheetName = `${shopCode}美客多 商品表`;
  const sheet = getSheet(wb, sheetName);
  if (!sheet) return [];

  const rows = sheetToRows(sheet);
  if (rows.length < 6) return [];

  // 动态查找列（按表头名称，回退到固定位置）
  const header = rows[0] as unknown[];
  const listingIdx = findColIdx(header, ['ITEM_ID', 'Número de publicación'], 1);
  const skuIdx = findColIdx(header, ['SKU'], 4);
  const titleIdx = findColIdx(header, ['TITLE', 'Título'], 5);
  const qtyIdx = findColIdx(header, ['QUANTITY', 'Stock en tu depósito'], 7);
  const statusIdx = findColIdx(header, ['STATUS', 'Estado'], 24);

  const results: MkdProduct[] = [];
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    const listing_id = String(row[listingIdx] ?? '').trim();

    // 跳过无效行
    if (!listing_id || listing_id === 'ITEM_ID' || listing_id === 'Número de publicación') continue;
    if (!listing_id.startsWith('MLM')) continue;

    const seller_sku = cleanSku(row[skuIdx]);
    // 跳过 SKU 为空的 Listing 汇总行
    if (!seller_sku) continue;
    if (isVirtualSku(seller_sku)) continue;

    const status = String(row[statusIdx] ?? '').trim();
    if (status.includes('未付款')) continue;

    const title = String(row[titleIdx] ?? '').trim();
    const platform_qty = parseInt(String(row[qtyIdx] ?? '0')) || 0;

    results.push({ listing_id, seller_sku, title, platform_qty, status, shop: shopCode });
  }
  return results;
}

interface MkdOrder {
  seller_sku: string;
  qty: number;
  date: Date;
  shop: string;
}

/** 解析 upseller 流水（仅美客多行） */
function parseMkdOrders(wb: WorkbookType): MkdOrder[] {
  const sheet = getSheet(wb, 'upseller流水');
  if (!sheet) return [];

  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];

  const header = rows[0] as unknown[];
  const shopIdx = findColIdx(header, ['UpSeller 店铺名称', '店铺名称'], 3);
  const statusIdx = findColIdx(header, ['订单状态'], 4);
  const payIdx = findColIdx(header, ['付款时间'], 7);
  const skuIdx = findColIdx(header, ['SKU'], 30);
  const qtyIdx = findColIdx(header, ['产品数量'], 34);

  const results: MkdOrder[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const shopName = String(row[shopIdx] ?? '').trim();

    // 只处理美客多
    if (!shopName.includes('美客多')) continue;

    const status = String(row[statusIdx] ?? '').trim();
    if (status.includes('未付款')) continue;

    const seller_sku = cleanSku(row[skuIdx]);
    if (isVirtualSku(seller_sku)) continue;

    const date = parseDate(row[payIdx]);
    if (!date) continue;

    const qty = parseInt(String(row[qtyIdx] ?? '1')) || 1;

    // 识别店铺代码
    let shop = shopName;
    if (shopName.includes('AR')) shop = 'MX-AR';
    else if (shopName.includes('NE')) shop = 'MX-NE';

    results.push({ seller_sku, qty, date, shop });
  }
  return results;
}

/** 解析海外仓库存表 */
function parseWarehouse(wb: WorkbookType): Map<string, number> {
  let sheet = getSheet(wb, '仙人掌海外仓库存');
  if (!sheet) sheet = getSheet(wb, '仙人掌海外仓流水');
  if (!sheet) return new Map();

  const rows = sheetToRows(sheet);
  if (rows.length < 2) return new Map();

  const header = rows[0] as unknown[];
  const skuIdx = findColIdx(header, ['商品SKU', 'SKU'], 1);
  const availIdx = findColIdx(header, ['可用库存'], 6);

  const dict = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sku = cleanSku(row[skuIdx]);
    if (isVirtualSku(sku)) continue;
    const avail = parseInt(String(row[availIdx] ?? '0')) || 0;
    dict.set(sku, avail);
  }
  return dict;
}

/**
 * 解析在途库存
 * 直接从「仙人掌海外仓库存」Sheet 的「在途数」列读取
 * 表头匹配关键词：商品SKU / SKU，在途数 / 在途数量 / 在途
 */
function parseInTransit(wb: WorkbookType): Map<string, number> {
  // 与 parseWarehouse 共用同一个 Sheet
  let sheet = getSheet(wb, '仙人掌海外仓库存');
  if (!sheet) sheet = getSheet(wb, '仙人掌海外仓流水');
  if (!sheet) return new Map();

  const rows = sheetToRows(sheet);
  if (rows.length < 2) return new Map();

  const header = rows[0] as unknown[];
  const skuIdx = findColIdx(header, ['商品SKU', 'SKU'], 1);
  // 在途数列：匹配「在途数」、「在途数量」、「在途」
  const inTransitIdx = findColIdx(header, ['在途数', '在途数量', '在途'], -1);
  if (inTransitIdx < 0) return new Map(); // 该 Sheet 不包含在途列，返回空 Map

  const dict = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sku = cleanSku(row[skuIdx]);
    if (isVirtualSku(sku)) continue;
    const qty = parseInt(String(row[inTransitIdx] ?? '0')) || 0;
    if (qty > 0) dict.set(sku, qty);
  }
  return dict;
}

// ─── 主分析函数 ──────────────────────────────────────────────────────────────

export function analyzeInventory(wb: WorkbookType, today: Date): AnalysisResult {
  const TTS_SHOPS = ['MX-AR', 'MX-NE', 'MX-SJ'];
  const MKD_SHOPS = ['MX-AR', 'MX-NE'];

  // ── 1. 解析所有数据 ──────────────────────────────────────────────────────

  // 解析 SKU 映射表（核心：完全依赖此映射，禁止自动规范化）
  const mappingDict = parseSkuMapping(wb);

  const ttsProducts: TtsProduct[] = [];
  const ttsOrders: TtsOrder[] = [];
  let ttsShopsFound = 0;

  for (const shop of TTS_SHOPS) {
    const prods = parseTtsProducts(wb, shop);
    const ords = parseTtsOrders(wb, shop);
    if (prods.length > 0 || ords.length > 0) ttsShopsFound++;
    ttsProducts.push(...prods);
    ttsOrders.push(...ords);
  }

  const mkdProducts: MkdProduct[] = [];
  let mkdShopsFound = 0;
  for (const shop of MKD_SHOPS) {
    const prods = parseMkdProducts(wb, shop);
    if (prods.length > 0) mkdShopsFound++;
    mkdProducts.push(...prods);
  }

  const mkdOrders = parseMkdOrders(wb);
  const whDict = parseWarehouse(wb);
  const inTransitDict = parseInTransit(wb);

  // ── 2. 计算销量窗口 ──────────────────────────────────────────────────────

  const cut30 = new Date(today); cut30.setDate(today.getDate() - 30);
  const cut15 = new Date(today); cut15.setDate(today.getDate() - 15);

  // TTS 销量：按 seller_sku 和 sku_id 分别统计
  // key 格式：`${shop}|||${seller_sku}` 精确匹配，不做规范化
  const ttsS30BySku = new Map<string, number>(); // `${shop}|||${seller_sku}` → qty
  const ttsS15BySku = new Map<string, number>();
  const ttsBySkuId30 = new Map<string, number>(); // sku_id → qty（用于 Listing 表）
  const ttsBySkuId15 = new Map<string, number>();

  for (const o of ttsOrders) {
    const skuKey = `${o.shop}|||${o.seller_sku}`;
    if (o.date >= cut30) {
      ttsS30BySku.set(skuKey, (ttsS30BySku.get(skuKey) ?? 0) + o.qty);
      ttsBySkuId30.set(o.sku_id, (ttsBySkuId30.get(o.sku_id) ?? 0) + o.qty);
    }
    if (o.date >= cut15) {
      ttsS15BySku.set(skuKey, (ttsS15BySku.get(skuKey) ?? 0) + o.qty);
      ttsBySkuId15.set(o.sku_id, (ttsBySkuId15.get(o.sku_id) ?? 0) + o.qty);
    }
  }

  // 美客多销量：按 `${shop}|||${seller_sku}` 精确匹配
  const mkdS30BySku = new Map<string, number>();
  const mkdS15BySku = new Map<string, number>();

  for (const o of mkdOrders) {
    const skuKey = `${o.shop}|||${o.seller_sku}`;
    if (o.date >= cut30) {
      mkdS30BySku.set(skuKey, (mkdS30BySku.get(skuKey) ?? 0) + o.qty);
    }
    if (o.date >= cut15) {
      mkdS15BySku.set(skuKey, (mkdS15BySku.get(skuKey) ?? 0) + o.qty);
    }
  }

  // 辅助函数：按 (shop, platform, seller_sku) 精确查销量
  function getTtsSales30(shop: string, sellerSku: string): number {
    return ttsS30BySku.get(`${shop}|||${sellerSku}`) ?? 0;
  }
  function getTtsSales15(shop: string, sellerSku: string): number {
    return ttsS15BySku.get(`${shop}|||${sellerSku}`) ?? 0;
  }
  function getMkdSales30(shop: string, sellerSku: string): number {
    return mkdS30BySku.get(`${shop}|||${sellerSku}`) ?? 0;
  }
  function getMkdSales15(shop: string, sellerSku: string): number {
    return mkdS15BySku.get(`${shop}|||${sellerSku}`) ?? 0;
  }

  // ── 3. 构建 Listing 基础数据 ─────────────────────────────────────────────

  interface ListingBase {
    seller_sku: string;
    listing_id: string;
    platform: 'TTS' | 'MKD';
    shop: string;
    platform_qty: number;
    sku_id: string;
  }

  const listingBases: ListingBase[] = [];

  for (const p of ttsProducts) {
    listingBases.push({
      seller_sku: p.seller_sku,
      listing_id: p.product_id,
      platform: 'TTS',
      shop: p.shop,
      platform_qty: p.quantity,
      sku_id: p.sku_id,
    });
  }

  for (const p of mkdProducts) {
    listingBases.push({
      seller_sku: p.seller_sku,
      listing_id: p.listing_id,
      platform: 'MKD',
      shop: p.shop,
      platform_qty: p.platform_qty,
      sku_id: '',
    });
  }

  // ── 4. 按 (platform, shop, seller_sku) 分组构建 Listing 调整建议 ─────────

  // 分组 key：seller_sku（同一 SKU 可能在多个 Listing 上架）
  const skuGroups = new Map<string, ListingBase[]>();
  for (const lb of listingBases) {
    if (!skuGroups.has(lb.seller_sku)) skuGroups.set(lb.seller_sku, []);
    skuGroups.get(lb.seller_sku)!.push(lb);
  }

  const listingAdj: ListingRow[] = [];

  for (const [sku, group] of Array.from(skuGroups)) {
    // 从映射表查找仓库库存（取第一个 Listing 的 shop/platform 作为代表）
    // 注意：同一 seller_sku 在不同店铺可能有不同映射，但仓库库存是共享的
    // 这里对每个 Listing 单独查映射，取最大可用量（实际上同 SKU 映射的仓库库存应相同）
    const firstLb = group[0];
    const representMapping = lookupMapping(mappingDict, firstLb.shop, firstLb.platform, sku);
    const whInfo = representMapping
      ? resolveWhQty(representMapping, whDict)
      : { qty: 0, type: 'none' as const, directQty: 0, compExtra: 0, supplement: 0, whSkuDisplay: '' };

    const whTotal = whInfo.qty;
    const whDirectQty = whInfo.directQty;
    const whCompExtra = whInfo.compExtra;

    const buffer = Math.max(5, Math.floor(whTotal * 0.05));
    const whAllocatable = Math.max(0, whTotal - buffer);

    // 全平台上架库存合计
    const totalPlatform = group.reduce((s: number, lb: ListingBase) => s + lb.platform_qty, 0);
    const isOversell = totalPlatform > whTotal;

    // 全平台日均销量（用于超卖场景的按比例分配）
    const allS30Sku = group.reduce((s, lb) => {
      const sales = lb.platform === 'TTS'
        ? getTtsSales30(lb.shop, lb.seller_sku)
        : getMkdSales30(lb.shop, lb.seller_sku);
      return s + sales;
    }, 0);
    const allDaily = allS30Sku / 30;

    // 找到主力 Listing（30天销量最高）
    let maxSales30 = -1;
    let mainListingId = '';
    for (const lb of group) {
      const s30 = lb.platform === 'TTS'
        ? (ttsBySkuId30.get(lb.sku_id) ?? 0)
        : getMkdSales30(lb.shop, lb.seller_sku);
      if (s30 > maxSales30) { maxSales30 = s30; mainListingId = lb.listing_id; }
    }

    // 匀库判断
    const listingDailies = group.map((lb: ListingBase) => {
      const s30 = lb.platform === 'TTS'
        ? (ttsBySkuId30.get(lb.sku_id) ?? 0)
        : getMkdSales30(lb.shop, lb.seller_sku);
      const s15 = lb.platform === 'TTS'
        ? (ttsBySkuId15.get(lb.sku_id) ?? 0)
        : getMkdSales15(lb.shop, lb.seller_sku);
      const daily = s30 / 30;
      const days = daily > 0 ? lb.platform_qty / daily : 9999;
      return { lb, daily, days, s30, s15 };
    });

    const hasUnder30 = listingDailies.some((x: { lb: ListingBase; daily: number; days: number }) => x.days < 30 && x.daily > 0);
    const hasOver30 = listingDailies.some((x: { lb: ListingBase; daily: number; days: number }) => x.days >= 30 && x.daily > 0);
    const needRebalance = hasUnder30 && hasOver30;

    /**
     * 调减前置条件：同一 SKU 下，必须存在至少一个 TTS 链接可售天数 ≤60 天（有销量），
     * 才允许对其他 TTS 链接做调减建议。美客多链接永远不做调减。
     * 若所有 TTS 链接都 >60 天或无销量，则保持现状，不建议调减。
     */
    const hasTtsUnder60 = listingDailies.some(
      (x: { lb: ListingBase; daily: number; days: number }) =>
        x.lb.platform === 'TTS' && x.daily > 0 && x.days <= 60
    );

    // 匀库档位计算
    const sum30DayTargets = listingDailies.reduce((s: number, x: { lb: ListingBase; daily: number; days: number }) => s + Math.ceil(x.daily * 30), 0);
    const isLevelA = whAllocatable >= sum30DayTargets;

    for (const { lb, daily: listingDaily, days: daysRaw, s30: listingS30, s15: listingS15 } of listingDailies) {
      const days = listingDaily > 0 ? daysRaw : 9999;
      // 无销量 SKU 最低库存： min(10, 5%总库存)
      const minStock = Math.min(10, Math.max(1, Math.floor(whTotal * 0.05)));

      let status = '';
      let statusLevel: StatusLevel = 'green';
      let suggestAdd = 0;
      let suggestReduce = 0;
      let target = 0;

      if (isOversell) {
        // 场景1：超卖
        statusLevel = 'red';
        if (allDaily > 0) {
          target = Math.max(0, Math.ceil(whAllocatable * (listingDaily / allDaily)));
        } else {
          target = Math.max(0, Math.ceil(whAllocatable / group.length));
        }
        suggestAdd = Math.max(0, target - lb.platform_qty);
        suggestReduce = Math.max(0, lb.platform_qty - target);
        // 如果是组合品且有子SKU可额外组合，给出组合建议
        if (whCompExtra > 0 && whDirectQty < totalPlatform) {
          const canCover = whDirectQty + whCompExtra;
          if (canCover >= totalPlatform) {
            status = '🟡 可组合补充-建议调配';
            statusLevel = 'yellow';
          } else {
            status = `🔴 超卖-可组合${whCompExtra}件子SKU`;
          }
        } else {
          status = '🔴 超卖-必须修改';
        }
      } else if (lb.platform_qty === 0 && listingDaily > 0) {
        // 场景2：缺货
        status = '🔴 必须-平台缺货';
        statusLevel = 'red';
        target = Math.min(Math.ceil(listingDaily * 30), whAllocatable);
        suggestAdd = Math.max(0, target - lb.platform_qty);
      } else if (days < 15 && listingDaily > 0) {
        // 场景3：可售<15天
        status = '🔴 必须-可售<15天';
        statusLevel = 'red';
        target = Math.min(Math.ceil(listingDaily * 30), whAllocatable);
        suggestAdd = Math.max(0, target - lb.platform_qty);
      } else if (days < 30 && listingDaily > 0) {
        // 场景4：可售15~30天
        status = '🟡 建议补货(15~30天)';
        statusLevel = 'yellow';
        target = Math.min(Math.ceil(listingDaily * 30), whAllocatable);
        suggestAdd = Math.max(0, target - lb.platform_qty);
      } else if (needRebalance) {
        // 场景5：匀库
        if (isLevelA) {
          target = lb.listing_id === mainListingId
            ? Math.ceil(listingDaily * 45)
            : Math.ceil(listingDaily * 30);
        } else {
          if (allDaily > 0) {
            target = Math.ceil(whAllocatable * listingDaily / allDaily);
          } else {
            target = Math.ceil(whAllocatable / group.length);
          }
        }
        suggestAdd = Math.max(0, target - lb.platform_qty);
        // 调减前置条件：美客多不调减；TTS 需同 SKU 内有 ≤60 天链接
        const canReduceInRebalance = lb.platform === 'TTS' && hasTtsUnder60;
        suggestReduce = canReduceInRebalance ? Math.max(0, lb.platform_qty - target) : 0;
        if (suggestAdd > 0) { status = '🔴 需补货-匀库'; statusLevel = 'red'; }
        else if (suggestReduce > 0) { status = '🟡 需扣减-匀库'; statusLevel = 'yellow'; }
        else { status = '🟢 充足'; statusLevel = 'green'; }
      } else if (days > 90 && listingDaily > 0) {
        // 场景6：库存过多
        // 调减前置条件：美客多不调减；TTS 需同 SKU 内有 ≤60 天链接
        if (lb.platform === 'TTS' && hasTtsUnder60) {
          status = '🟡 建议扣减(>90天)';
          statusLevel = 'yellow';
          suggestReduce = Math.max(0, lb.platform_qty - Math.ceil(listingDaily * 30));
        } else {
          // 不满足调减条件，保持现状
          status = '🟢 充足';
          statusLevel = 'green';
        }
      } else if (listingDaily === 0 && lb.platform_qty > minStock) {
        // 场景7：无销量过多
        // 调减前置条件：美客多不调减；TTS 需同 SKU 内有 ≤60 天链接
        if (lb.platform === 'TTS' && hasTtsUnder60) {
          status = '🟡 建议扣减(无销量)';
          statusLevel = 'yellow';
          suggestReduce = lb.platform_qty - minStock;
        } else {
          // 不满足调减条件，保持现状
          status = '⚪ 无销量';
          statusLevel = 'gray';
        }
      } else if (listingDaily === 0 && lb.platform_qty < minStock) {
        // 场景8：无销量且库存不足最低库存
        status = '⚪ 无销量-建议最低库存';
        statusLevel = 'gray';
        suggestAdd = minStock - lb.platform_qty;
      } else if (listingDaily === 0) {
        status = '⚪ 无销量';
        statusLevel = 'gray';
      } else {
        // 场景9：充足
        status = '🟢 充足';
        statusLevel = 'green';
      }

      // 余量仅基于原装成品库存（whDirectQty），不包含单品可拆解的部分
      // 单品：whDirectQty = whTotal；成套+拆解：whDirectQty = 成品库存；纯拆解：whDirectQty = 0
      const stockSurplus = whDirectQty - totalPlatform;
      const suggestAdjust = suggestAdd - suggestReduce;

      listingAdj.push({
        seller_sku: sku,
        listing_id: lb.listing_id,
        platform: lb.platform,
        shop: lb.shop,
        platform_qty: lb.platform_qty,
        wh_total: whTotal,
        stock_surplus: stockSurplus,
        listing_daily: Math.round(listingDaily * 100) / 100,
        // 原装可售天数：仅基于原装库存（whDirectQty），有原装库存则用原装，没有原装才用拆解可用量
        // 单品：用 whTotal；成套+拆解：用 whDirectQty；纯拆解：用 whCompExtra
        days_of_stock: listingDaily > 0
          ? Math.round(whDirectQty > 0 ? whDirectQty / listingDaily : whCompExtra / listingDaily)
          : 9999,
        status,
        status_level: statusLevel,
        suggest_add: suggestAdd,
        suggest_reduce: suggestReduce,
        suggest_adjust: suggestAdjust,
        sku_id: lb.sku_id,
        brand: getBrand(sku),
        listing_s15: listingS15,
        listing_s30: listingS30,
        wh_sku_type: whInfo.type,
        wh_supplement: whInfo.supplement,
        wh_direct_qty: whDirectQty,
        wh_comp_extra: whCompExtra,
        wh_sku1: representMapping?.whSku1 ?? undefined,
        comp1: representMapping?.comp1 ?? undefined,
        comp2: representMapping?.comp2 ?? undefined,
        // 原始库存（用于全局资源池联动）
        wh_raw_qty: representMapping?.whSku1 ? (whDict.get(representMapping.whSku1) ?? 0) : undefined,
        comp1_raw_qty: representMapping?.comp1 ? (whDict.get(representMapping.comp1) ?? 0) : undefined,
        comp2_raw_qty: representMapping?.comp2 ? (whDict.get(representMapping.comp2) ?? 0) : undefined,
        // 库存类型：单品 / 成套+拆解 / 纯拆解
        wh_sku_category: (
          whInfo.type === 'single' || whInfo.type === 'direct'
            ? 'single'
            : whInfo.type === 'insufficient'
            ? 'bundle_with_parts'
            : whInfo.type === 'assembled'
            ? 'parts_only'
            : 'single'
        ) as 'single' | 'bundle_with_parts' | 'parts_only',
      });
    }
  }

  // ── 5. 采购建议（以海外仓 SKU 为主键去重汇总） ────────────────────────────

  const purchase: PurchaseRow[] = [];

  /**
   * 采购表以「海外仓 SKU」为主键去重汇总，将所有平台/店铺的同一仓库 SKU 销量合并到一行。
   * 主键规则与趋势表一致：
   * - single/direct/insufficient：以 whSku1（C列）为主键
   * - assembled：以 comp1+comp2（D+E列拼接）为主键
   * - 未匹配：以平台 SKU 为主键
   * 5个店铺分列：TTS MX-AR / TTS MX-NE / TTS MX-SJ / MKD MX-AR / MKD MX-NE
   */
  interface PurchaseAccum {
    whTotal: number;
    inTransit: number;
    ttsAr30: number; ttsNe30: number; ttsSj30: number;
    mkdAr30: number; mkdNe30: number;
    totalPlatform: number;
    brand: string;
  }
  const purchaseAccum = new Map<string, PurchaseAccum>();

  for (const [, mapping] of Array.from(mappingDict)) {
    const { shop: mappingShop, platformSku } = mapping;

    // 确定海外仓 SKU 主键
    const whInfo = resolveWhQty(mapping, whDict);
    const whSkuKey = whInfo.whSkuDisplay || platformSku;

    // 确定平台和店铺代码
    let platform: 'TTS' | 'MKD';
    let shopCode: string;
    if (mappingShop.startsWith('TTS ')) {
      platform = 'TTS';
      shopCode = mappingShop.replace('TTS ', '');
    } else {
      platform = 'MKD';
      shopCode = mappingShop.replace(' 美客多', '');
    }

    // 查询该平台店铺的销量
    const s30 = platform === 'TTS' ? getTtsSales30(shopCode, platformSku) : getMkdSales30(shopCode, platformSku);

    // 全平台上架库存（该平台店铺的该 SKU）
    const platformQty = listingBases
      .filter(lb => lb.seller_sku === platformSku && lb.shop === shopCode && lb.platform === platform)
      .reduce((s, lb) => s + lb.platform_qty, 0);

    if (!purchaseAccum.has(whSkuKey)) {
      // 仓库库存和在途库存以海外仓 SKU 为 key 查找
      const inTransit = inTransitDict.get(whSkuKey) ?? 0;
      purchaseAccum.set(whSkuKey, {
        whTotal: whInfo.qty,
        inTransit,
        ttsAr30: 0, ttsNe30: 0, ttsSj30: 0,
        mkdAr30: 0, mkdNe30: 0,
        totalPlatform: 0,
        brand: getBrand(whSkuKey),
      });
    }
    const acc = purchaseAccum.get(whSkuKey)!;

    // 将平台销量分店铺累加
    if (platform === 'TTS') {
      if (shopCode === 'MX-AR') acc.ttsAr30 += s30;
      else if (shopCode === 'MX-NE') acc.ttsNe30 += s30;
      else if (shopCode === 'MX-SJ') acc.ttsSj30 += s30;
    } else {
      if (shopCode === 'MX-AR') acc.mkdAr30 += s30;
      else if (shopCode === 'MX-NE') acc.mkdNe30 += s30;
    }
    acc.totalPlatform += platformQty;
  }

  for (const [whSku, acc] of Array.from(purchaseAccum)) {
    const ttsS30Total = acc.ttsAr30 + acc.ttsNe30 + acc.ttsSj30;
    const mkdS30Total = acc.mkdAr30 + acc.mkdNe30;
    const allS30 = ttsS30Total + mkdS30Total;
    const dailyAvg = allS30 / 30;
    const target60 = dailyAvg > 0 ? Math.ceil(dailyAvg * 60) : 0;
    const suggestPurchase = Math.max(0, target60 - acc.whTotal);
    const stillNeeded = Math.max(0, suggestPurchase - acc.inTransit);

    const buffer = Math.max(5, Math.floor(acc.whTotal * 0.05));
    const whAllocatable = Math.max(0, acc.whTotal - buffer);
    const redundant = whAllocatable - acc.totalPlatform;
    const daysOfStock = dailyAvg > 0 ? Math.round(acc.whTotal / dailyAvg) : 9999;

    let status = '';
    let statusLevel: StatusLevel = 'green';
    if (acc.whTotal === 0) {
      status = '🔴 仓库无库存'; statusLevel = 'red';
    } else if (redundant < 0) {
      status = '🟠 超卖状态'; statusLevel = 'orange';
    } else if (suggestPurchase > 0 && dailyAvg > 0) {
      status = '🟡 需补货入仓'; statusLevel = 'yellow';
    } else {
      status = '🟢 库存充足'; statusLevel = 'green';
    }

    purchase.push({
      seller_sku: whSku,
      brand: acc.brand,
      wh_total: acc.whTotal,
      in_transit: acc.inTransit,
      buffer,
      wh_allocatable: whAllocatable,
      total_platform: acc.totalPlatform,
      redundant,
      tts_ar_s30: acc.ttsAr30,
      tts_ne_s30: acc.ttsNe30,
      tts_sj_s30: acc.ttsSj30,
      mkd_ar_s30: acc.mkdAr30,
      mkd_ne_s30: acc.mkdNe30,
      tts_s30: ttsS30Total,
      mkd_s30: mkdS30Total,
      all_s30: allS30,
      daily_avg: Math.round(dailyAvg * 100) / 100,
      days_of_stock: daysOfStock,
      target_60: target60,
      suggest_purchase: suggestPurchase,
      still_needed: stillNeeded,
      status,
      status_level: statusLevel,
    });
  }

  // ── 6. 趋势分析 ──────────────────────────────────────────────────────────

  const trend: TrendRow[] = [];

  /**
   * 趋势表以「海外仓 SKU」为主键去重汇总，将所有平台/店铺的同一仓库 SKU 销量合并到一行。
   * 主键规则：
   * - single/direct/insufficient：以 whSku1（C列）为主键
   * - assembled：以 comp1+comp2（D+E列拼接）为主键
   * - 未匹配：以平台 SKU 为主键
   * 5个店铺分列：TTS MX-AR / TTS MX-NE / TTS MX-SJ / MKD MX-AR / MKD MX-NE
   */
  interface TrendAccum {
    ttsAr30: number; ttsAr15: number;
    ttsNe30: number; ttsNe15: number;
    ttsSj30: number; ttsSj15: number;
    mkdAr30: number; mkdAr15: number;
    mkdNe30: number; mkdNe15: number;
    brand: string;
  }
  const trendAccum = new Map<string, TrendAccum>();

  for (const [, mapping] of Array.from(mappingDict)) {
    const { shop: mappingShop, platformSku } = mapping;

    // 确定海外仓 SKU 主键
    const whInfo = resolveWhQty(mapping, whDict);
    const whSkuKey = whInfo.whSkuDisplay || platformSku;

    // 确定平台和店铺代码
    let platform: 'TTS' | 'MKD';
    let shopCode: string;
    if (mappingShop.startsWith('TTS ')) {
      platform = 'TTS';
      shopCode = mappingShop.replace('TTS ', '');
    } else {
      platform = 'MKD';
      shopCode = mappingShop.replace(' 美客多', '');
    }

    // 查询该平台店铺的销量
    const s30 = platform === 'TTS' ? getTtsSales30(shopCode, platformSku) : getMkdSales30(shopCode, platformSku);
    const s15 = platform === 'TTS' ? getTtsSales15(shopCode, platformSku) : getMkdSales15(shopCode, platformSku);

    if (!trendAccum.has(whSkuKey)) {
      trendAccum.set(whSkuKey, {
        ttsAr30: 0, ttsAr15: 0,
        ttsNe30: 0, ttsNe15: 0,
        ttsSj30: 0, ttsSj15: 0,
        mkdAr30: 0, mkdAr15: 0,
        mkdNe30: 0, mkdNe15: 0,
        brand: getBrand(whSkuKey),
      });
    }
    const acc = trendAccum.get(whSkuKey)!;

    if (platform === 'TTS') {
      if (shopCode === 'MX-AR') { acc.ttsAr30 += s30; acc.ttsAr15 += s15; }
      else if (shopCode === 'MX-NE') { acc.ttsNe30 += s30; acc.ttsNe15 += s15; }
      else if (shopCode === 'MX-SJ') { acc.ttsSj30 += s30; acc.ttsSj15 += s15; }
    } else {
      if (shopCode === 'MX-AR') { acc.mkdAr30 += s30; acc.mkdAr15 += s15; }
      else if (shopCode === 'MX-NE') { acc.mkdNe30 += s30; acc.mkdNe15 += s15; }
    }
  }

  for (const [whSku, acc] of Array.from(trendAccum)) {
    const ttsS30Total = acc.ttsAr30 + acc.ttsNe30 + acc.ttsSj30;
    const mkdS30Total = acc.mkdAr30 + acc.mkdNe30;
    const allS30 = ttsS30Total + mkdS30Total;
    const ttsS15Total = acc.ttsAr15 + acc.ttsNe15 + acc.ttsSj15;
    const mkdS15Total = acc.mkdAr15 + acc.mkdNe15;
    const allS15 = ttsS15Total + mkdS15Total;
    const prev15 = allS30 - allS15;

    let trendLabel = '';
    if (allS30 === 0) {
      trendLabel = '⚫ 无销量';
    } else if (allS15 > prev15 * 1.5 && allS15 > 5) {
      trendLabel = '📈 加速上升';
    } else if (allS15 > prev15 * 1.2 && allS15 > 3) {
      trendLabel = '📈 上升';
    } else if (prev15 > allS15 * 1.5 && prev15 > 5) {
      trendLabel = '📉 加速下滑';
    } else if (prev15 > allS15 * 1.2 && prev15 > 3) {
      trendLabel = '📉 下滑';
    } else {
      trendLabel = '➡️ 平稳';
    }

    let hot = '-';
    let hotLevel: StatusLevel = 'gray';
    const isRising = trendLabel.includes('上升');
    const isDeclining = trendLabel.includes('下滑');
    if (isRising && allS30 >= 20) { hot = '🔥 爆品'; hotLevel = 'red'; }
    else if (isDeclining && allS30 >= 10) { hot = '⚠️ 注意下滑'; hotLevel = 'yellow'; }

    trend.push({
      seller_sku: whSku,
      brand: acc.brand,
      all_s30: allS30,
      all_s15: allS15,
      prev15,
      tts_ar_s30: acc.ttsAr30,
      tts_ne_s30: acc.ttsNe30,
      tts_sj_s30: acc.ttsSj30,
      mkd_ar_s30: acc.mkdAr30,
      mkd_ne_s30: acc.mkdNe30,
      tts_s30: ttsS30Total,
      mkd_s30: mkdS30Total,
      trend: trendLabel,
      hot,
      hot_level: hotLevel,
    });
  }

  // 按 30天总销量降序
  trend.sort((a, b) => b.all_s30 - a.all_s30);

  // ── 7. SKU 匹配表 ────────────────────────────────────────────────────────

  const skuMatch: SkuMatchRow[] = [];

  for (const lb of listingBases) {
    const mapping = lookupMapping(mappingDict, lb.shop, lb.platform, lb.seller_sku);
    const allS30 = lb.platform === 'TTS'
      ? getTtsSales30(lb.shop, lb.seller_sku)
      : getMkdSales30(lb.shop, lb.seller_sku);
    const daily = allS30 / 30;

    let whQty = 0;          // 产品库存（成品直接库存）
    let whAssembleQty = 0;  // 可组合数量（单品拆解可组合的数量）
    let whSkuDisplay = '';
    let whSkuMatched = false;
    let whSkuType: SkuMatchRow['wh_sku_type'] = 'none';
    let whSupplement = 0;

    if (mapping) {
      const whInfo = resolveWhQty(mapping, whDict);
      whSkuDisplay = whInfo.whSkuDisplay;
      whSkuMatched = whInfo.type !== 'none';
      whSkuType = whInfo.type;
      whSupplement = whInfo.supplement;

      // 根据类型分配产品库存和可组合数量
      if (whInfo.type === 'single' || whInfo.type === 'direct') {
        // 单品或成品直接：产品库存 = 成品库存，无可组合
        whQty = whInfo.directQty;
        whAssembleQty = 0;
      } else if (whInfo.type === 'insufficient') {
        // 成品+单品：产品库存 = 成品库存，可组合 = 单品可拆解数量
        whQty = whInfo.directQty;
        whAssembleQty = whInfo.compExtra;
      } else if (whInfo.type === 'assembled') {
        // 纯拆解：产品库存 = 0，可组合 = 单品可拆解数量
        whQty = 0;
        whAssembleQty = whInfo.compExtra;
      }
    }

    const whTotalQty = whQty + whAssembleQty;
    const daysOfStock = daily > 0 ? Math.round(whQty / daily) : 9999;
    const daysOfTotal = daily > 0 ? Math.round(whTotalQty / daily) : 9999;

    skuMatch.push({
      platform: lb.platform,
      shop: lb.shop,
      seller_sku: lb.seller_sku,
      product_id: lb.listing_id,
      sku_id: lb.sku_id,
      wh_sku: whSkuDisplay,
      wh_sku_matched: whSkuMatched,
      wh_sku_type: whSkuType,
      wh_supplement: whSupplement,
      platform_qty: lb.platform_qty,
      wh_qty: whQty,
      wh_assemble_qty: whAssembleQty,
      wh_total_qty: whTotalQty,
      days_of_stock: daysOfStock,
      days_of_total: daysOfTotal,
    });
  }

  // ── 8. 统计 KPI ──────────────────────────────────────────────────────────

  const allSkusCount = new Set([
    ...Array.from(mappingDict.values()).map(m => m.platformSku),
  ]).size;

  const stats: AnalysisStats = {
    totalSkus: allSkusCount,
    totalListings: listingAdj.length,
    urgentCount: listingAdj.filter(r => r.status_level === 'red').length,
    hotCount: trend.filter(r => r.hot === '🔥 爆品').length,
    declineCount: trend.filter(r => r.hot === '⚠️ 注意下滑').length,
    purchaseNeeded: purchase.filter(r => r.suggest_purchase > 0).length,
    dataDate: today.toISOString().slice(0, 10),
    ttsShops: ttsShopsFound,
    mkdShops: mkdShopsFound,
  };

  return { listingAdj, purchase, trend, skuMatch, stats };
}

// ─── CSV 导出工具 ────────────────────────────────────────────────────────────

export function exportCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const v = String(row[h] ?? '');
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"`
          : v;
      }).join(',')
    ),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
