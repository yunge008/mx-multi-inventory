/**
 * 概览页面 — 数据摘要 + 快速跳转
 * Design: Precision Data Terminal
 */
import { useApp } from '@/contexts/AppContext';
import KpiCards from './KpiCards';
import UploadZone from './UploadZone';
import { AlertTriangle, TrendingUp, ShoppingCart, Link2, ArrowRight } from 'lucide-react';
import type { StatusLevel } from '@/lib/analyzer';

function StatusBadge({ level, text }: { level: StatusLevel; text: string }) {
  return <span className={`badge-${level}`}>{text}</span>;
}

export default function OverviewPage() {
  const { result, setActiveTab } = useApp();

  if (!result) {
    return <UploadZone />;
  }

  const { listingAdj, purchase, trend, skuMatch, stats } = result;

  // 紧急 Listing（红色）
  const urgentListings = listingAdj.filter(r => r.status_level === 'red').slice(0, 8);
  // 爆品
  const hotItems = trend.filter(r => r.hot === '🔥 爆品').slice(0, 5);
  // 需采购
  const purchaseItems = purchase.filter(r => r.suggest_purchase > 0)
    .sort((a, b) => b.suggest_purchase - a.suggest_purchase)
    .slice(0, 5);
  // 未匹配 SKU
  const unmatchedSkus = skuMatch.filter(r => !r.wh_sku_matched).slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {/* KPI 卡片 */}
      <KpiCards />

      {/* 四格摘要 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 紧急预警 */}
        <div
          className="rounded-lg overflow-hidden"
          style={{ backgroundColor: 'oklch(1 0 0)', border: '1px solid oklch(0.91 0.005 240)', boxShadow: '0 1px 3px oklch(0 0 0 / 0.04)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid oklch(0.93 0.004 240)' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} style={{ color: 'oklch(0.55 0.20 25)' }} />
              <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '0.85rem', color: 'oklch(0.22 0.018 250)' }}>
                紧急预警 Listing
              </span>
              <span className="badge-red">{stats.urgentCount}</span>
            </div>
            <button
              onClick={() => setActiveTab('listing')}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'oklch(0.50 0.18 250)', fontFamily: '"Noto Sans SC", sans-serif' }}
            >
              查看全部 <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-[oklch(0.95_0.003_240)]">
            {urgentListings.length === 0 ? (
              <div className="px-4 py-6 text-center" style={{ color: 'oklch(0.60 0.012 250)', fontSize: '0.80rem' }}>
                暂无紧急预警
              </div>
            ) : urgentListings.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`badge-${row.platform === 'TTS' ? 'tts' : 'mkd'}`}>
                    {row.platform}
                  </span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem', color: 'oklch(0.25 0.018 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.seller_sku}
                  </span>
                </div>
                <StatusBadge level={row.status_level} text={row.status.replace(/^[🔴🟡🟢🟠⚪]\s*/, '')} />
              </div>
            ))}
          </div>
        </div>

        {/* 爆品 */}
        <div
          className="rounded-lg overflow-hidden"
          style={{ backgroundColor: 'oklch(1 0 0)', border: '1px solid oklch(0.91 0.005 240)', boxShadow: '0 1px 3px oklch(0 0 0 / 0.04)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid oklch(0.93 0.004 240)' }}
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={15} style={{ color: 'oklch(0.60 0.18 55)' }} />
              <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '0.85rem', color: 'oklch(0.22 0.018 250)' }}>
                近期爆品
              </span>
              <span className="badge-orange">{stats.hotCount}</span>
            </div>
            <button
              onClick={() => setActiveTab('trend')}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'oklch(0.50 0.18 250)', fontFamily: '"Noto Sans SC", sans-serif' }}
            >
              查看全部 <ArrowRight size={12} />
            </button>
          </div>
          <div>
            {hotItems.length === 0 ? (
              <div className="px-4 py-6 text-center" style={{ color: 'oklch(0.60 0.012 250)', fontSize: '0.80rem' }}>
                暂无爆品
              </div>
            ) : hotItems.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid oklch(0.95 0.003 240)' }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem', color: 'oklch(0.25 0.018 250)' }}>
                  {row.seller_sku}
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem', color: 'oklch(0.45 0.18 55)', fontWeight: 600 }}>
                    {row.all_s30} 件/30天
                  </span>
                  <span className="badge-orange">🔥 爆品</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 采购缺口 */}
        <div
          className="rounded-lg overflow-hidden"
          style={{ backgroundColor: 'oklch(1 0 0)', border: '1px solid oklch(0.91 0.005 240)', boxShadow: '0 1px 3px oklch(0 0 0 / 0.04)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid oklch(0.93 0.004 240)' }}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} style={{ color: 'oklch(0.50 0.16 145)' }} />
              <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '0.85rem', color: 'oklch(0.22 0.018 250)' }}>
                采购缺口 TOP5
              </span>
              <span className="badge-green">{stats.purchaseNeeded}</span>
            </div>
            <button
              onClick={() => setActiveTab('purchase')}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'oklch(0.50 0.18 250)', fontFamily: '"Noto Sans SC", sans-serif' }}
            >
              查看全部 <ArrowRight size={12} />
            </button>
          </div>
          <div>
            {purchaseItems.length === 0 ? (
              <div className="px-4 py-6 text-center" style={{ color: 'oklch(0.60 0.012 250)', fontSize: '0.80rem' }}>
                暂无采购缺口
              </div>
            ) : purchaseItems.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid oklch(0.95 0.003 240)' }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem', color: 'oklch(0.25 0.018 250)' }}>
                  {row.seller_sku}
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem', color: 'oklch(0.42 0.16 145)', fontWeight: 600 }}>
                    +{row.suggest_purchase} 件
                  </span>
                  <span className="badge-yellow">缺口</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 未匹配 SKU */}
        <div
          className="rounded-lg overflow-hidden"
          style={{ backgroundColor: 'oklch(1 0 0)', border: '1px solid oklch(0.91 0.005 240)', boxShadow: '0 1px 3px oklch(0 0 0 / 0.04)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid oklch(0.93 0.004 240)' }}
          >
            <div className="flex items-center gap-2">
              <Link2 size={15} style={{ color: 'oklch(0.52 0.015 250)' }} />
              <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '0.85rem', color: 'oklch(0.22 0.018 250)' }}>
                未匹配 SKU
              </span>
              <span className="badge-gray">{skuMatch.filter(r => !r.wh_sku_matched).length}</span>
            </div>
            <button
              onClick={() => setActiveTab('sku')}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'oklch(0.50 0.18 250)', fontFamily: '"Noto Sans SC", sans-serif' }}
            >
              查看全部 <ArrowRight size={12} />
            </button>
          </div>
          <div>
            {unmatchedSkus.length === 0 ? (
              <div className="px-4 py-6 text-center" style={{ color: 'oklch(0.60 0.012 250)', fontSize: '0.80rem' }}>
                所有 SKU 均已匹配
              </div>
            ) : unmatchedSkus.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid oklch(0.95 0.003 240)' }}>
                <div className="flex items-center gap-2">
                  <span className={`badge-${row.platform === 'TTS' ? 'tts' : 'mkd'}`}>{row.platform}</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem', color: 'oklch(0.25 0.018 250)' }}>
                    {row.seller_sku}
                  </span>
                </div>
                <span className="badge-gray">未匹配</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
