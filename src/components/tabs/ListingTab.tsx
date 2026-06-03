/**
 * Listing 调整建议 Tab
 * Design: Precision Data Terminal
 *
 * 功能：
 * - SKU 维度汇总行（每个 SKU 的 N 个 Listing 合并统计）
 * - 状态过滤（全部/红/黄/绿/灰）
 * - 平台过滤（全部/TTS/MKD）
 * - SKU 搜索
 * - 调整后库存手填 → 实时计算调整后可售天数
 * - 建议调整合并列（正数=补货，负数=扣减）
 * - 库存余量列（仓库库存 - SUM各店铺库存）
 * - 全局资源池联动：以海外仓 SKU 为维度维护实时可用库存表，
 *   所有 Listing 的调整后库存从资源池扣减，多层联动自动更新可用量和可售天数
 * - CSV 导出
 */
import { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { exportCsv } from '@/lib/analyzer';
import type { ListingRow, StatusLevel } from '@/lib/analyzer';
import { Search, Download, Info, ChevronDown, ChevronRight } from 'lucide-react';

function StatusBadge({ level, text }: { level: StatusLevel; text: string }) {
  const clean = text.replace(/^[🔴🟡🟢🟠⚪📈📉➡️⚫🔥⚠️]\s*/, '');
  return <span className={`badge-${level}`}>{clean}</span>;
}

function DaysCell({ days, daily }: { days: number; daily: number }) {
  if (daily === 0) return <span style={{ color: 'oklch(0.65 0.010 250)', fontSize: '0.76rem' }}>∞</span>;
  if (days >= 9990) return <span className="days-blue font-mono" style={{ fontSize: '0.78rem' }}>∞</span>;
  const cls = days < 15 ? 'days-red' : days < 30 ? 'days-yellow' : days > 90 ? 'days-blue' : 'days-green';
  return <span className={`${cls} font-mono`} style={{ fontSize: '0.78rem' }}>{days}天</span>;
}

/**
 * AdjustCell：调整后库存输入框 + 动态可售天数 + 需组装提示
 * effectiveWhTotal：资源池计算后该 Listing 的实际可用量
 * assembleNeeded：当调整后库存超出成品时，需从单品组装的数量
 */
function AdjustCell({
  row,
  adjustedQty,
  setAdjustedQty,
  effectiveWhTotal,
  assembleNeeded,
}: {
  row: ListingRow;
  adjustedQty: Record<string, number>;
  setAdjustedQty: (k: string, v: number) => void;
  effectiveWhTotal: number;
  assembleNeeded: number;
}) {
  const key = `${row.platform}-${row.listing_id}-${row.seller_sku}`;
  const adjQty = adjustedQty[key];
  const hasAdj = adjQty !== undefined && adjQty >= 0;

  // 调整后可售天数：基于调整后库存和该 Listing 日均销量
  const adjDays = hasAdj && row.listing_daily > 0
    ? Math.round(adjQty / row.listing_daily)
    : null;

  // 动态可用天数：当资源池被其他 Listing 占用时，显示当前实际可用天数
  const effectiveDays = row.listing_daily > 0
    ? Math.round(effectiveWhTotal / row.listing_daily)
    : null;
  const showEffective = effectiveWhTotal !== row.wh_total && effectiveDays !== null && !hasAdj;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input
        type="number"
        min={0}
        placeholder={String(row.platform_qty)}
        value={hasAdj ? adjQty : ''}
        onChange={e => {
          const v = parseInt(e.target.value);
          if (!isNaN(v) && v >= 0) setAdjustedQty(key, v);
          else setAdjustedQty(key, -1);
        }}
        className="w-16 px-1.5 py-0.5 rounded text-right"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.75rem',
          border: '1px solid oklch(0.88 0.006 240)',
          backgroundColor: hasAdj ? 'oklch(0.97 0.008 250)' : 'oklch(0.99 0.002 250)',
          color: 'oklch(0.22 0.018 250)',
          outline: 'none',
        }}
      />
      {/* 调整后可售天数（动态更新） */}
      {adjDays !== null && adjDays >= 0 && (
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.72rem',
          color: adjDays < 15 ? 'oklch(0.50 0.20 25)' : adjDays < 30 ? 'oklch(0.52 0.16 85)' : 'oklch(0.45 0.14 145)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          →{adjDays}天
        </span>
      )}
      {/* 需组装提示：当调整后库存超出成品时 */}
      {hasAdj && assembleNeeded > 0 && (
        <span style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: '0.66rem',
          color: 'oklch(0.48 0.18 55)',
          whiteSpace: 'nowrap',
          backgroundColor: 'oklch(0.97 0.018 55)',
          padding: '1px 4px',
          borderRadius: '3px',
          border: '1px solid oklch(0.88 0.025 55)',
        }}>
          需组装{assembleNeeded}件
        </span>
      )}
      {/* 实际可用天数标注（当资源池被其他 Listing 占用导致可用量减少时） */}
      {showEffective && (
        <span style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: '0.66rem',
          color: 'oklch(0.52 0.16 85)',
          whiteSpace: 'nowrap',
          backgroundColor: 'oklch(0.97 0.020 85)',
          padding: '1px 3px',
          borderRadius: '3px',
        }}>
          实可{effectiveDays}天
        </span>
      )}
    </div>
  );
}

/**
 * BundleNote：显示组合品的库存来源说明
 * 使用资源池计算后的有效可用量
 */
function BundleNote({
  row,
  effectiveWhTotal,
  effectiveComp1,
  effectiveComp2,
}: {
  row: ListingRow;
  effectiveWhTotal: number;
  effectiveComp1: number;
  effectiveComp2: number;
}) {
  // 情况2：有成品+子SKU可补充（insufficient）
  if (row.wh_sku_type === 'insufficient') {
    const directQty = row.wh_direct_qty ?? 0;
    const canAssemble = row.comp1 && row.comp2
      ? Math.min(effectiveComp1, effectiveComp2)
      : row.comp1 ? effectiveComp1 : effectiveComp2;
    const totalAvail = directQty + canAssemble;
    const isFullCover = totalAvail >= row.platform_qty;
    const parts: string[] = [];
    if (row.comp1) parts.push(`${row.comp1}×${effectiveComp1}`);
    if (row.comp2) parts.push(`${row.comp2}×${effectiveComp2}`);
    return (
      <span style={{
        fontSize: '0.68rem',
        color: isFullCover ? 'oklch(0.50 0.16 145)' : 'oklch(0.52 0.16 85)',
        fontFamily: '"Noto Sans SC", sans-serif',
        whiteSpace: 'nowrap',
        backgroundColor: isFullCover ? 'oklch(0.96 0.020 145)' : 'oklch(0.96 0.025 85)',
        padding: '1px 4px',
        borderRadius: '3px',
      }}>
        {isFullCover
          ? `✅ 成品${directQty}+可组${canAssemble}`
          : `⚠️ 成品${directQty}+可组${canAssemble}`}
        {parts.length > 0 && <span style={{ opacity: 0.75 }}> ({parts.join(', ')})</span>}
      </span>
    );
  }

  // 情况3：只有子SKU（assembled）
  if (row.wh_sku_type === 'assembled') {
    const canAssemble = row.comp1 && row.comp2
      ? Math.min(effectiveComp1, effectiveComp2)
      : row.comp1 ? effectiveComp1 : effectiveComp2;
    const parts: string[] = [];
    if (row.comp1) parts.push(`${row.comp1}×${effectiveComp1}`);
    if (row.comp2) parts.push(`${row.comp2}×${effectiveComp2}`);
    return (
      <span style={{
        fontSize: '0.68rem',
        color: canAssemble > 0 ? 'oklch(0.48 0.16 55)' : 'oklch(0.55 0.012 250)',
        fontFamily: '"Noto Sans SC", sans-serif',
        whiteSpace: 'nowrap',
        backgroundColor: canAssemble > 0 ? 'oklch(0.97 0.015 55)' : 'oklch(0.96 0.004 240)',
        padding: '1px 4px',
        borderRadius: '3px',
      }}>
        {canAssemble > 0 ? `[拆解] 可组${canAssemble}件` : '[拆解] 单品库存不足'}
        {parts.length > 0 && <span style={{ opacity: 0.75 }}> ({parts.join(', ')})</span>}
      </span>
    );
  }

  return null;
}

// 库存类型标签
function SkuCategoryBadge({ category }: { category: 'single' | 'bundle_with_parts' | 'parts_only' }) {
  if (category === 'bundle_with_parts') {
    return (
      <span style={{
        fontSize: '0.62rem',
        fontFamily: '"Noto Sans SC", sans-serif',
        color: 'oklch(0.42 0.16 250)',
        backgroundColor: 'oklch(0.95 0.018 250)',
        border: '1px solid oklch(0.85 0.025 250)',
        padding: '1px 4px',
        borderRadius: '3px',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}>
        成套+拆解
      </span>
    );
  }
  if (category === 'parts_only') {
    return (
      <span style={{
        fontSize: '0.62rem',
        fontFamily: '"Noto Sans SC", sans-serif',
        color: 'oklch(0.46 0.16 55)',
        backgroundColor: 'oklch(0.96 0.018 55)',
        border: '1px solid oklch(0.88 0.025 55)',
        padding: '1px 4px',
        borderRadius: '3px',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}>
        纯拆解
      </span>
    );
  }
  // single
  return (
    <span style={{
      fontSize: '0.62rem',
      fontFamily: '"Noto Sans SC", sans-serif',
      color: 'oklch(0.48 0.012 250)',
      backgroundColor: 'oklch(0.96 0.004 240)',
      border: '1px solid oklch(0.90 0.006 240)',
      padding: '1px 4px',
      borderRadius: '3px',
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      单品
    </span>
  );
}

// 库存余量颜色
function SurplusCell({ surplus }: { surplus: number }) {
  const color = surplus < 0 ? 'oklch(0.50 0.20 25)' : surplus === 0 ? 'oklch(0.55 0.012 250)' : 'oklch(0.42 0.14 145)';
  return (
    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem', fontWeight: 600, color }}>
      {surplus >= 0 ? '+' : ''}{surplus.toLocaleString()}
    </span>
  );
}

// 建议调整合并列（正=补货，负=扣减）
function SuggestAdjCell({ add, reduce }: { add: number; reduce: number }) {
  if (add > 0) return <span className="adjust-pos font-mono" style={{ fontSize: '0.78rem' }}>+{add}</span>;
  if (reduce > 0) return <span className="adjust-neg font-mono" style={{ fontSize: '0.78rem' }}>-{reduce}</span>;
  return <span style={{ color: 'oklch(0.70 0.008 250)', fontSize: '0.75rem' }}>—</span>;
}

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'red', label: '紧急' },
  { key: 'yellow', label: '建议' },
  { key: 'green', label: '充足' },
  { key: 'gray', label: '无销量' },
];

const PLATFORM_FILTERS = [
  { key: 'all', label: '全平台' },
  { key: 'TTS', label: 'TTS' },
  { key: 'MKD', label: '美客多' },
];

// SKU 汇总行数据
interface SkuSummary {
  seller_sku: string;
  brand: string;
  wh_total: number;
  total_platform_qty: number;
  stock_surplus: number;
  listing_count: number;
  max_status_level: StatusLevel;
  has_adjust: boolean;
  summary_note: string;
}

function computeSkuSummaries(rows: ListingRow[]): Map<string, SkuSummary> {
  const map = new Map<string, SkuSummary>();
  for (const row of rows) {
    const existing = map.get(row.seller_sku);
    if (!existing) {
      map.set(row.seller_sku, {
        seller_sku: row.seller_sku,
        brand: row.brand,
        wh_total: row.wh_total,
        total_platform_qty: row.platform_qty,
        stock_surplus: row.stock_surplus,
        listing_count: 1,
        max_status_level: row.status_level,
        has_adjust: row.suggest_add > 0 || row.suggest_reduce > 0,
        summary_note: '',
      });
    } else {
      existing.total_platform_qty += row.platform_qty;
      existing.listing_count += 1;
      existing.has_adjust = existing.has_adjust || row.suggest_add > 0 || row.suggest_reduce > 0;
      const levelOrder: Record<StatusLevel, number> = { red: 4, orange: 3, yellow: 2, green: 1, gray: 0 };
      if ((levelOrder[row.status_level] ?? 0) > (levelOrder[existing.max_status_level] ?? 0)) {
        existing.max_status_level = row.status_level;
      }
    }
  }
  for (const [, s] of Array.from(map)) {
    s.stock_surplus = s.wh_total - s.total_platform_qty;
    if (s.stock_surplus > 0) {
      s.summary_note = `尚余 ${s.stock_surplus} 件在仓库未分配`;
    } else if (s.stock_surplus < 0) {
      s.summary_note = `⚠️ 超卖 ${Math.abs(s.stock_surplus)} 件`;
    } else {
      s.summary_note = '分配合理';
    }
  }
  return map;
}

/**
 * 全局资源池计算
 *
 * 以海外仓 SKU 为维度，维护实时可用库存表（whPool）。
 * 所有 Listing 的调整后库存（或当前平台库存）从资源池中扣减，
 * 实现多层联动：
 *   - 成品 Listing 调整后库存 → 优先消耗成品库存，超出部分消耗单品库存
 *   - 单品库存减少 → 影响所有引用该单品的组合品 Listing 可组装数量
 *   - 组合品 Listing 调整 → 影响单品 Listing 的可用量和可售天数
 *
 * 返回：
 *   effectiveWhTotals: Map<listingKey, effectiveWhTotal>  每个 Listing 的有效可用量
 *   effectiveComp1s:   Map<listingKey, comp1可用量>
 *   effectiveComp2s:   Map<listingKey, comp2可用量>
 *   assembleNeededs:   Map<listingKey, 需组装数量>（当调整后库存超出成品时）
 *   whPool:            Map<whSku, 剩余可用库存>（用于调试/展示）
 */
interface PoolResult {
  effectiveWhTotals: Map<string, number>;
  effectiveComp1s: Map<string, number>;
  effectiveComp2s: Map<string, number>;
  assembleNeededs: Map<string, number>;
}

function computeWhPool(
  rows: ListingRow[],
  adjustedQty: Record<string, number>
): PoolResult {
  // Step 1：初始化资源池（原始仓库库存）
  // 收集所有涉及的海外仓 SKU 及其原始库存
  const rawPool = new Map<string, number>();
  for (const row of rows) {
    if (row.wh_sku1 && row.wh_raw_qty !== undefined) {
      if (!rawPool.has(row.wh_sku1)) {
        rawPool.set(row.wh_sku1, row.wh_raw_qty);
      }
    }
    if (row.comp1 && row.comp1_raw_qty !== undefined) {
      if (!rawPool.has(row.comp1)) {
        rawPool.set(row.comp1, row.comp1_raw_qty);
      }
    }
    if (row.comp2 && row.comp2_raw_qty !== undefined) {
      if (!rawPool.has(row.comp2)) {
        rawPool.set(row.comp2, row.comp2_raw_qty);
      }
    }
  }

  // Step 2：按 Listing 计算每个 Listing 对资源池的占用
  // 占用量 = adjustedQty（若有）或 platform_qty
  // 扣减规则：
  //   single/direct：从 wh_sku1 扣减
  //   insufficient：优先从 wh_sku1 扣减，超出部分从 comp1+comp2 各扣减
  //   assembled：从 comp1 和 comp2 各扣减

  // 先计算每个 Listing 的占用量和扣减方案
  interface ListingAlloc {
    listingKey: string;
    row: ListingRow;
    demandQty: number;       // 需求量（adjustedQty 或 platform_qty）
    fromDirect: number;      // 从成品扣减量
    fromComp: number;        // 从单品扣减量（需组装数量）
  }

  const allocs: ListingAlloc[] = [];
  for (const row of rows) {
    const listingKey = `${row.platform}-${row.listing_id}-${row.seller_sku}`;
    const adjQty = adjustedQty[listingKey];
    const demandQty = (adjQty !== undefined && adjQty >= 0) ? adjQty : row.platform_qty;

    let fromDirect = 0;
    let fromComp = 0;

    if (row.wh_sku_type === 'single' || row.wh_sku_type === 'direct') {
      // 只有成品，全部从成品扣
      fromDirect = demandQty;
      fromComp = 0;
    } else if (row.wh_sku_type === 'insufficient') {
      // 成品+单品：优先消耗成品，超出部分从单品组装
      const directAvail = row.wh_raw_qty ?? 0;
      fromDirect = Math.min(demandQty, directAvail);
      fromComp = Math.max(0, demandQty - fromDirect);
    } else if (row.wh_sku_type === 'assembled') {
      // 纯拆解：全部从单品组装
      fromDirect = 0;
      fromComp = demandQty;
    } else {
      // none 或其他：不扣减
      fromDirect = 0;
      fromComp = 0;
    }

    allocs.push({ listingKey, row, demandQty, fromDirect, fromComp });
  }

  // Step 3：从资源池中扣减，计算每个 Listing 处理后的剩余池
  // 注意：这里需要按顺序扣减，先处理成品，再处理单品
  // 但由于用户可能同时调整多个 Listing，我们采用"全量重算"策略：
  // 对每个 Listing，计算其他所有 Listing 扣减后，该 Listing 剩余的可用量

  const effectiveWhTotals = new Map<string, number>();
  const effectiveComp1s = new Map<string, number>();
  const effectiveComp2s = new Map<string, number>();
  const assembleNeededs = new Map<string, number>();

  for (const targetAlloc of allocs) {
    const { listingKey, row } = targetAlloc;

    // 计算其他所有 Listing 对资源池的占用（不含当前 Listing）
    const poolAfterOthers = new Map(rawPool);

    for (const otherAlloc of allocs) {
      if (otherAlloc.listingKey === listingKey) continue;
      const { row: otherRow, fromDirect, fromComp } = otherAlloc;

      // 扣减成品
      if (otherRow.wh_sku1 && fromDirect > 0) {
        const cur = poolAfterOthers.get(otherRow.wh_sku1) ?? 0;
        poolAfterOthers.set(otherRow.wh_sku1, Math.max(0, cur - fromDirect));
      }

      // 扣减单品（comp1 和 comp2 各扣减 fromComp）
      if (otherRow.comp1 && fromComp > 0) {
        const cur = poolAfterOthers.get(otherRow.comp1) ?? 0;
        poolAfterOthers.set(otherRow.comp1, Math.max(0, cur - fromComp));
      }
      if (otherRow.comp2 && fromComp > 0) {
        const cur = poolAfterOthers.get(otherRow.comp2) ?? 0;
        poolAfterOthers.set(otherRow.comp2, Math.max(0, cur - fromComp));
      }
    }

    // 当前 Listing 在资源池中的可用量
    const directAvail = row.wh_sku1 ? (poolAfterOthers.get(row.wh_sku1) ?? 0) : 0;
    const comp1Avail = row.comp1 ? (poolAfterOthers.get(row.comp1) ?? 0) : 0;
    const comp2Avail = row.comp2 ? (poolAfterOthers.get(row.comp2) ?? 0) : 0;

    effectiveComp1s.set(listingKey, comp1Avail);
    effectiveComp2s.set(listingKey, comp2Avail);

    // 计算有效总可用量
    let effectiveTotal = 0;
    if (row.wh_sku_type === 'single' || row.wh_sku_type === 'direct') {
      effectiveTotal = directAvail;
    } else if (row.wh_sku_type === 'insufficient') {
      const canAssemble = row.comp1 && row.comp2
        ? Math.min(comp1Avail, comp2Avail)
        : row.comp1 ? comp1Avail : comp2Avail;
      effectiveTotal = directAvail + canAssemble;
    } else if (row.wh_sku_type === 'assembled') {
      effectiveTotal = row.comp1 && row.comp2
        ? Math.min(comp1Avail, comp2Avail)
        : row.comp1 ? comp1Avail : comp2Avail;
    } else {
      effectiveTotal = row.wh_total;
    }

    effectiveWhTotals.set(listingKey, effectiveTotal);

    // 计算需组装数量（当用户填入调整后库存时）
    const adjQty = adjustedQty[listingKey];
    const hasAdj = adjQty !== undefined && adjQty >= 0;
    if (hasAdj && (row.wh_sku_type === 'insufficient' || row.wh_sku_type === 'assembled')) {
      const directForThis = row.wh_sku_type === 'insufficient'
        ? Math.min(adjQty, directAvail)
        : 0;
      const needed = Math.max(0, adjQty - directForThis);
      assembleNeededs.set(listingKey, needed);
    } else {
      assembleNeededs.set(listingKey, 0);
    }
  }

  return { effectiveWhTotals, effectiveComp1s, effectiveComp2s, assembleNeededs };
}

export default function ListingTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { result, adjustedQty, setAdjustedQty } = useApp() as any;
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [collapsedSkus, setCollapsedSkus] = useState<Set<string>>(new Set());

  const rows: ListingRow[] = result?.listingAdj ?? [];

  // 全局资源池计算（每次 adjustedQty 变化时重新计算）
  const poolResult = useMemo(
    () => computeWhPool(rows, adjustedQty),
    [rows, adjustedQty]
  );
  const { effectiveWhTotals, effectiveComp1s, effectiveComp2s, assembleNeededs } = poolResult;

  // 过滤后的行
  const filtered = useMemo(() => {
    return rows.filter(row => {
      if (statusFilter !== 'all' && row.status_level !== statusFilter) return false;
      if (platformFilter === 'TTS' && row.platform !== 'TTS') return false;
      if (platformFilter === 'MKD' && row.platform !== 'MKD') return false;
      if (search) {
        const q = search.toLowerCase();
        if (!row.seller_sku.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, platformFilter, search]);

  // 统一按 seller_sku 分组
  const groupedSkus = useMemo(() => {
    const order: string[] = [];
    const groups = new Map<string, ListingRow[]>();
    for (const row of filtered) {
      const key = row.seller_sku;
      if (!groups.has(key)) {
        order.push(key);
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }
    return { order, groups };
  }, [filtered]);

  // SKU 汇总（基于全量数据，不受过滤影响）
  const skuSummaries = useMemo(() => computeSkuSummaries(rows), [rows]);

  const toggleCollapse = (sku: string) => {
    setCollapsedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const handleExport = useCallback(() => {
    const data = filtered.map(row => {
      const key = `${row.platform}-${row.listing_id}-${row.seller_sku}`;
      const adjQty = adjustedQty[key];
      const hasAdj = adjQty !== undefined && adjQty >= 0;
      const adjDays = hasAdj && row.listing_daily > 0 ? Math.round(adjQty / row.listing_daily) : '';
      const effectiveWh = effectiveWhTotals.get(key) ?? row.wh_total;
      const assembleNeeded = assembleNeededs.get(key) ?? 0;
      return {
        平台: row.platform,
        店铺: row.shop,
        'Seller SKU': row.seller_sku,
        'Listing ID': row.listing_id,
        平台库存: row.platform_qty,
        仓库总库存: row.wh_total,
        动态可用库存: effectiveWh !== row.wh_total ? effectiveWh : '',
        库存余量: row.stock_surplus,
        日均销量: row.listing_daily,
        当前可售天数: row.days_of_stock >= 9990 ? '∞' : row.days_of_stock,
        状态: row.status.replace(/^[🔴🟡🟢🟠⚪]\s*/, ''),
        建议调整: row.suggest_add > 0 ? `+${row.suggest_add}` : row.suggest_reduce > 0 ? `-${row.suggest_reduce}` : '—',
        调整后库存: hasAdj ? adjQty : '',
        调整后可售天数: adjDays,
        需组装数量: assembleNeeded > 0 ? assembleNeeded : '',
        SKU类型: row.wh_sku_type,
        海外仓SKU1: row.wh_sku1 ?? '',
        组合品1: row.comp1 ?? '',
        组合品2: row.comp2 ?? '',
      };
    });
    exportCsv(data, `listing_adjustment_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [filtered, adjustedQty, effectiveWhTotals, assembleNeededs]);

  const filterBtnStyle = (active: boolean, color?: string) => ({
    fontFamily: '"Noto Sans SC", sans-serif',
    fontWeight: active ? 600 : 400,
    fontSize: '0.72rem',
    padding: '3px 10px',
    borderRadius: '5px',
    transition: 'all 0.15s',
    backgroundColor: active ? (color ?? 'oklch(0.50 0.18 250)') : 'oklch(0.97 0.004 240)',
    color: active ? 'oklch(0.98 0 0)' : 'oklch(0.40 0.015 250)',
    border: '1px solid',
    borderColor: active ? (color ?? 'oklch(0.50 0.18 250)') : 'oklch(0.90 0.006 240)',
    cursor: 'pointer',
  });

  const mono = { fontFamily: '"JetBrains Mono", monospace' };
  const sans = { fontFamily: '"Noto Sans SC", sans-serif' };

  return (
    <div className="flex flex-col h-full gap-2">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 状态过滤 */}
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={filterBtnStyle(statusFilter === f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 平台过滤 */}
        <div className="flex items-center gap-1">
          {PLATFORM_FILTERS.map(f => (
            <button key={f.key} onClick={() => setPlatformFilter(f.key)} style={filterBtnStyle(platformFilter === f.key, 'oklch(0.46 0.16 250)')}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 搜索 */}
        <div className="relative" style={{ maxWidth: '220px' }}>
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'oklch(0.60 0.012 250)' }} />
          <input
            type="text"
            placeholder="搜索 SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1 rounded-md"
            style={{ ...mono, fontSize: '0.72rem', border: '1px solid oklch(0.90 0.006 240)', backgroundColor: 'oklch(1 0 0)', color: 'oklch(0.22 0.018 250)', outline: 'none' }}
          />
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs"
          style={{ ...sans, color: 'oklch(0.50 0.015 250)', backgroundColor: 'oklch(0.97 0.004 240)', border: '1px solid oklch(0.90 0.006 240)', fontSize: '0.72rem' }}
        >
          <Info size={11} />说明
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md"
          style={{ ...sans, fontSize: '0.72rem', color: 'oklch(0.38 0.16 250)', backgroundColor: 'oklch(0.96 0.04 250)', border: '1px solid oklch(0.80 0.10 250)' }}
        >
          <Download size={11} />
          导出 ({filtered.length})
        </button>
      </div>

      {/* 说明面板 */}
      {showInfo && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'oklch(0.97 0.008 250)', border: '1px solid oklch(0.88 0.012 250)', color: 'oklch(0.35 0.015 250)', ...sans, lineHeight: 1.8 }}>
          <strong>调整建议：</strong>
          🔴 超卖（平台库存 &gt; 仓库库存）→ 按日均比例分配 ｜
          🔴 缺货/可售&lt;15天 → 补至30天目标 ｜
          🟡 可售15~30天 → 建议补货 ｜
          🟡 可售&gt;90天且同SKU有≤60天链接 → 建议扣减（美客多不扣减）｜
          🟢 充足（30~90天）<br />
          <strong>库存余量</strong> = 仓库总库存 - 各平台上架库存合计（正数=仓库有剩余，负数=超卖）<br />
          <strong>全局资源池联动</strong>：以海外仓 SKU 为维度实时计算可用库存。调整组合品库存时，优先消耗成品，超出部分从单品组装（显示「需组装N件」），自动影响所有引用该单品的其他 Listing 的可用量和可售天数。
        </div>
      )}

      {/* 数据表格 */}
      <div
        className="flex-1 rounded-lg scrollbar-thin"
        style={{ border: '1px solid oklch(0.91 0.005 240)', backgroundColor: 'oklch(1 0 0)', maxHeight: 'calc(100vh - 260px)', overflowX: 'auto', overflowY: 'auto' }}
      >
        <table className="data-table" style={{ fontSize: '0.78rem', tableLayout: 'fixed', width: '100%', minWidth: '1620px' }}>
          <colgroup>
            <col style={{ width: '56px' }} />   {/* 平台 */}
            <col style={{ width: '66px' }} />   {/* 店铺 */}
            <col />                              {/* SELLER SKU：自动填满剩余宽度 */}
            <col style={{ width: '196px' }} />  {/* LISTING ID */}
            <col style={{ width: '196px' }} />  {/* SKU ID */}
            <col style={{ width: '72px' }} />   {/* 平台库 */}
            <col style={{ width: '80px' }} />   {/* 仓库库存 */}
            <col style={{ width: '80px' }} />   {/* 余量 */}
            <col style={{ width: '60px' }} />   {/* 日均 */}
            <col style={{ width: '60px' }} />   {/* 15天 */}
            <col style={{ width: '60px' }} />   {/* 30天 */}
            <col style={{ width: '80px' }} />   {/* 平台库存可售天 */}
            <col style={{ width: '76px' }} />   {/* 库存类型 */}
            <col style={{ width: '190px' }} />  {/* 调整建议 */}
            <col style={{ width: '80px' }} />   {/* 建议调整 */}
            <col style={{ width: '160px' }} />  {/* 调整后库存 */}
          </colgroup>
          <thead>
            <tr>
              <th>平台</th>
              <th>店铺</th>
              <th>SELLER SKU</th>
              <th>LISTING ID</th>
              <th>SKU ID</th>
              <th style={{ textAlign: 'right' }}>平台库</th>
              <th style={{ textAlign: 'right' }}>仓库存</th>
              <th style={{ textAlign: 'right' }}>余量</th>
              <th style={{ textAlign: 'right' }}>日均</th>
              <th style={{ textAlign: 'right' }}>15天</th>
              <th style={{ textAlign: 'right' }}>30天</th>
              <th style={{ textAlign: 'right' }}>平台可售天</th>
              <th style={{ textAlign: 'center' }}>库存类型</th>
              <th>调整建议</th>
              <th style={{ textAlign: 'right' }}>建议</th>
              <th>调整后库存</th>
            </tr>
          </thead>
          <tbody>
            {groupedSkus.order.length === 0 ? (
              <tr>
                <td colSpan={16} style={{ textAlign: 'center', padding: '28px', color: 'oklch(0.60 0.012 250)' }}>
                  暂无数据
                </td>
              </tr>
            ) : groupedSkus.order.map(sku => {
              void 0; // placeholder
              const skuRows = groupedSkus.groups.get(sku)!;
              const summary = skuSummaries.get(sku);
              const isCollapsed = collapsedSkus.has(sku);
              const hasMultiple = skuRows.length > 1;

              // 汇总行：实时计算调整后平台库存和超卖状态
              const adjTotalPlatform = skuRows.reduce((sum, r) => {
                const k = `${r.platform}-${r.listing_id}-${r.seller_sku}`;
                const adj = adjustedQty[k];
                return sum + (adj !== undefined && adj >= 0 ? adj : r.platform_qty);
              }, 0);
              // 汇总行余量使用原装成品库存（wh_direct_qty），不包含单品拆解部分
              // 单品：wh_direct_qty = wh_total；成套+拆解：wh_direct_qty = 成品库存；纯拆解：wh_direct_qty = 0
              const firstListingKey = skuRows[0]
                ? `${skuRows[0].platform}-${skuRows[0].listing_id}-${skuRows[0].seller_sku}`
                : '';
              const whTotalForSku = skuRows[0]?.wh_direct_qty ?? skuRows[0]?.wh_total ?? 0;
              const adjSurplus = whTotalForSku - adjTotalPlatform;
              const adjSummaryNote = adjSurplus > 0
                ? `尚余 ${adjSurplus} 件在仓库未分配`
                : adjSurplus < 0
                ? `⚠️ 超卖 ${Math.abs(adjSurplus)} 件`
                : '分配合理';
              const hasAnyAdj = skuRows.some(r => {
                const k = `${r.platform}-${r.listing_id}-${r.seller_sku}`;
                return adjustedQty[k] !== undefined && adjustedQty[k] >= 0;
              });

              // 抑制未使用变量警告
              void summary;

              return [
                // 明细行
                ...(!isCollapsed ? skuRows.map((row, i) => {
                  const rowBgClass = row.status_level === 'red' ? 'row-red'
                    : row.status_level === 'orange' ? 'row-orange'
                    : row.status_level === 'yellow' ? 'row-amber'
                    : '';
                  const listingKey = `${row.platform}-${row.listing_id}-${row.seller_sku}`;
                  const effectiveWh = effectiveWhTotals.get(listingKey) ?? row.wh_total;
                  const comp1Avail = effectiveComp1s.get(listingKey) ?? (row.comp1_raw_qty ?? 0);
                  const comp2Avail = effectiveComp2s.get(listingKey) ?? (row.comp2_raw_qty ?? 0);
                  const assembleNeeded = assembleNeededs.get(listingKey) ?? 0;

                  return (
                    <tr key={`${sku}-${i}`} className={rowBgClass}>
                      <td>
                        <span className={`badge-${row.platform === 'TTS' ? 'tts' : 'mkd'}`}>
                          {row.platform}
                        </span>
                      </td>
                      <td style={{ ...mono, fontSize: '0.72rem', color: 'oklch(0.48 0.015 250)' }}>
                        {row.shop}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="flex items-center gap-1 flex-wrap">
                          {hasMultiple && i === 0 && (
                            <button
                              onClick={() => toggleCollapse(sku)}
                              style={{ color: 'oklch(0.55 0.012 250)', flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            >
                              <ChevronDown size={12} />
                            </button>
                          )}
                          {hasMultiple && i > 0 && <span style={{ width: '12px', flexShrink: 0 }} />}
                          <span style={{ ...mono, fontSize: '0.76rem', fontWeight: 500, color: 'oklch(0.22 0.018 250)' }}>
                            {row.seller_sku}
                          </span>
                          <BundleNote
                            row={row}
                            effectiveWhTotal={effectiveWh}
                            effectiveComp1={comp1Avail}
                            effectiveComp2={comp2Avail}
                          />
                        </div>
                      </td>
                      <td style={{ ...mono, fontSize: '0.68rem', color: 'oklch(0.52 0.012 250)', whiteSpace: 'nowrap' }}>
                        {row.listing_id || '—'}
                      </td>
                      <td style={{ ...mono, fontSize: '0.68rem', color: 'oklch(0.48 0.015 250)', whiteSpace: 'nowrap' }}>
                        {row.sku_id || '—'}
                      </td>
                      <td style={{ textAlign: 'right', ...mono, fontSize: '0.78rem', fontWeight: 500 }}>
                        {row.platform_qty.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', ...mono, fontSize: '0.78rem', color: 'oklch(0.38 0.015 250)' }}>
                        {/* 仓库存：显示原始库存（不受资源池影响），资源占用情况通过「实可N天」标注体现 */}
                        {row.wh_total.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <SurplusCell surplus={row.stock_surplus} />
                      </td>
                      <td style={{ textAlign: 'right', ...mono, fontSize: '0.76rem', color: 'oklch(0.45 0.015 250)' }}>
                        {row.listing_daily > 0 ? row.listing_daily.toFixed(1) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', ...mono, fontSize: '0.76rem', color: 'oklch(0.38 0.015 250)' }}>
                        {(row.listing_s15 ?? 0) > 0 ? (row.listing_s15 ?? 0) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', ...mono, fontSize: '0.76rem', color: 'oklch(0.38 0.015 250)' }}>
                        {(row.listing_s30 ?? 0) > 0 ? (row.listing_s30 ?? 0) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <DaysCell
                          days={row.listing_daily > 0 ? Math.round(row.platform_qty / row.listing_daily) : 9999}
                          daily={row.listing_daily}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <SkuCategoryBadge category={row.wh_sku_category ?? 'single'} />
                      </td>
                      <td>
                        <StatusBadge level={row.status_level} text={row.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <SuggestAdjCell add={row.suggest_add} reduce={row.suggest_reduce} />
                      </td>
                      <td>
                        <AdjustCell
                          row={row}
                          adjustedQty={adjustedQty}
                          setAdjustedQty={setAdjustedQty}
                          effectiveWhTotal={effectiveWh}
                          assembleNeeded={assembleNeeded}
                        />
                      </td>
                    </tr>
                  );
                }) : []),

                // SKU 汇总行（多个 Listing 时显示）
                hasMultiple ? (
                  <tr
                    key={`${sku}-summary`}
                    className="row-summary"
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleCollapse(sku)}
                  >
                    <td colSpan={2} />
                    <td>
                      <div className="flex items-center gap-1.5">
                        {isCollapsed
                          ? <ChevronRight size={12} style={{ color: 'oklch(0.50 0.16 250)', flexShrink: 0 }} />
                          : <ChevronDown size={12} style={{ color: 'oklch(0.50 0.16 250)', flexShrink: 0 }} />
                        }
                        <span style={{ ...sans, fontSize: '0.72rem', color: 'oklch(0.38 0.16 250)', fontWeight: 600 }}>
                          — {skuRows[0]?.seller_sku ?? sku} ({skuRows.length} 个 Listing)
                        </span>
                      </div>
                    </td>
                    <td colSpan={2} />
                    <td style={{ textAlign: 'right', ...mono, fontSize: '0.78rem', fontWeight: 700, color: 'oklch(0.30 0.018 250)' }}>
                      {adjTotalPlatform.toLocaleString()}
                      {hasAnyAdj && <span style={{ fontSize: '0.65rem', color: 'oklch(0.50 0.16 250)', marginLeft: '2px' }}>*</span>}
                    </td>
                    <td style={{ textAlign: 'right', ...mono, fontSize: '0.78rem', color: 'oklch(0.38 0.015 250)' }}>
                      {whTotalForSku.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <SurplusCell surplus={adjSurplus} />
                    </td>
                    <td colSpan={5} />
                    <td colSpan={3}>
                      <span style={{
                        ...sans,
                        fontSize: '0.70rem',
                        fontWeight: 500,
                        color: adjSurplus < 0 ? 'oklch(0.50 0.20 25)'
                          : adjSurplus === 0 ? 'oklch(0.42 0.14 145)'
                          : 'oklch(0.42 0.14 250)',
                        backgroundColor: adjSurplus < 0 ? 'oklch(0.96 0.025 25)'
                          : adjSurplus === 0 ? 'oklch(0.96 0.020 145)'
                          : 'oklch(0.96 0.020 250)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        {adjSummaryNote}
                      </span>
                    </td>
                  </tr>
                ) : null,
              ].filter(Boolean);
            })}
          </tbody>
        </table>
      </div>

      {/* 底部统计 */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'oklch(0.55 0.012 250)', ...sans }}>
        <span>共 {filtered.length} 条 / {rows.length} 条</span>
        <span>·</span>
        <span style={{ color: 'oklch(0.50 0.20 25)' }}>🔴 紧急 {rows.filter(r => r.status_level === 'red').length}</span>
        <span style={{ color: 'oklch(0.52 0.16 85)' }}>🟡 建议 {rows.filter(r => r.status_level === 'yellow').length}</span>
        <span style={{ color: 'oklch(0.45 0.14 145)' }}>🟢 充足 {rows.filter(r => r.status_level === 'green').length}</span>
      </div>
    </div>
  );
}
