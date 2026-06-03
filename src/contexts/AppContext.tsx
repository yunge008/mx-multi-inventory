/**
 * MX 海外仓库存管理系统 — 全局应用状态
 * Design: Precision Data Terminal
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AnalysisResult } from '@/lib/analyzer';

export type NavTab = 'overview' | 'listing' | 'purchase' | 'trend' | 'sku';

interface AppState {
  // 文件状态
  fileName: string | null;
  isLoading: boolean;
  loadError: string | null;
  // 分析结果
  result: AnalysisResult | null;
  // 导航
  activeTab: NavTab;
  // Listing 调整后库存（key: `${platform}-${listing_id}-${seller_sku}`）
  adjustedQty: Record<string, number>;
}

interface AppContextValue extends AppState {
  setFileName: (name: string | null) => void;
  setIsLoading: (v: boolean) => void;
  setLoadError: (e: string | null) => void;
  setResult: (r: AnalysisResult | null) => void;
  setActiveTab: (tab: NavTab) => void;
  setAdjustedQty: (key: string, qty: number) => void;
  resetAdjustedQty: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [adjustedQty, setAdjustedQtyState] = useState<Record<string, number>>({});

  const setAdjustedQty = useCallback((key: string, qty: number) => {
    setAdjustedQtyState(prev => ({ ...prev, [key]: qty }));
  }, []);

  const resetAdjustedQty = useCallback(() => {
    setAdjustedQtyState({});
  }, []);

  return (
    <AppContext.Provider value={{
      fileName, setFileName,
      isLoading, setIsLoading,
      loadError, setLoadError,
      result, setResult,
      activeTab, setActiveTab,
      adjustedQty, setAdjustedQty, resetAdjustedQty,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
