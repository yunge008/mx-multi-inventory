# AGENTS.md

面向 Claude Code / Codex 等 AI 编码助手的项目说明。修改代码前请先读完本文件，
尤其是「核心业务不变量」一节——这是本项目最容易被无意破坏的部分。

## 项目是什么

MX（墨西哥）跨境电商多店铺库存管理工具。用户在浏览器上传一份 Excel，工具在**纯前端**
解析并计算各店铺（TikTok Shop / 美客多）的库存调整、采购、趋势建议。没有后端数据库，
没有登录态，没有服务端持久化。核心计算逻辑集中在一个文件：`src/lib/analyzer.ts`。

## 技术栈与命令

包管理器是 **Bun**（不要用 npm/yarn/pnpm，仓库只有 `bun.lock`）。

```bash
bun install       # 安装依赖
bun dev           # 开发服务器
bun run build     # 生产构建
bun run lint      # ESLint（typescript-eslint + react-hooks + prettier 插件）
bun run format    # Prettier 格式化
```

改完代码后，至少跑一次 `bun run lint`；涉及路由/构建配置的改动再跑一次 `bun run build`
确认能过。**仓库里没有单元测试**，改 `src/lib/analyzer.ts` 里的计算逻辑时，改动前后
手动过一遍相关 Sheet 的示例数据（或在浏览器里跑一次真实 Excel）比盲目相信 TS 类型检查更可靠。

栈组成：TanStack Start（文件路由 + SSR）+ React 19 + Vite 7 + Tailwind CSS 4 +
shadcn/ui（Radix，New York 风格，见 `components.json`）+ SheetJS（通过 CDN `<script>`
注入 `window.XLSX`，不是 npm 依赖）。项目由 Lovable 生成，`vite.config.ts` 里的插件
由 `@lovable.dev/vite-tanstack-config` 统一管理。

## 硬性约束（改代码前必须知道）

- **不要重复添加 `vite.config.ts` 里已经包含的插件**（tanstackStart、viteReact、
  tailwindcss、tsConfigPaths、nitro、componentTagger 等）——`@lovable.dev/vite-tanstack-config`
  已经内置，重复添加会导致插件冲突报错。需要额外配置时通过 `defineConfig({ vite: {...} })` 传入。
- **文件路由遵循 TanStack Start 约定**（见 `src/routes/README.md`）：不要创建
  `src/pages/`、`src/routes/_app/index.tsx`、`app/layout.tsx` 这类 Next.js/Remix 目录结构；
  唯一的根布局是 `src/routes/__root.tsx`。`src/routeTree.gen.ts` 是自动生成文件，**禁止手改**。
- **服务端专用代码放 `*.server.ts`**，不要 import `server-only` 包（ESLint 会直接报错，
  见 `eslint.config.js` 的 `no-restricted-imports`）。Cloudflare Workers 上 env 在请求时才绑定，
  模块顶层的 `process.env.X` 会拿到 `undefined`——必须在函数/handler 内部读取
  （见 `src/lib/config.server.ts` 注释）。
- **公开配置**（分析上报 ID、公开 URL 等）用 `import.meta.env.VITE_FOO`，写在 `.env` 里，
  **绝不要把密钥放这里**——`VITE_` 前缀的值会被打进浏览器 bundle。
- **`bunfig.toml` 有 24 小时供应链防护**（`minimumReleaseAge`），跳过某个包需要加进
  `minimumReleaseAgeExcludes`——**加白名单前必须和用户确认**，不要自作主张添加。
- SheetJS（`XLSX`）不是 npm 依赖，是 `src/routes/__root.tsx` 里的 CDN `<script>` 注入的
  全局对象。`src/lib/analyzer.ts` 里通过 `(window as any).XLSX` 访问，只能在客户端调用，
  不能在 `.server.ts` 或 SSR 路径里用。

## 核心业务不变量（最容易被无意破坏）

`src/lib/analyzer.ts` 顶部注释详细描述了 SKU 映射规则，这是整个系统最关键、最容易被
"优化" 坏掉的部分，改动前务必完整理解：

- SKU 映射**完全依赖** Excel 里的 `SKU匹配表` Sheet（A店铺 / B平台SKU / C海外仓SKU1 /
  D组合品1 / E组合品2），**禁止做任何自动规范化/模糊匹配**（比如去空格后近似匹配、
  大小写归一化后猜测对应关系）。查不到映射就是查不到，不要"智能"补全。
- 三种映射情况严格互斥，不要合并简化：
  1. 只有 C 列：直接用 C 列 key 查仓库库存（单品直接映射）。
  2. C + D/E 均有值：优先用 C 列成品库存，成品不足时用 `min(D库存, E库存)` 补充。
  3. C 为空、只有 D/E：直接用 `min(D库存, E库存)` 作为可用量（不拆解 `+` 号，D/E 列的值
     本身就是仓库 key）。
- 调减建议有前置条件：**美客多链接永远不做调减**；TTS 链接要同一 SKU 下至少存在一个
  可售天数 ≤60 天的链接才允许对其他链接调减。改任何"补货/调减"场景的判定逻辑时，保留这个
  前置条件，不要让美客多也被建议调减。
- 采购表/趋势表以「海外仓 SKU」为主键去重汇总（不是平台 SKU），主键规则：
  single/direct/insufficient 用 C 列（whSku1），assembled 用 `comp1+comp2` 拼接，
  未匹配用平台 SKU 兜底。
- 店铺代码是固定枚举：TTS 侧 `MX-AR` / `MX-NE` / `MX-SJ`，美客多侧 `MX-AR` / `MX-NE`。
  新增店铺需要同时改 `analyzeInventory` 里的 `TTS_SHOPS`/`MKD_SHOPS` 数组、Sheet 命名
  约定（`{店铺} TTS商品表`、`{店铺}美客多 商品表`）以及各处按店铺分列的字段
  （`tts_ar_s30`/`mkd_ne_s30` 这类硬编码字段名），别只改一处。

## 代码约定

- 路径别名 `@/*` → `src/*`（见 `tsconfig.json`），组件/页面统一用别名 import，不要用相对路径
  跳出当前目录太多层。
- Prettier：双引号、分号、`printWidth 100`、trailing comma all（见 `.prettierrc`），格式问题
  交给 `bun run format`，不要手动纠结缩进/引号风格。
- `noUnusedLocals`/`noUnusedParameters` 关闭，`@typescript-eslint/no-unused-vars` 也关闭——
  不代表可以随意留死代码，只是工具链不会替你拦截，肉眼把关。
- UI 组件走 shadcn/ui 惯例（`src/components/ui/*` 是生成的基础组件，业务组件在
  `src/components/` 与 `src/components/tabs/*`）。新增 shadcn 组件用 `components.json`
  里的别名配置，不要手写重复的基础组件。
- 中文注释/文案是项目现状，业务相关的组件/计算逻辑保持中文注释风格，不必强行改英文。

## 目录速查

```
src/
  lib/analyzer.ts         # 核心：Excel 解析 + 库存/销量/建议计算（唯一的"业务逻辑"文件）
  lib/config.server.ts    # 服务端专用配置读取模式示例
  contexts/AppContext.tsx # 全局状态：当前分析结果、激活 Tab、手填调整库存
  components/
    UploadZone.tsx         # 拖拽/点击上传 Excel，调用 analyzeInventory
    OverviewPage.tsx / KpiCards.tsx
    Sidebar.tsx / TopBar.tsx
    tabs/                  # ListingTab / PurchaseTab / TrendTab / SkuMatchTab
    ui/                    # shadcn/ui 基础组件，一般不需要手改
  routes/                  # TanStack Start 文件路由；index.tsx = "/"；__root.tsx = 应用外壳
  routeTree.gen.ts         # 自动生成，禁止手改
  server.ts                # SSR 入口的错误兜底包装
```

## 改动后的自查清单

1. `bun run lint` 通过。
2. 涉及 `analyzer.ts` 的改动：确认没有引入自动 SKU 模糊匹配、没有破坏三种映射情况的
   互斥性、没有让美客多链接出现调减建议。
3. 涉及路由的改动：没有手改 `routeTree.gen.ts`，没有创建 Next.js/Remix 风格的目录。
4. 涉及依赖新增：如果需要绕过 `bunfig.toml` 的 24 小时供应链防护，先跟用户确认。
