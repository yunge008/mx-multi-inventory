/**
 * KPI 卡片区 — 6 个指标卡片，左侧彩色竖条
 * Design: Precision Data Terminal
 */
import { useApp } from '@/contexts/AppContext';
import { Package, LayoutList, AlertTriangle, Flame, TrendingDown, PackagePlus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: number | string;
  barClass: string;
  icon: React.ReactNode;
  sub?: string;
  onClick?: () => void;
  clickable?: boolean;
}

function KpiCard({ label, value, barClass, icon, sub, onClick, clickable }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className="relative flex items-center gap-3 rounded-lg overflow-hidden transition-all duration-150"
      style={{
        backgroundColor: 'oklch(1 0 0)',
        border: '1px solid oklch(0.91 0.005 240)',
        padding: '12px 14px',
        boxShadow: '0 1px 3px oklch(0 0 0 / 0.04)',
        cursor: clickable ? 'pointer' : 'default',
        minWidth: 0,
      }}
      onMouseEnter={e => {
        if (clickable) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px oklch(0 0 0 / 0.08)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        if (clickable) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px oklch(0 0 0 / 0.04)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        }
      }}
    >
      {/* 左侧竖条 */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${barClass}`}
        style={{ borderRadius: '0 2px 2px 0' }}
      />

      {/* 图标 */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'oklch(0.96 0.005 240)', marginLeft: '4px' }}
      >
        {icon}
      </div>

      {/* 数值 */}
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '1.5rem',
            lineHeight: 1.1,
            color: 'oklch(0.18 0.020 250)',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontFamily: '"Noto Sans SC", sans-serif',
            fontSize: '0.72rem',
            color: 'oklch(0.52 0.015 250)',
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
          {sub && (
            <span style={{ marginLeft: '4px', color: 'oklch(0.62 0.012 250)' }}>
              {sub}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KpiCards() {
  const { result, setActiveTab } = useApp();

  if (!result) return null;
  const { stats } = result;

  const cards: KpiCardProps[] = [
    {
      label: 'SKU 总数',
      value: stats.totalSkus,
      barClass: 'kpi-bar-blue',
      icon: <Package size={18} style={{ color: 'oklch(0.50 0.18 250)' }} />,
      sub: `TTS×${stats.ttsShops} MKD×${stats.mkdShops}`,
    },
    {
      label: 'Listing 总数',
      value: stats.totalListings,
      barClass: 'kpi-bar-gray',
      icon: <LayoutList size={18} style={{ color: 'oklch(0.52 0.015 250)' }} />,
      onClick: () => setActiveTab('listing'),
      clickable: true,
    },
    {
      label: '紧急预警',
      value: stats.urgentCount,
      barClass: 'kpi-bar-red',
      icon: <AlertTriangle size={18} style={{ color: 'oklch(0.55 0.20 25)' }} />,
      onClick: () => setActiveTab('listing'),
      clickable: stats.urgentCount > 0,
    },
    {
      label: '爆品数',
      value: stats.hotCount,
      barClass: 'kpi-bar-orange',
      icon: <Flame size={18} style={{ color: 'oklch(0.60 0.18 55)' }} />,
      onClick: () => setActiveTab('trend'),
      clickable: stats.hotCount > 0,
    },
    {
      label: '下滑预警',
      value: stats.declineCount,
      barClass: 'kpi-bar-yellow',
      icon: <TrendingDown size={18} style={{ color: 'oklch(0.58 0.16 85)' }} />,
      onClick: () => setActiveTab('trend'),
      clickable: stats.declineCount > 0,
    },
    {
      label: '需补货入仓',
      value: stats.purchaseNeeded,
      barClass: 'kpi-bar-green',
      icon: <PackagePlus size={18} style={{ color: 'oklch(0.50 0.16 145)' }} />,
      onClick: () => setActiveTab('purchase'),
      clickable: stats.purchaseNeeded > 0,
    },
  ];

  return (
    <div className="grid grid-cols-6 gap-3 mb-4" style={{ minWidth: 0 }}>
      {cards.map(card => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}
