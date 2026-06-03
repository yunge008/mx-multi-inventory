/**
 * 趋势与爆品 Tab
 * Design: Precision Data Terminal
 *
 * 功能：
 * - 按海外仓 SKU 去重汇总（同一仓库 SKU 的 TTS+MKD 所有店铺销量合并到一行）
 * - 5 个店铺分列：TTS MX-AR / TTS MX-NE / TTS MX-SJ / MKD MX-AR / MKD MX-NE
 * - 近15天 vs 前15天对比（按5店铺总量）
 * - 趋势标签、爆品/下滑预警
 * - CSV 导出
 */
import { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { exportCsv } from '@/lib/analyzer';
import { Search, Download, Info } from 'lucide-react';

const TREND_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'hot', label: '🔥 爆品' },
  { key: 'decline', label: '⚠️ 下滑' },
  { key: 'rising', label: '📈 上升' },
  { key: 'stable', label: '➡️ 平稳' },
  { key: 'nosale', label: '⚫ 无销量' },
];

function TrendBar({ recent, prev }: { recent: number; prev: number }) {
  const max = Math.max(recent, prev, 1);
  const recentPct = (recent / max) * 100;
  const prevPct = (prev / max) * 100;

  return (
    <div className="flex items-center gap-1.5" style={{ minWidth: '100px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '28px', fontSize: '0.62rem', color: 'oklch(0.55 0.012 250)', fontFamily: '"Noto Sans SC", sans-serif', textAlign: 'right' }}>近</div>
          <div style={{ flex: 1, height: '6px', backgroundColor: 'oklch(0.93 0.004 240)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${recentPct}%`, height: '100%', backgroundColor: 'oklch(0.55 0.18 250)', borderRadius: '3px', transition: 'width 300ms' }} />
          </div>
          <div style={{ width: '28px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: 'oklch(0.35 0.015 250)', textAlign: 'right' }}>{recent}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '28px', fontSize: '0.62rem', color: 'oklch(0.55 0.012 250)', fontFamily: '"Noto Sans SC", sans-serif', textAlign: 'right' }}>前</div>
          <div style={{ flex: 1, height: '6px', backgroundColor: 'oklch(0.93 0.004 240)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${prevPct}%`, height: '100%', backgroundColor: 'oklch(0.72 0.010 250)', borderRadius: '3px', transition: 'width 300ms' }} />
          </div>
          <div style={{ width: '28px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: 'oklch(0.55 0.012 250)', textAlign: 'right' }}>{prev}</div>
        </div>
      </div>
    </div>
  );
}

function ChangePct({ recent, prev }: { recent: number; prev: number }) {
  if (prev === 0 && recent === 0) return <span style={{ color: 'oklch(0.60 0.010 250)', fontSize: '0.78rem' }}>—</span>;
  if (prev === 0) return <span style={{ color: 'oklch(0.42 0.16 145)', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.80rem', fontWeight: 700 }}>+∞%</span>;
  const pct = ((recent - prev) / prev) * 100;
  const color = pct > 20 ? 'oklch(0.42 0.16 145)' : pct < -20 ? 'oklch(0.50 0.20 25)' : 'oklch(0.40 0.015 250)';
  return (
    <span style={{ color, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.80rem', fontWeight: 600 }}>
      {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
    </span>
  );
}

function ShopSalesCell({ value }: { value: number }) {
  if (value === 0) return <span style={{ color: 'oklch(0.78 0.006 240)', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.76rem' }}>—</span>;
  return <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem', color: 'oklch(0.30 0.018 250)', fontWeight: 500 }}>{value.toLocaleString()}</span>;
}

export default function TrendTab() {
  const { result } = useApp();
  const [trendFilter, setTrendFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const rows = result?.trend ?? [];

  const filtered = useMemo(() => {
    return rows.filter(row => {
      if (trendFilter === 'hot' && row.hot !== '🔥 爆品') return false;
      if (trendFilter === 'decline' && row.hot !== '⚠️ 注意下滑') return false;
      if (trendFilter === 'rising' && !row.trend.includes('上升')) return false;
      if (trendFilter === 'stable' && !row.trend.includes('平稳')) return false;
      if (trendFilter === 'nosale' && row.all_s30 !== 0) return false;
      if (search && !row.seller_sku.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, trendFilter, search]);

  const handleExport = useCallback(() => {
    const data = filtered.map(row => ({
      '海外仓SKU': row.seller_sku,
      '30天总销量': row.all_s30,
      'TTS MX-AR': row.tts_ar_s30,
      'TTS MX-NE': row.tts_ne_s30,
      'TTS MX-SJ': row.tts_sj_s30,
      'MKD MX-AR': row.mkd_ar_s30,
      'MKD MX-NE': row.mkd_ne_s30,
      '近15天销量': row.all_s15,
      '前15天销量': row.prev15,
      '环比变化': row.prev15 > 0 ? `${(((row.all_s15 - row.prev15) / row.prev15) * 100).toFixed(0)}%` : '—',
      趋势: row.trend.replace(/[📈📉➡️⚫]/g, '').trim(),
      标签: row.hot === '-' ? '' : row.hot.replace(/[🔥⚠️]/g, '').trim(),
    }));
    exportCsv(data, `trend_analysis_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [filtered]);

  const hotCount = rows.filter(r => r.hot === '🔥 爆品').length;
  const declineCount = rows.filter(r => r.hot === '⚠️ 注意下滑').length;

  const mono = { fontFamily: '"JetBrains Mono", monospace' };
  const sans = { fontFamily: '"Noto Sans SC", sans-serif' };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {TREND_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTrendFilter(f.key)}
              className="px-3 py-1.5 rounded-md text-xs transition-all"
              style={{
                ...sans,
                fontWeight: trendFilter === f.key ? 600 : 400,
                backgroundColor: trendFilter === f.key ? 'oklch(0.50 0.18 250)' : 'oklch(0.97 0.004 240)',
                color: trendFilter === f.key ? 'oklch(0.98 0 0)' : 'oklch(0.40 0.015 250)',
                border: '1px solid',
                borderColor: trendFilter === f.key ? 'oklch(0.50 0.18 250)' : 'oklch(0.90 0.006 240)',
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

        <button onClick={() => setShowInfo(!showInfo)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs" style={{ ...sans, color: 'oklch(0.50 0.015 250)', backgroundColor: 'oklch(0.97 0.004 240)', border: '1px solid oklch(0.90 0.006 240)' }}>
          <Info size={12} />说明
        </button>

        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs" style={{ ...sans, color: 'oklch(0.38 0.16 250)', backgroundColor: 'oklch(0.96 0.04 250)', border: '1px solid oklch(0.80 0.10 250)' }}>
          <Download size={12} />
          导出 CSV ({filtered.length})
        </button>
      </div>

      {/* 说明面板 */}
      {showInfo && (
        <div className="rounded-lg px-4 py-3 text-xs" style={{ backgroundColor: 'oklch(0.97 0.008 250)', border: '1px solid oklch(0.88 0.012 250)', color: 'oklch(0.35 0.015 250)', ...sans, lineHeight: 1.8 }}>
          <strong>汇总规则：</strong>按海外仓 SKU 去重汇总，同一仓库 SKU 的 TTS+美客多 所有店铺销量合并到一行 ｜
          <strong>趋势判断：</strong>近15天 vs 前15天全平台合计对比 ｜
          近15天 &gt; 前15天 × 1.5 且 &gt;5件 → 加速上升 ｜
          前15天 &gt; 近15天 × 1.5 且 &gt;5件 → 加速下滑 ｜
          <strong>爆品：</strong>上升趋势 且 30天销量 ≥ 20件 ｜
          <strong>下滑预警：</strong>下滑趋势 且 30天销量 ≥ 10件
        </div>
      )}

      {/* 摘要条 */}
      <div className="flex items-center gap-3">
        {hotCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0.025 55)', border: '1px solid oklch(0.88 0.035 55)' }}>
            <span style={{ fontSize: '0.80rem', color: 'oklch(0.45 0.18 55)', ...sans, fontWeight: 600 }}>🔥 爆品</span>
            <span style={{ ...mono, fontSize: '0.82rem', color: 'oklch(0.40 0.16 55)', fontWeight: 700 }}>{hotCount} 个</span>
          </div>
        )}
        {declineCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'oklch(0.978 0.022 80)', border: '1px solid oklch(0.88 0.030 80)' }}>
            <span style={{ fontSize: '0.80rem', color: 'oklch(0.45 0.14 80)', ...sans, fontWeight: 600 }}>⚠️ 下滑预警</span>
            <span style={{ ...mono, fontSize: '0.82rem', color: 'oklch(0.42 0.14 80)', fontWeight: 700 }}>{declineCount} 个</span>
          </div>
        )}
      </div>

      {/* 数据表格 */}
      <div className="flex-1 overflow-auto rounded-lg scrollbar-thin" style={{ border: '1px solid oklch(0.91 0.005 240)', backgroundColor: 'oklch(1 0 0)', maxHeight: 'calc(100vh - 300px)' }}>
        <table className="data-table" style={{ fontSize: '0.78rem', tableLayout: 'fixed', width: '100%', minWidth: '1100px' }}>
          <colgroup>
            <col style={{ width: '110px' }} />  {/* 海外仓SKU */}
            <col style={{ width: '56px' }} />   {/* 30天合计 */}
            {/* 5店铺分列 */}
            <col style={{ width: '58px' }} />   {/* TTS AR */}
            <col style={{ width: '58px' }} />   {/* TTS NE */}
            <col style={{ width: '58px' }} />   {/* TTS SJ */}
            <col style={{ width: '58px' }} />   {/* MKD AR */}
            <col style={{ width: '58px' }} />   {/* MKD NE */}
            <col style={{ width: '130px' }} />  {/* 近15天 vs 前15天 */}
            <col style={{ width: '52px' }} />   {/* 环比 */}
            <col style={{ width: '96px' }} />   {/* 趋势 */}
            <col style={{ width: '80px' }} />   {/* 标签 */}
          </colgroup>
          <thead>
            <tr>
              <th>海外仓 SKU</th>
              <th style={{ textAlign: 'right' }}>30天合计</th>
              {/* TTS 三店 */}
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.65rem', color: 'oklch(0.42 0.16 340)' }}>TTS</span>
                <br />
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.55 0.012 250)' }}>MX-AR</span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.65rem', color: 'oklch(0.42 0.16 340)' }}>TTS</span>
                <br />
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.55 0.012 250)' }}>MX-NE</span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.65rem', color: 'oklch(0.42 0.16 340)' }}>TTS</span>
                <br />
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.55 0.012 250)' }}>MX-SJ</span>
              </th>
              {/* MKD 两店 */}
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.65rem', color: 'oklch(0.44 0.14 80)' }}>MKD</span>
                <br />
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.55 0.012 250)' }}>MX-AR</span>
              </th>
              <th style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.65rem', color: 'oklch(0.44 0.14 80)' }}>MKD</span>
                <br />
                <span style={{ fontSize: '0.62rem', color: 'oklch(0.55 0.012 250)' }}>MX-NE</span>
              </th>
              <th>近15天 vs 前15天</th>
              <th style={{ textAlign: 'right' }}>环比</th>
              <th>趋势</th>
              <th>标签</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'oklch(0.60 0.012 250)' }}>暂无数据</td></tr>
            ) : filtered.map((row, i) => {
              const isHot = row.hot === '🔥 爆品';
              const isDecline = row.hot === '⚠️ 注意下滑';
              const rowBg = isHot ? 'row-orange' : isDecline ? 'row-amber' : '';
              return (
                <tr key={i} className={rowBg}>
                  <td style={{ ...mono, fontSize: '0.78rem', fontWeight: 500, color: 'oklch(0.22 0.018 250)' }}>
                    {row.seller_sku}
                  </td>
                  <td style={{ textAlign: 'right', ...mono, fontSize: '0.82rem', fontWeight: 700, color: 'oklch(0.22 0.018 250)' }}>
                    {row.all_s30.toLocaleString()}
                  </td>
                  {/* TTS 三店 */}
                  <td style={{ textAlign: 'right' }}>
                    <ShopSalesCell value={row.tts_ar_s30} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ShopSalesCell value={row.tts_ne_s30} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ShopSalesCell value={row.tts_sj_s30} />
                  </td>
                  {/* MKD 两店 */}
                  <td style={{ textAlign: 'right' }}>
                    <ShopSalesCell value={row.mkd_ar_s30} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ShopSalesCell value={row.mkd_ne_s30} />
                  </td>
                  {/* 近15天 vs 前15天（全平台合计） */}
                  <td>
                    <TrendBar recent={row.all_s15} prev={row.prev15} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ChangePct recent={row.all_s15} prev={row.prev15} />
                  </td>
                  <td>
                    <span style={{
                      ...sans,
                      fontSize: '0.78rem',
                      color: row.trend.includes('上升') ? 'oklch(0.42 0.16 145)'
                        : row.trend.includes('下滑') ? 'oklch(0.50 0.20 25)'
                        : 'oklch(0.45 0.012 250)',
                      fontWeight: row.trend.includes('上升') || row.trend.includes('下滑') ? 600 : 400,
                    }}>
                      {row.trend}
                    </span>
                  </td>
                  <td>
                    {row.hot !== '-' ? (
                      <span className={isHot ? 'badge-orange' : 'badge-yellow'}>
                        {row.hot.replace(/[🔥⚠️]\s*/, '')}
                      </span>
                    ) : <span style={{ color: 'oklch(0.70 0.008 250)', fontSize: '0.78rem' }}>—</span>}
                  </td>
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
        <span>爆品 {hotCount} 个</span>
        <span>·</span>
        <span>下滑预警 {declineCount} 个</span>
        <span>·</span>
        <span>无销量 {rows.filter(r => r.all_s30 === 0).length} 个</span>
      </div>
    </div>
  );
}
