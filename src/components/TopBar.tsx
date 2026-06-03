/**
 * 顶部标题栏 — 高度 52px，固定
 * Design: Precision Data Terminal
 */
import { useApp } from '@/contexts/AppContext';
import { FileSpreadsheet, RefreshCw, AlertCircle } from 'lucide-react';

export default function TopBar() {
  const { fileName, result, isLoading, loadError, setResult, setFileName, setLoadError, resetAdjustedQty } = useApp();

  const handleReset = () => {
    setResult(null);
    setFileName(null);
    setLoadError(null);
    resetAdjustedQty();
  };

  return (
    <header
      className="fixed top-0 left-16 right-0 h-[52px] flex items-center px-5 gap-3 z-20"
      style={{
        backgroundColor: 'oklch(1 0 0)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 3px oklch(0 0 0 / 0.05)',
      }}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span
          style={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '1rem',
            color: 'oklch(0.20 0.020 250)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          MX 海外仓库存管理系统
        </span>

        {result && (
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.70rem',
              color: 'oklch(0.55 0.015 250)',
              backgroundColor: 'oklch(0.955 0.005 240)',
              padding: '2px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            数据日期：{result.stats.dataDate}
          </span>
        )}
      </div>

      {/* 文件信息 & 操作 */}
      <div className="flex items-center gap-3">
        {loadError && (
          <div className="flex items-center gap-1.5" style={{ color: 'oklch(0.50 0.20 25)', fontSize: '0.78rem' }}>
            <AlertCircle size={14} />
            <span>{loadError}</span>
          </div>
        )}

        {fileName && (
          <div className="flex items-center gap-1.5" style={{ color: 'oklch(0.45 0.015 250)', fontSize: '0.78rem' }}>
            <FileSpreadsheet size={14} style={{ color: 'oklch(0.50 0.16 145)' }} />
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fileName}
            </span>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-1.5" style={{ color: 'oklch(0.50 0.18 250)', fontSize: '0.78rem' }}>
            <RefreshCw size={13} className="animate-spin" />
            <span>解析中…</span>
          </div>
        )}

        {result && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
            style={{
              fontSize: '0.78rem',
              fontFamily: '"Noto Sans SC", sans-serif',
              color: 'oklch(0.45 0.015 250)',
              backgroundColor: 'oklch(0.955 0.005 240)',
              border: '1px solid oklch(0.88 0.006 240)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'oklch(0.94 0.008 240)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'oklch(0.955 0.005 240)')}
          >
            <RefreshCw size={12} />
            重新上传
          </button>
        )}
      </div>
    </header>
  );
}
