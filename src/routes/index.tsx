import { createFileRoute } from "@tanstack/react-router";
import { AppProvider, useApp } from "@/contexts/AppContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import OverviewPage from "@/components/OverviewPage";
import ListingTab from "@/components/tabs/ListingTab";
import PurchaseTab from "@/components/tabs/PurchaseTab";
import TrendTab from "@/components/tabs/TrendTab";
import SkuMatchTab from "@/components/tabs/SkuMatchTab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MX 海外仓库存管理系统" },
      { name: "description", content: "上传 Excel 自动汇总分析多店铺多仓库库存，动态调整 Listing 建议。" },
    ],
  }),
  component: () => (
    <AppProvider>
      <Home />
    </AppProvider>
  ),
});

const TAB_TITLES: Record<string, string> = {
  overview: "概览",
  listing: "Listing 调整建议",
  purchase: "采购建议",
  trend: "趋势与爆品",
  sku: "SKU 匹配表",
};

const TAB_SUBTITLES: Record<string, string> = {
  overview: "数据概览与快速跳转",
  listing: "平台上架库存状态分析，支持手填调整后库存实时计算可售天数",
  purchase: "基于 60 天备货目标的 SKU 采购缺口分析",
  trend: "近 30 天 vs 前 15 天销量对比，识别爆品与下滑品",
  sku: "平台 SKU 与海外仓 SKU 对应关系，高亮未匹配项",
};

function Home() {
  const { activeTab, result } = useApp();

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col" style={{ marginLeft: "64px", minWidth: 0 }}>
        <TopBar />
        <main className="flex-1 flex flex-col" style={{ marginTop: "52px", padding: "20px 24px", minHeight: 0 }}>
          {result && (
            <div className="mb-4">
              <div className="flex items-baseline gap-3">
                <h1
                  style={{
                    fontFamily: '"Outfit", sans-serif',
                    fontWeight: 700,
                    fontSize: "1.15rem",
                    color: "oklch(0.18 0.020 250)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {TAB_TITLES[activeTab]}
                </h1>
                <span style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: "0.78rem", color: "oklch(0.55 0.012 250)" }}>
                  {TAB_SUBTITLES[activeTab]}
                </span>
              </div>
              <div style={{ height: "2px", width: "32px", backgroundColor: "oklch(0.50 0.18 250)", borderRadius: "1px", marginTop: "6px" }} />
            </div>
          )}
          <div className="flex-1 min-h-0" style={{ animation: "fadeIn 100ms ease-out" }}>
            {activeTab === "overview" && <OverviewPage />}
            {activeTab === "listing" && result && <ListingTab />}
            {activeTab === "purchase" && result && <PurchaseTab />}
            {activeTab === "trend" && result && <TrendTab />}
            {activeTab === "sku" && result && <SkuMatchTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
