# 变更记录

> 每条标注 **必更**（遇到这个问题的人）或 **可跳**（没遇到的人不更新也不会出事）。
> 完整历史见 `git log`；发布纪律见 `RELEASING.md`。

## Unreleased（尚未发布）

**可跳** —— 除非你在用嵌入式打赏条（`TipJarEmbed`）

- **修三处静默失败**：嵌入条 `listSponsors` 失败时，此前会永远停在"加载中…"；
  现在显示"加载失败：<原因>"并打 `console.warn`。`tipStats`（只影响致谢墙）与
  `saveTipStats`（链上进度未持久化）失败也改为告警而不是吞掉。
  与 0.2.4 修掉的 qrPng 静默失败属于同一类问题 —— 功能坏了，界面却什么都不说。
- `npm test` 现在真的跑全部 6 个测试文件（此前只跑 `registry.test.js` 一个）。
- README 顶部新增「30 秒上手」；新增 `RELEASING.md`（发布纪律）。

## 0.2.6 — 2026-10-18

**必更** —— 如果你在 DSH 0.2.x 上遇到过「设置 → 支持贡献者」**整块空白**，或 USDC 二维码从不出现

- 修复面板**整块空白**：`QrImage` 引用了作用域外的 `h`，一旦 `qrPng` 成功就抛
  `ReferenceError`。这是 0.2.4 修好 qrPng 之后才被激活的潜伏 bug ——
  在此之前它永远走不到那一行，所以从未暴露。
- 面板渲染崩溃改为**把错误显示在页面上**（ErrorBoundary + `componentDidCatch`），
  不再是一片空白、无从排查。
- 把 `lib/` 运行产物纳入 git，并声明 `engines.node >= 20`（DSH STORE 的两项收录要求）。
- 链接型渠道（法币 / 订阅）移到二维码**下方**独立区块，不再把二维码切断。

## 0.2.5 — 2026-10-11

**必更** —— 如果你的 USDC 码一直不显示

- **`qrcode` 改为构建期 external**：它此前被打进宿主 bundle，内部的 `require('fs')`
  在 ESM 宿主里抛 `Dynamic require of "fs" is not supported`，导致 **`qrPng` 每次调用必失败**
  —— USDC 码因此永久缺失，而错误被空 catch 吞掉，界面上只表现为"没有码"。
- 二维码显示尺寸 76 → **120px**（微信/支付宝的码点密，76px 在手机上难以识别）。
- 修复 `repository` / `homepage` / `bugs` 仍指向已停用账号的问题。
- 面板订阅渲染与 `tips.subscriptions` 对齐；`qrPng` 失败会打 `console.warn`。

## 0.2.4 — 2026-10-04

**必更** —— DSH 0.2 用户（0.2.3 会丢订阅，且部分环境下被拒载）

- strict codec 补 `create()` 工厂（DSH 0.2 的 `typert-loader` 硬性要求，缺了直接拒绝加载）。
- `subscriptions` 允许写在 `tips` 内（此前写在里面**静默失效**：不报错、也永远不显示）；
  两处都会读取并按 url 去重合并。
- `subscriptions: null` 视为"未登记"，与 `tips.usdc` 的既有规则一致。

## 0.2.3 — 2026-10-04

**必更** —— DSH 0.2 用户

- peer 声明改为 `^0.1.0-rc.6 || ^0.2.0-rc.2`。此前只声明 0.1.x，DSH 0.2 直接拒绝加载。

## 0.2.0 – 0.2.2 — 2026-09-06 ~ 2026-10-03

- **0.2.2**：嵌入版补齐法币 / 订阅 / 平台收款码三条渠道；二维码改由宿主本地生成
  （不再请求第三方 CDN，收款地址不离开本机）；自带样式；`registerTipJarSlot` 一行接入；
  贡献者支持者计数。
- **0.2.1**：每个收款码独占一行（USDC / 微信 / 支付宝），此前挤在一行难以分辨。
- **0.2.0**：微信 / 支付宝收款码（平台直付）支持。

## 0.1.x — 2026-08-30 ~ 2026-09-02

首版与早期修复：注册表校验器、赞助中心、typert remote、`sponsors.schema.json` 与
`dsh-tip-jar-validate` CLI、打包完整性修复。详见 `git log`。