# 嵌入式打赏组件：其他插件一行接入 (EMBED.md)

dsh-tip-jar 除了独立赞助面板（「支持」Tab / 设置页），还提供**可嵌入的打赏组件** `TipJarEmbed`，
让其他插件/工具在自己的 UI 里直接展示"支持作者"入口——受益者在用你的插件时顺手打赏，无需跳转。

## 组件能力

`TipJarEmbed` 渲染一个紧凑打赏条：

```
🤝 AI 交易助手
支持作者 @ghost_trader [🟢 自愿打赏] · USDC 0x1111…1111 · $3.00 / 2 笔
```

- 读取注册表（sponsors.json）中 `pluginId` 对应的插件 → 贡献者
- 展示：伦理徽章（自愿/未确认/付费墙）、USDC 短地址、链上雷达统计
- 未登记 → 空态提示；数据不可用 → 降级提示，不崩溃

## 接入方式（一行）

在你的插件 Client 代码里，**在自己的构建中引入** `dsh-tip-jar/embed`（纯 ESM、无副作用），
并渲染组件：

### 最省事：真·一行（推荐）

```js
import { registerTipJarSlot } from 'dsh-tip-jar/embed'

// 在你的插件 client 半的 apply(ctx) 里：
registerTipJarSlot(ctx, {
  pluginId: 'my-plugin-id',                     // 必须已在 sponsors.json 的 plugins[] 登记
  slot: 'conversation.session.header.actions',  // 想挂到哪个 slot
  // order: 80,                                 // 可选，默认 80
  // id: 'my-tipjar',                           // 可选，默认 `<pluginId>-tipjar`
})
```

它替你做完三件事：`slots.inject` + `slots.register` + **"宿主没装 tip-jar / 没有 slots
服务时静默跳过"**——打赏入口的缺失不该让你的插件崩。返回值就是 `slots.inject` 的 disposer
（可直接交给 `ctx.effect`，或忽略）。

### 手动方式（需要自己控制渲染时）

```js
// 你的插件（client 半，自己的 esbuild 构建）
import { createElement } from 'react'
import { TipJarEmbed } from 'dsh-tip-jar/embed'

// 在你的某个 slot（如会话标题栏动作、工具卡、你自己的面板）里：
slots.inject('conversation.session.header.actions', function () {
  return slots.register(
    { name: 'conversation.session.header.actions', id: 'my-tipjar', order: 80 },
    function () { return createElement(TipJarEmbed, { ctx: ctx, pluginId: 'my-plugin-id' }) },
  )
})
```

### 完整可复制的最小插件（client 半）

把这段放进你的插件 `src/client.js` 就能跑（`slot` 换成你要挂的位置）：

```js
import { registerTipJarSlot } from 'dsh-tip-jar/embed'

export default {
  name: 'my-plugin-tipjar-entry',
  inject: ['slots'],
  apply(ctx) {
    ctx.effect(function () {
      return registerTipJarSlot(ctx, {
        pluginId: 'my-plugin-id',
        slot: 'conversation.session.header.actions',
      })
    })
  },
}
```

接入检查清单（三步，约 3 分钟）：

1. `npm i dsh-tip-jar`（或确认目标机器已装并启用该插件）
2. 在 `sponsors.json` 里登记：`plugins[]` 加一条 `{ pluginId, contributorId }`，指向已存在的 `contributors[]`
3. 把上面那 6 行放进你的 client 半；重新构建、重启 DSH

用 `npx dsh-tip-jar-validate sponsors.json` 确认登记没写错（第 3.5 步）。

只需两步：
1. `import { TipJarEmbed } from 'dsh-tip-jar/embed'`（你的构建把该 ESM 打包进自己的 bundle，`react` 保持 external）
2. 在你的 slot 渲染 `<TipJarEmbed ctx={你的ctx} pluginId="你的插件id" />`

`pluginId` 必须在 `sponsors.json` 的 `plugins[]` 中登记（并指向 `contributors[]`）。

> ⚠️ **为什么用 `/embed` 而不是 `/client`**：dsh 平台禁止插件之间在**运行时**互相导入对方
> client 模块的导出（ModuleLoader 的 factory 返回即导出，跨包 value import 是平台级构建错误）。
> `dsh-tip-jar/client` 是给 dsh-tip-jar 自己用的 ModuleLoader bundle；
> 给**其他插件**用的干净入口是 `dsh-tip-jar/embed` —— 纯 ESM 组件模块，在你的构建时打包进去。

## 依赖与限制（诚实说明）

| 项 | 说明 |
|----|------|
| 依赖 | 目标机器须已安装并运行 dsh-tip-jar（提供 Remote 命名空间 + CSS；`dsh plugin add dsh-tip-jar`） |
| 打包 | 用 `dsh-tip-jar/embed`（ESM）；你自己的构建负责打包它，`react` 保持 external（与 dsh 插件构建惯例一致） |
| 数据源 | 组件通过 dsh-tip-jar 的 Remote 命名空间读取（全局可用），无需你的插件额外接线 |
| 未安装时 | 组件渲染降级提示（"tipJar Remote 未挂载"），不影响你的插件功能 |
| 纯函数 | 也可只 import `resolveEmbed(sponsors, pluginId, stats)` 自己拼 UI |

## 注册表登记示例

```jsonc
// sponsors.json
{ "plugins": [
  { "pluginId": "my-plugin-id", "name": "我的插件", "contributorId": "ghost-trader",
    "upstream": { "repo": "https://github.com/you/my-plugin", "author": "you" } }
] }
```

## 独立面板 vs 嵌入组件

| | 独立面板 | 嵌入组件 |
|---|---|---|
| 形态 | 全局「支持」Tab + 设置页 | 插件自己的 UI 内 |
| 适用 | 集中浏览所有贡献者 | 受益者就在场景里时 |
| 关系 | 两者数据同源（注册表 + Remote） | 可同时存在 |

## 常见坑（接入方最容易绊到的地方）

| 现象 | 原因 | 处理 |
|------|------|------|
| 组件渲染成**裸 HTML**（有文字没样式） | `sps-*` 的样式由 **dsh-tip-jar 自己的 client** 提供，本组件**不注入样式**；目标机器没装/没启用它 | 装并启用 dsh-tip-jar，或接受无样式降级 |
| 一直"加载中…" | Remote 命名空间没挂载（宿主未启用），或工作区根目录没有 `sponsors.json` | 确认宿主插件在跑；用 `npx dsh-tip-jar-validate sponsors.json` 验证文件 |
| "该插件未在赞助注册表登记" | `plugins[]` 里没有你的 `pluginId` | 用**完全一致**的 `pluginId`（大小写敏感）登记 |
| "贡献者未登记" | `contributorId` 指向了不存在的贡献者 | 在 `contributors[]` 先建好，再由 `plugins[]` 引用 |
| 二维码不显示 | 宿主侧生成失败（`qrcode` 不可用等） | 组件已降级为"仅地址 + 复制按钮"，不影响收款 |
| 你的插件因打赏入口崩了 | 直接 import 了 `dsh-tip-jar/client`（平台禁止跨包 value import） | 只从 `dsh-tip-jar/embed` 引入；用 `registerTipJarSlot` 时缺环境会自动跳过 |

## 更多

- 伦理规范：`ETHICS.md`（自愿打赏）
- 治理机制：`ECOSYSTEM-RISKS.md`（冒名防欺诈/署名权守门）
- 注册表 Schema：`sponsors.schema.json`（机器可读，编辑器可自动补全）+ `PROJECT.md` §4（叙述）
- 校验命令：`npx dsh-tip-jar-validate sponsors.json`
