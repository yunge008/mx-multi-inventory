/**
 * 左侧固定侧边栏 — 64px 宽，深蓝灰背景
 * Design: Precision Data Terminal
 */
import { useApp, type NavTab } from '@/contexts/AppContext';
import {
  LayoutDashboard,
  ListChecks,
  ShoppingCart,
  TrendingUp,
  Link2,
  Warehouse,
} from 'lucide-react';

interface NavItem {
  id: NavTab;
  icon: React.ReactNode;
  label: string;
  requiresData?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', icon: <LayoutDashboard size={20} />, label: '概览' },
  { id: 'listing', icon: <ListChecks size={20} />, label: 'Listing', requiresData: true },
  { id: 'purchase', icon: <ShoppingCart size={20} />, label: '采购', requiresData: true },
  { id: 'trend', icon: <TrendingUp size={20} />, label: '趋势', requiresData: true },
  { id: 'sku', icon: <Link2 size={20} />, label: 'SKU', requiresData: true },
];

export default function Sidebar() {
  const { activeTab, setActiveTab, result } = useApp();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-16 flex flex-col items-center py-4 z-30"
      style={{ backgroundColor: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center gap-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--sidebar-primary)' }}
        >
          <Warehouse size={18} style={{ color: 'var(--sidebar-primary-foreground)' }} />
        </div>
      </div>

      {/* Divider */}
      <div className="w-8 h-px mb-4" style={{ backgroundColor: 'var(--sidebar-border)' }} />

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 flex-1 w-full items-center">
        {NAV_ITEMS.map(item => {
          const isActive = activeTab === item.id;
          const isDisabled = item.requiresData && !result;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveTab(item.id)}
              disabled={isDisabled}
              title={item.label}
              className="relative w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150"
              style={{
                backgroundColor: isActive
                  ? 'var(--sidebar-accent)'
                  : 'transparent',
                color: isActive
                  ? 'var(--sidebar-accent-foreground)'
                  : isDisabled
                    ? 'oklch(0.45 0.015 250)'
                    : 'var(--sidebar-foreground)',
                opacity: isDisabled ? 0.4 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {/* 激活指示条 */}
              {isActive && <span className="sidebar-active-bar" />}

              {item.icon}
              <span style={{
                fontSize: '0.60rem',
                fontFamily: '"Noto Sans SC", sans-serif',
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1,
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 底部版本号 */}
      <div style={{ color: 'oklch(0.40 0.012 250)', fontSize: '0.55rem', fontFamily: '"JetBrains Mono", monospace' }}>
        v1.0
      </div>
    </aside>
  );
}
