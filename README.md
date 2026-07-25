# MX 海外仓库存管理系统

面向墨西哥（MX）跨境电商多店铺、多平台的库存分析工具。上传一份 Excel 表格，自动汇总
TikTok Shop（TTS）与 Mercado Libre（美客多 / MKD）多个店铺的上架库存、销量与海外仓库存，
给出补货 / 调减 / 采购建议，识别爆品与下滑品。

纯前端运行：Excel 在浏览器本地解析，**不上传到任何服务器**，刷新页面后数据即清空。

## 这是给谁用的

- 需要每天/每周核对 MX 站点多个店铺（TTS MX-AR / MX-NE / MX-SJ、美客多 MX-AR / MX-NE）
  库存与销量、决定加货/减货/采购数量的运营人员。
- 需要维护本工具本身的开发者。

## 功能一览

上传 Excel 后，左侧导航提供 5 个页面：

| 页面 | 作用 |
| --- | --- |
| 概览 | 关键指标卡片（SKU 总数、紧急预警数、爆品数、下滑数、待采购数等），快速跳转 |
| Listing 调整建议 | 按每个平台链接（Listing）给出加库存/减库存建议，可手填「调整后库存」实时重算可售天数 |
| 采购建议 | 以海外仓 SKU 为主键，按 60 天备货目标计算采购缺口（扣减在途库存） |
| 趋势与爆品 | 近 15 天 vs 前 15 天销量对比，标注加速上升 / 上升 / 平稳 / 下滑 / 加速下滑，识别爆品与下滑品 |
| SKU 匹配表 | 平台 SKU 与海外仓 SKU 的映射关系，高亮未匹配 / 库存不足项 |

每个表格页面均支持导出 CSV。

## Excel 文件要求

上传的工作簿（`.xlsx` / `.xls`）需要包含以下 Sheet（页签名称需完全一致）：

| Sheet 名称 | 说明 | 是否必需 |
| --- | --- | --- |
| `SKU匹配表` | 平台 SKU → 海外仓 SKU 的映射表（A 店铺 / B 平台SKU / C 海外仓SKU1 / D 组合品1 / E 组合品2） | 是（核心） |
| `仙人掌海外仓库存` | 海外仓可用库存、在途库存 | 是 |
| `{店铺} TTS商品表`（如 `MX-AR TTS商品表`） | TTS 平台上架 SKU 与库存 | 是（每个 TTS 店铺一张） |
| `{店铺} TTS订单` | TTS 订单流水，用于计算销量 | 是 |
| `{店铺}美客多 商品表`（如 `MX-AR美客多 商品表`） | 美客多平台上架 SKU 与库存 | 是（每个美客多店铺一张） |
| `upseller流水` | 美客多订单流水，用于计算销量 | 是 |

支持的店铺代码：TTS 侧 `MX-AR` / `MX-NE` / `MX-SJ`，美客多侧 `MX-AR` / `MX-NE`。

**SKU 映射规则完全依赖 `SKU匹配表`，系统不做任何自动模糊匹配**（详见
`src/lib/analyzer.ts` 顶部注释）：

1. 只有 C 列（海外仓SKU1）：直接按该 SKU 查仓库库存。
2. C 列 + D/E 列均有值：优先用 C 列成品库存，不足时用 `min(D库存, E库存)` 补充。
3. C 列为空、只有 D/E 列：直接用 `min(D库存, E库存)` 作为可用量（纯拆解组合）。

## 本地运行

本项目使用 [Bun](https://bun.sh) 作为包管理器与运行时。

```bash
bun install       # 安装依赖
bun dev           # 启动开发服务器
bun run build     # 构建生产版本
bun run preview   # 本地预览构建产物
bun run lint      # ESLint 检查
bun run format    # Prettier 格式化
```

## 技术栈

- [TanStack Start](https://tanstack.com/start)（文件路由 + SSR）+ React 19 + Vite 7
- Tailwind CSS 4 + shadcn/ui（Radix 组件，New York 风格）
- [SheetJS (xlsx)](https://sheetjs.com/) 通过 CDN 脚本注入 `window.XLSX`，在浏览器端解析 Excel
- 由 [Lovable](https://lovable.dev) 生成与托管构建配置

## 数据与隐私

- Excel 文件只在浏览器内存中解析（`src/lib/analyzer.ts`），不会上传到任何后端或第三方服务。
- 刷新或关闭页面后，已上传的数据即丢失，不做持久化存储。
- 页面加载会从 Google Fonts 与 SheetJS CDN 拉取字体/脚本资源，其余无外部请求。

## 项目结构

```
src/
  lib/analyzer.ts        # 核心计算引擎：Excel 解析 + 库存/销量/建议计算
  contexts/AppContext.tsx # 全局状态（当前分析结果、激活 Tab、手填调整库存）
  components/
    UploadZone.tsx        # 拖拽/点击上传 Excel
    OverviewPage.tsx / KpiCards.tsx
    tabs/                 # 4 个功能页签
  routes/                 # TanStack Start 文件路由（index.tsx = "/"）
```

如果需要修改核心业务规则（补货/调减判定、采购目标天数、SKU 映射逻辑等），改动集中在
`src/lib/analyzer.ts`，改动前建议先阅读文件顶部注释，理解店铺代码、映射规则与场景判定逻辑。
