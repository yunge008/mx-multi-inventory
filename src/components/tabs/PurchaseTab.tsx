/**
 * 采购建议 Tab
 * Design: Precision Data Terminal
 *
 * 以海外仓 SKU 为维度汇总，5个店铺销量分列
 * 列顺序：海外仓SKU | 仓库库存 | 在途 | 可分配 | 平台合计 | 盈余 | TTS AR | TTS NE | TTS SJ | MKD AR | MKD NE | 日均 | 可售天 | 60天目标 | 库存需求 | 仍有需求 | 状态
 */
import { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { exportCsv } from '@/lib/analyzer';
import type { StatusLevel } from '@/lib/analyzer';
import { Search, Download, Info } from 'lucide-react';

function StatusBadge({ level, text }: { level: StatusLevel; text: string }) {
  const clean = text.replace(/^[🔴🟡🟢🟠⚪📈📉➡️⚫🔥⚠️]\s*/, '');
  return <span className={`badge-${level}`}>{clean}</span>;
}

function DaysCell({ days, daily }: { days: number; daily: number }) {
  if (daily === 0) return <span style={{ color: 'oklch(0.60 0.010 250)', fontSize: '0.78rem' }}>—</span>;
  if (days >= 9990) return <span className="days-blue font-mono">∞</span>;
  const cls = days < 15 ? 'days-red' : days < 30 ? 'days-yellow' : days > 90 ? 'days-blue' : 'days-green';
  return <span className={`${cls} font-mono`} style={{ fontSize: '0.82rem' }}>{days}天</span>;
}

function ShopCell({ value }: { value: number }) {
  if (value === 0) return <span style={{ color: 'oklch(0.80 0.006 240)', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.74rem' }}>—</span>;
  return <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.76rem', color: 'oklch(0.30 0.018 250)', fontWeight: 500 }}>{value.toLocaleString()}</span>;
}

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'red', label: '🔴 无库存' },
  { key: 'orange', label: '🟠 超卖' },
  { key: 'yellow', label: '🟡 需补货' },
  { key: 'green', label: '🟢 充足' },
];

export default function PurchaseTab() {
  const { result } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const rows = result?.purchase ?? [];

  const filtered = useMemo(() => {
    return rows.filter(row => {
      if (statusFilter !== 'all' && row.status_level !== statusFilter) return false;
      if (search && !row.seller_sku.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.still_needed - a.still_needed || b.suggest_purchase - a.suggest_purchase);
  }, [rows, statusFilter, search]);

  const handleExport = useCallback(() => {
    const data = filtered.map(row => ({
      '海外仓SKU': row.seller_sku,
      仓库库存: row.wh_total,
      在途库存: row.in_transit,
      安全缓冲: row.buffer,
      可分配库存: row.wh_allocatable,
      平台上架合计: row.total_platform,
      库存盈余: row.redundant,
      'TTS MX-AR': row.tts_ar_s30,
      'TTS MX-NE': row.tts_ne_s30,
      'TTS MX-SJ': row.tts_sj_s30,
      'MKD MX-AR': row.mkd_ar_s30,
      'MKD MX-NE': row.mkd_ne_s30,
      '全平台30天销量': row.all_s30,
      日均销量: row.daily_avg,
      当前可售天数: row.days_of_stock >= 9990 ? '∞' : row.days_of_stock,
      '60天备货目标': row.target_60,
      库存需求: row.suggest_purchase,
      仍有需求: row.still_needed,
      状态: row.status.replace(/^[🔴🟡🟢🟠⚪]\s*/, ''),
    }));
    exportCsv(data, `purchase_suggestion_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [filtered]);

  const totalStillNeeded = filtered.reduce((s, r) => s + r.still_needed, 0);
  const totalSuggest = filtered.reduce((s, r) => s + r.suggest_purchase, 0);
  const totalInTransit = filtered.reduce((s, r) => s + r.in_transit, 0);
  const needPurchaseCount = filtered.filter(r => r.still_needed > 0).length;

  const mono = { fontFamily: '"JetBrains Mono", monospace' };
  const sans = { fontFamily: '"Noto Sans SC", sans-serif' };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className="px-3 py-1.5 rounded-md text-xs transition-all"
              style={{
                ...sans,
                fontWeight: statusFilter === f.key ? 600 : 400,
                backgroundColor: statusFilter === f.key ? 'oklch(0.50 0.18 250)' : 'oklch(0.97 0.004 240)',
                color: statusFilter === f.key ? 'oklch(0.98 0 0)' : 'oklch(0.40 0.015 250)',
                border: '1px solid',
                borderColor: statusFilter === f.key ? 'oklch(0.50 0.18 250)' : 'oklch(0.90 0.006 240)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative" style={{ maxWidth: '220px' }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'oklch(0.60 0.012 250)' }} />
          <input
            type="text"
            placeholder="搜索海外仓 SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs"
            style={{ ...mono, border: '1px solid oklch(0.90 0.006 240)', backgroundColor: 'oklch(1 0 0)', color: 'oklch(0.22 0.018 250)', outline: 'none' }}
          />
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs"
          style={{ ...sans, color: 'oklch(0.50 0.015 250)', backgroundColor: 'oklch(0.97 0.004 240)', border: '1px solid oklch(0.90 0.006 240)' }}
        >
          <Info size={12} />说明
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs"
          style={{ ...sans, color: 'oklch(0.38 0.16 250)', backgroundColor: 'oklch(0.96 0.04 250)', border: '1px solid oklch(0.80 0.10 250)' }}
        >
          <Download size={12} />
          导出 CSV ({filtered.length})
        </button>
      </div>

      {/* 说明面板 */}
      {showInfo && (
        <div className="rounded-lg px-4 py-3 text-xs" style={{ backgroundColor: 'oklch(0.97 0.008 250)', border: '1px solid oklch(0.88 0.012 250)', color: 'oklch(0.35 0.015 250)', ...sans, lineHeight: 1.8 }}>
          <strong>汇总维度：</strong>按海外仓 SKU 去重汇总，5个店铺销量合并到同一行 ｜
          <strong>库存需求</strong> = max(0, 60天目标 − 仓库库存) ｜
          <strong>在途库存</strong> = 来自「仙人掌海外仓库存」Sheet 的「在途数」列 ｜
          <strong>仍有需求</strong> = max(0, 库存需求 − 在途库存) ｜
          安全缓冲 = max(5, 仓库库存 × 5%) ｜
          库存盈余 = 可分配库存 − 平台上架合计（负值表示超卖）
        </div>
      )}

      {/* 汇总条 */}
      {needPurchaseCount > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg flex-wrap" style={{ backgroundColor: 'oklch(0.97 0.018 145)', border: '1px solid oklch(0.88 0.025 145)' }}>
          <span style={{ ...sans, fontSize: '0.80rem', color: 'oklch(0.35 0.14 145)', fontWeight: 600 }}>📦 采购汇总</span>
          <span style={{ ...mono, fontSize: '0.80rem', color: 'oklch(0.35 0.14 145)' }}>{needPurchaseCount} 个 SKU 仍有需求</span>
          <span style={{ ...mono, fontSize: '0.80rem', color: 'oklch(0.35 0.14 145)', fontWeight: 700 }}>库存需求合计：{totalSuggest.toLocaleString()} 件</span>
          {totalInTransit > 0 && (
            <span style={{ ...mono, fontSize: '0.80rem', color: 'oklch(0.42 0.14 250)' }}>在途：{totalInTransit.toLocaleString()} 件</span>
          )}
          <span style={{ ...mono, fontSize: '0.80rem', color: 'oklch(0.42 0.18 25)', fontWeight: 700 }}>仍需采购：{totalStillNeeded.toLocaleString()} 件</span>
        </div>
      )}

      {/* 数据表格 */}
      <div
        className="flex-1 overflow-auto rounded-lg scrollbar-thin"
        style={{ border: '1px solid oklch(0.91 0.005 240)', backgroundColor: 'oklch(1 0 0)', maxHeight: 'calc(100vh - 300px)' }}
      >
        <table className="data-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: '1280px' }}>
          <colgroup>
            <col style={{ width: '110px' }} />  {/* 海外仓SKU */}
            <col style={{ width: '64px' }} />   {/* 仓库库存 */}
            <col style={{ width: '52px' }} />   {/* 在途 */}
            <col style={{ width: '52px' }} />   {/* 可分配 */}
            <col style={{ width: '56px' }} />   {/* 平台合计 */}
            <col style={{ width: '52px' }} />   {/* 盈余 */}
            {/* 5店铺 */}
            <col style={{ width: '52px' }} />   {/* TTS AR */}
            <col style={{ width: '52px' }} />   {/* TTS NE */}
            <col style={{ width: '52px' }} />   {/* TTS SJ */}
            <col style={{ width: '52px' }} />   {/* MKD AR */}
            <col style={{ width: '52px' }} />   {/* MKD NE */}
            <col style={{ width: '44px' }} />   {/* 日均 */}
            <col style={{ width: '60px' }} />   {/* 可售天 */}
            <col style={{ width: '60px' }} />   {/* 60天目标 */}
            <col style={{ width: '64px' }} />   {/* 库存需求 */}
            <col style={{ width: '64px' }} />   {/* 仍有需求 */}
            <col style={{ width: '80px' }} />   {/* 状态 */}
          </colgroup>
          <thead>
            <tr>
              <th>海外仓 SKU</th>
              <th style={{ textAlign: 'right' }}>仓库库存</th>
              <th style={{ textAlign: 'right' }}>
                <span style={{ color: 'oklch(0.42 0.14 250)' }}>在途</span>
              </th>
              <th style={{ textAlign: 'right' }}>可分配</th>
              <th style={{ textAlign: 'right' }}>平台合计</th>
              <th style={{ textAlign: 'right' }}>盈余</th>
              {/* TTS 三店 */}
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.42 0.16 340)' }}>TTS</span>
                <br /><span style={{ fontSize: '0.60rem', color: 'oklch(0.55 0.012 250)' }}>MX-AR</span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.42 0.16 340)' }}>TTS</span>
                <br /><span style={{ fontSize: '0.60rem', color: 'oklch(0.55 0.012 250)' }}>MX-NE</span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.42 0.16 340)' }}>TTS</span>
                <br /><span style={{ fontSize: '0.60rem', color: 'oklch(0.55 0.012 250)' }}>MX-SJ</span>
              </th>
              {/* MKD 两店 */}
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.44 0.14 80)' }}>MKD</span>
                <br /><span style={{ fontSize: '0.60rem', color: 'oklch(0.55 0.012 250)' }}>MX-AR</span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.44 0.14 80)' }}>MKD</span>
                <br /><span style={{ fontSize: '0.60rem', color: 'oklch(0.55 0.012 250)' }}>MX-NE</span>
              </th>
              <th style={{ textAlign: 'right' }}>日均</th>
              <th style={{ textAlign: 'right' }}>可售天</th>
              <th style={{ textAlign: 'right' }}>60天目标</th>
              <th style={{ textAlign: 'right' }}>库存需求</th>
              <th style={{ textAlign: 'right' }}>
                <span style={{ color: 'oklch(0.42 0.18 25)' }}>仍有需求</span>
              </th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={17} style={{ textAlign: 'center', padding: '28px', color: 'oklch(0.60 0.012 250)' }}>暂无数据</td></tr>
            ) : filtered.map((row, i) => {
              const rowBgClass = row.status_level === 'red' ? 'row-red'
                : row.status_level === 'orange' ? 'row-orange'
                : row.status_level === 'yellow' ? 'row-amber'
                : '';
              return (
                <tr key={i} className={rowBgClass}>
                  <td style={{ ...mono, fontSize: '0.78rem', fontWeight: 500, color: 'oklch(0.22 0.018 250)' }}>
                    {row.seller_sku}
                  </td>
                  <td style={{ textAlign: 'right', ...mono, fontSize: '0.78rem', fontWeight: 500 }}>
                    {row.wh_total.toLocaleString()}
                  </td>
                  {/* 在途库存 */}
                  <td style={{ textAlign: 'right' }}>
                    {row.in_transit > 0 ? (
                      <span style={{ ...mono, fontSize: '0.76rem', color: 'oklch(0.42 0.14 250)', fontWeight: 600 }}>
                        {row.in_transit.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'oklch(0.80 0.006 240)', fontSize: '0.76rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', ...mono, fontSize: '0.76rem' }}>
                    {row.wh_allocatable.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right', ...mono, fontSize: '0.76rem' }}>
                    {row.total_platform.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="font-mono" style={{ fontSize: '0.80rem', fontWeight: 600, color: row.redundant < 0 ? 'oklch(0.50 0.20 25)' : 'oklch(0.42 0.14 145)' }}>
                      {row.redundant >= 0 ? '+' : ''}{row.redundant.toLocaleString()}
                    </span>
                  </td>
                  {/* 5店铺销量 */}
                  <td style={{ textAlign: 'right' }}><ShopCell value={row.tts_ar_s30} /></td>
                  <td style={{ textAlign: 'right' }}><ShopCell value={row.tts_ne_s30} /></td>
                  <td style={{ textAlign: 'right' }}><ShopCell value={row.tts_sj_s30} /></td>
                  <td style={{ textAlign: 'right' }}><ShopCell value={row.mkd_ar_s30} /></td>
                  <td style={{ textAlign: 'right' }}><ShopCell value={row.mkd_ne_s30} /></td>
                  <td style={{ textAlign: 'right', ...mono, fontSize: '0.76rem', color: 'oklch(0.40 0.015 250)' }}>
                    {row.daily_avg > 0 ? row.daily_avg.toFixed(1) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <DaysCell days={row.days_of_stock} daily={row.daily_avg} />
                  </td>
                  <td style={{ textAlign: 'right', ...mono, fontSize: '0.76rem', color: 'oklch(0.40 0.015 250)' }}>
                    {row.target_60 > 0 ? row.target_60.toLocaleString() : '—'}
                  </td>
                  {/* 库存需求 */}
                  <td style={{ textAlign: 'right' }}>
                    {row.suggest_purchase > 0 ? (
                      <span style={{ ...mono, fontSize: '0.78rem', color: 'oklch(0.45 0.15 55)', fontWeight: 600 }}>
                        {row.suggest_purchase.toLocaleString()}
                      </span>
                    ) : <span style={{ color: 'oklch(0.72 0.008 250)', fontSize: '0.76rem' }}>—</span>}
                  </td>
                  {/* 仍有需求 */}
                  <td style={{ textAlign: 'right' }}>
                    {row.still_needed > 0 ? (
                      <span className="adjust-pos font-mono" style={{ fontSize: '0.80rem', fontWeight: 700 }}>
                        +{row.still_needed.toLocaleString()}
                      </span>
                    ) : row.suggest_purchase > 0 ? (
                      <span style={{ ...sans, fontSize: '0.70rem', color: 'oklch(0.42 0.14 145)', backgroundColor: 'oklch(0.96 0.020 145)', padding: '1px 4px', borderRadius: '3px' }}>
                        在途覆盖
                      </span>
                    ) : (
                      <span style={{ color: 'oklch(0.72 0.008 250)', fontSize: '0.76rem' }}>—</span>
                    )}
                  </td>
                  <td><StatusBadge level={row.status_level} text={row.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 底部统计 */}
      <div className="flex items-center gap-4 text-xs" style={{ color: 'oklch(0.55 0.012 250)', ...sans }}>
        <span>共 {filtered.length} 条 / {rows.length} 条</span>
        <span>·</span>
        <span>库存需求 {filtered.filter(r => r.suggest_purchase > 0).length} 个 SKU</span>
        <span>·</span>
        <span>仍需采购 {needPurchaseCount} 个 SKU</span>
        <span>·</span>
        <span>合计 {totalStillNeeded.toLocaleString()} 件</span>
      </div>
    </div>
  );
}
