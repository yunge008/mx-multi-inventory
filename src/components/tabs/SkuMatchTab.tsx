/**
 * SKU 匹配表 Tab
 * Design: Precision Data Terminal
 *
 * 展示平台 SKU 与海外仓 SKU 的对应关系
 * 列项：产品库存（成品/原装）| 可组合数量（单品拆解）| 总可用库存 | 可售天数（A+B格式）
 */
import { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { exportCsv } from '@/lib/analyzer';
import type { SkuMatchRow } from '@/lib/analyzer';
import { Search, Download, Info, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const MATCH_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'matched', label: '✅ 已匹配' },
  { key: 'unmatched', label: '❌ 未匹配' },
  { key: 'bundle', label: '🔗 组合品' },
  { key: 'insufficient', label: '⚠️ 库存不足' },
];

const PLATFORM_FILTERS = [
  { key: 'all', label: '全平台' },
  { key: 'TTS', label: 'TTS' },
  { key: 'MKD', label: '美客多' },
];

const mono = { fontFamily: '"JetBrains Mono", monospace' };
const sans = { fontFamily: '"Noto Sans SC", sans-serif' };

/** 海外仓 SKU 列：显示 SKU 名称和匹配类型标签，不显示库存数量 */
function WhSkuCell({ row }: { row: SkuMatchRow }) {
  if (!row.wh_sku_matched) {
    return (
      <div className="flex items-center gap-1.5">
        <XCircle size={13} style={{ color: 'oklch(0.55 0.20 25)', flexShrink: 0 }} />
        <span style={{ color: 'oklch(0.55 0.20 25)', ...mono, fontSize: '0.78rem' }}>
          未匹配
        </span>
      </div>
    );
  }

  if (row.wh_sku_type === 'assembled') {
    return (
      <div className="flex items-center gap-1.5">
        <AlertCircle size={13} style={{ color: 'oklch(0.55 0.16 55)', flexShrink: 0 }} />
        <span style={{ ...mono, fontSize: '0.78rem', color: 'oklch(0.45 0.16 55)', fontStyle: 'italic' }}>
          {row.wh_sku}
        </span>
        <span style={{ fontSize: '0.64rem', color: 'oklch(0.55 0.14 55)', ...sans, backgroundColor: 'oklch(0.96 0.018 55)', padding: '1px 4px', borderRadius: '3px' }}>
          拆解
        </span>
      </div>
    );
  }

  if (row.wh_sku_type === 'insufficient') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={13} style={{ color: 'oklch(0.50 0.16 145)', flexShrink: 0 }} />
        <span style={{ ...mono, fontSize: '0.78rem', color: 'oklch(0.25 0.018 250)', fontWeight: 500 }}>
          {row.wh_sku}
        </span>
        <span style={{ fontSize: '0.64rem', color: 'oklch(0.45 0.14 80)', ...sans, backgroundColor: 'oklch(0.96 0.022 80)', padding: '1px 4px', borderRadius: '3px' }}>
          成品+拆解
        </span>
      </div>
    );
  }

  // direct / single
  const isBundle = row.wh_sku.includes('+') || row.wh_sku.includes(' + ');
  return (
    <div className="flex items-center gap-1.5">
      <CheckCircle2 size={13} style={{ color: 'oklch(0.50 0.16 145)', flexShrink: 0 }} />
      <span style={{ ...mono, fontSize: '0.78rem', color: 'oklch(0.25 0.018 250)', fontWeight: 500 }}>
        {row.wh_sku}
      </span>
      {isBundle && (
        <span style={{ fontSize: '0.64rem', color: 'oklch(0.40 0.16 250)', ...sans, backgroundColor: 'oklch(0.93 0.04 250)', padding: '1px 5px', borderRadius: '3px' }}>
          套
        </span>
      )}
    </div>
  );
}

/** 产品库存列：成品/原装库存 */
function WhQtyCell({ row }: { row: SkuMatchRow }) {
  if (!row.wh_sku_matched) {
    return <span style={{ color: 'oklch(0.70 0.008 250)', fontSize: '0.75rem' }}>—</span>;
  }
  if (row.wh_sku_type === 'assembled') {
    // 纯拆解：无成品库存
    return <span style={{ color: 'oklch(0.70 0.008 250)', fontSize: '0.75rem' }}>—</span>;
  }
  return (
    <span style={{ ...mono, fontSize: '0.82rem', fontWeight: 500, color: 'oklch(0.25 0.018 250)' }}>
      {row.wh_qty.toLocaleString()}
    </span>
  );
}

/** 可组合数量列：单品拆解可组合的数量 */
function AssembleQtyCell({ row }: { row: SkuMatchRow }) {
  if (!row.wh_sku_matched) {
    return <span style={{ color: 'oklch(0.70 0.008 250)', fontSize: '0.75rem' }}>—</span>;
  }
  if (row.wh_assemble_qty === 0) {
    return <span style={{ color: 'oklch(0.75 0.006 250)', fontSize: '0.75rem' }}>—</span>;
  }
  return (
    <span style={{ ...mono, fontSize: '0.82rem', fontWeight: 500, color: 'oklch(0.48 0.16 55)' }}>
      {row.wh_assemble_qty.toLocaleString()}
    </span>
  );
}

/** 总可用库存列：产品库存 + 可组合数量 */
function TotalQtyCell({ row }: { row: SkuMatchRow }) {
  if (!row.wh_sku_matched) {
    return <span style={{ color: 'oklch(0.70 0.008 250)', fontSize: '0.75rem' }}>—</span>;
  }
  const hasAssemble = row.wh_assemble_qty > 0;
  return (
    <span style={{
      ...mono,
      fontSize: '0.82rem',
      fontWeight: 600,
      color: hasAssemble ? 'oklch(0.38 0.16 250)' : 'oklch(0.30 0.018 250)',
    }}>
      {row.wh_total_qty.toLocaleString()}
    </span>
  );
}

/** 单品可售天数：仅基于产品库存（wh_qty），不含拆解数量 */
function SingleDaysCell({ row }: { row: SkuMatchRow }) {
  if (!row.wh_sku_matched) {
    return <span style={{ color: 'oklch(0.70 0.008 250)', fontSize: '0.75rem' }}>—</span>;
  }
  const days = row.days_of_stock;
  if (days >= 9990) return <span className="days-blue" style={{ ...mono, fontSize: '0.80rem' }}>∞</span>;
  const cls = days < 15 ? 'days-red' : days < 30 ? 'days-yellow' : days > 90 ? 'days-blue' : 'days-green';
  return <span className={cls} style={{ ...mono, fontSize: '0.80rem' }}>{days}天</span>;
}

/** 含组套可售天数：基于总可用库存（wh_total_qty），含拆解组合数量 */
function TotalDaysCell({ row }: { row: SkuMatchRow }) {
  if (!row.wh_sku_matched) {
    return <span style={{ color: 'oklch(0.70 0.008 250)', fontSize: '0.75rem' }}>—</span>;
  }
  const days = row.days_of_total;
  const hasAssemble = row.wh_assemble_qty > 0;
  if (days >= 9990) {
    return <span className="days-blue" style={{ ...mono, fontSize: '0.80rem' }}>∞</span>;
  }
  const cls = days < 15 ? 'days-red' : days < 30 ? 'days-yellow' : days > 90 ? 'days-blue' : 'days-green';
  return (
    <span className={cls} style={{ ...mono, fontSize: '0.80rem', fontStyle: hasAssemble ? 'italic' : 'normal' }}>
      {days}天
    </span>
  );
}

export default function SkuMatchTab() {
  const { result } = useApp();
  const [matchFilter, setMatchFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const rows = result?.skuMatch ?? [];

  const filtered = useMemo(() => {
    return rows.filter(row => {
      if (matchFilter === 'matched' && !row.wh_sku_matched) return false;
      if (matchFilter === 'unmatched' && row.wh_sku_matched) return false;
      if (matchFilter === 'bundle' && !row.seller_sku.includes('+')) return false;
      if (matchFilter === 'insufficient' && row.wh_sku_type !== 'insufficient') return false;
      if (platformFilter === 'TTS' && row.platform !== 'TTS') return false;
      if (platformFilter === 'MKD' && row.platform !== 'MKD') return false;
      if (search) {
        const q = search.toLowerCase();
        if (!row.seller_sku.toLowerCase().includes(q) &&
            !row.wh_sku.toLowerCase().includes(q) &&
            !row.product_id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, matchFilter, platformFilter, search]);

  const handleExport = useCallback(() => {
    const data = filtered.map(row => ({
      平台: row.platform,
      店铺: row.shop,
      '平台 Seller SKU': row.seller_sku,
      'Listing ID': row.product_id,
      'SKU ID': row.sku_id,
      '海外仓 SKU': row.wh_sku,
      是否匹配: row.wh_sku_matched ? '是' : '否',
      匹配类型: row.wh_sku_type,
      平台库存: row.platform_qty,
      产品库存: row.wh_qty,
      可组合数量: row.wh_assemble_qty,
      总可用库存: row.wh_total_qty,
      产品库存可售天数: row.days_of_stock >= 9990 ? '∞' : row.days_of_stock,
      总可用可售天数: row.days_of_total >= 9990 ? '∞' : row.days_of_total,
    }));
    exportCsv(data, `sku_match_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [filtered]);

  const unmatchedCount = rows.filter(r => !r.wh_sku_matched).length;
  const bundleCount = rows.filter(r => r.seller_sku.includes('+')).length;
  const insufficientCount = rows.filter(r => r.wh_sku_type === 'insufficient').length;

  const filterBtnStyle = (active: boolean, accent?: string) => ({
    ...sans,
    fontWeight: active ? 600 : 400,
    fontSize: '0.72rem',
    padding: '3px 10px',
    borderRadius: '5px',
    transition: 'all 0.15s',
    backgroundColor: active ? (accent ?? 'oklch(0.50 0.18 250)') : 'oklch(0.97 0.004 240)',
    color: active ? 'oklch(0.98 0 0)' : 'oklch(0.40 0.015 250)',
    border: '1px solid',
    borderColor: active ? (accent ?? 'oklch(0.50 0.18 250)') : 'oklch(0.90 0.006 240)',
    cursor: 'pointer',
  });

  return (
    <div className="flex flex-col h-full gap-2">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {MATCH_FILTERS.map(f => (
            <button key={f.key} onClick={() => setMatchFilter(f.key)} style={filterBtnStyle(matchFilter === f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {PLATFORM_FILTERS.map(f => (
            <button key={f.key} onClick={() => setPlatformFilter(f.key)} style={filterBtnStyle(platformFilter === f.key, 'oklch(0.46 0.16 250)')}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative" style={{ maxWidth: '220px' }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'oklch(0.60 0.012 250)' }} />
          <input
            type="text"
            placeholder="搜索 SKU / Listing ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 rounded-md"
            style={{ ...mono, fontSize: '0.72rem', border: '1px solid oklch(0.90 0.006 240)', backgroundColor: 'oklch(1 0 0)', color: 'oklch(0.22 0.018 250)', outline: 'none' }}
          />
        </div>

        <div className="flex-1" />

        <button onClick={() => setShowInfo(!showInfo)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ ...sans, fontSize: '0.72rem', color: 'oklch(0.50 0.015 250)', backgroundColor: 'oklch(0.97 0.004 240)', border: '1px solid oklch(0.90 0.006 240)' }}>
          <Info size={12} />说明
        </button>

        <button onClick={handleExport} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ ...sans, fontSize: '0.72rem', color: 'oklch(0.38 0.16 250)', backgroundColor: 'oklch(0.96 0.04 250)', border: '1px solid oklch(0.80 0.10 250)' }}>
          <Download size={12} />
          导出 ({filtered.length})
        </button>
      </div>

      {/* 说明面板 */}
      {showInfo && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'oklch(0.97 0.008 250)', border: '1px solid oklch(0.88 0.012 250)', color: 'oklch(0.35 0.015 250)', ...sans, lineHeight: 1.8 }}>
          <strong>产品库存</strong>：仓库中已组好的成品或单品原装库存（直接可用）<br />
          <strong>可组合数量</strong>：通过拆解单品可额外组合的数量（需人工组装）<br />
          <strong>总可用库存</strong> = 产品库存 + 可组合数量<br />
          <strong>可售天数（A+B）</strong>：A = 产品库存可售天数；B = 总可用库存可售天数（含组合）；仅有成品时只显示 A<br />
          <strong>匹配类型</strong>：✅ 直接匹配 | 成品+拆解（有成品也有单品可补充）| 拆解（只能从单品组装）| ❌ 未匹配
        </div>
      )}

      {/* 摘要条 */}
      <div className="flex items-center gap-2">
        {unmatchedCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'oklch(0.96 0.025 25)', border: '1px solid oklch(0.88 0.035 25)' }}>
            <XCircle size={12} style={{ color: 'oklch(0.55 0.20 25)' }} />
            <span style={{ fontSize: '0.76rem', color: 'oklch(0.45 0.18 25)', ...sans, fontWeight: 600 }}>未匹配 {unmatchedCount} 个</span>
          </div>
        )}
        {bundleCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'oklch(0.96 0.020 250)', border: '1px solid oklch(0.88 0.030 250)' }}>
            <span style={{ fontSize: '0.76rem', color: 'oklch(0.40 0.16 250)', ...sans, fontWeight: 600 }}>🔗 组合品 {bundleCount} 个</span>
          </div>
        )}
        {insufficientCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'oklch(0.978 0.022 80)', border: '1px solid oklch(0.88 0.030 80)' }}>
            <AlertCircle size={12} style={{ color: 'oklch(0.52 0.16 85)' }} />
            <span style={{ fontSize: '0.76rem', color: 'oklch(0.45 0.14 80)', ...sans, fontWeight: 600 }}>成品+拆解 {insufficientCount} 个</span>
          </div>
        )}
      </div>

      {/* 数据表格 */}
      <div
        className="flex-1 overflow-auto rounded-lg scrollbar-thin"
        style={{ border: '1px solid oklch(0.91 0.005 240)', backgroundColor: 'oklch(1 0 0)', maxHeight: 'calc(100vh - 300px)' }}
      >
        <table className="data-table" style={{ fontSize: '0.78rem', tableLayout: 'fixed', width: '100%', minWidth: '1180px' }}>
          <colgroup>
            <col style={{ width: '50px' }} />   {/* 平台 */}
            <col style={{ width: '65px' }} />   {/* 店铺 */}
            <col style={{ width: '250px' }} />  {/* 平台 SKU */}
            <col style={{ width: '200px' }} />  {/* Listing ID */}
            <col style={{ width: '200px' }} />  {/* SKU ID */}
            <col />                             {/* 海外仓 SKU（自动宽度） */}
            <col style={{ width: '70px' }} />   {/* 平台库 */}
            <col style={{ width: '75px' }} />   {/* 产品库存 */}
            <col style={{ width: '80px' }} />   {/* 可组合数量 */}
            <col style={{ width: '80px' }} />   {/* 总可用库存 */}
            <col style={{ width: '110px' }} />  {/* 单品可售天数 */}
            <col style={{ width: '110px' }} />  {/* 含组套可售天数 */}
          </colgroup>
          <thead>
            <tr>
              <th>平台</th>
              <th>店铺</th>
              <th>平台 SKU</th>
              <th>Listing ID</th>
              <th>SKU ID</th>
              <th>海外仓 SKU</th>
              <th style={{ textAlign: 'right' }}>平台库</th>
              <th style={{ textAlign: 'right' }}>产品库存</th>
              <th style={{ textAlign: 'right' }}>可组合</th>
              <th style={{ textAlign: 'right' }}>总可用</th>
              <th style={{ textAlign: 'right' }}>单品可售天</th>
              <th style={{ textAlign: 'right' }}>含组套可售天</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '32px', color: 'oklch(0.60 0.012 250)' }}>
                  暂无数据
                </td>
              </tr>
            ) : filtered.map((row, i) => {
              const rowBg = !row.wh_sku_matched ? 'row-red'
                : row.wh_sku_type === 'insufficient' ? 'row-amber'
                : row.wh_sku_type === 'assembled' ? 'row-orange'
                : '';
              return (
                <tr key={i} className={rowBg}>
                  <td>
                    <span className={`badge-${row.platform === 'TTS' ? 'tts' : 'mkd'}`}>{row.platform}</span>
                  </td>
                  <td style={{ ...mono, fontSize: '0.72rem', color: 'oklch(0.45 0.015 250)' }}>{row.shop}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span style={{ ...mono, fontSize: '0.78rem', fontWeight: 500, color: 'oklch(0.22 0.018 250)' }}>
                        {row.seller_sku}
                      </span>
                      {row.seller_sku.includes('+') && (
                        <span style={{ fontSize: '0.62rem', color: 'oklch(0.40 0.16 250)', ...sans, backgroundColor: 'oklch(0.93 0.04 250)', padding: '1px 4px', borderRadius: '3px' }}>
                          组合
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...mono, fontSize: '0.70rem', color: 'oklch(0.50 0.012 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.product_id || '—'}
                  </td>
                  <td style={{ ...mono, fontSize: '0.70rem', color: 'oklch(0.50 0.012 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.sku_id || '—'}
                  </td>
                  <td><WhSkuCell row={row} /></td>
                  <td style={{ textAlign: 'right', ...mono, fontSize: '0.80rem', fontWeight: 500 }}>
                    {row.platform_qty.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <WhQtyCell row={row} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <AssembleQtyCell row={row} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <TotalQtyCell row={row} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <SingleDaysCell row={row} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <TotalDaysCell row={row} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 底部统计 */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'oklch(0.55 0.012 250)', ...sans }}>
        <span>共 {filtered.length} 条 / {rows.length} 条</span>
        <span>·</span>
        <span style={{ color: 'oklch(0.50 0.16 145)' }}>✅ 已匹配 {rows.filter(r => r.wh_sku_matched).length}</span>
        <span style={{ color: 'oklch(0.50 0.20 25)' }}>❌ 未匹配 {unmatchedCount}</span>
        <span>·</span>
        <span>🔗 组合品 {bundleCount}</span>
      </div>
    </div>
  );
}
