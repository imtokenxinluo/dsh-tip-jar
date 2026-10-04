# dsh-tip-jar 快速开始指南

> **目标**：30 分钟内，让任何开源贡献者拥有自己的打赏入口（USDC 链上直连 + 法币平台），无需写代码、无需服务器、零中间商抽成。

## 你能得到什么

- 🫙 会话「支持」Tab 里的**贡献者卡片**（受益人一键打赏）
- ⛓️ **链上到账雷达**：Polygon USDC 转账实时统计 + 致谢墙（金额、笔数、去重支持人数）
- 🧩 **嵌入组件**：把你自己的打赏入口嵌进插件 UI（一行代码）
- 🛡️ 伦理徽章（自愿打赏声明）+ 免责声明 + 大额打赏提醒

## 前置条件

| 项 | 要求 |
|---|---|
| DeepSeek Harness | 已安装并运行（`dsh web` / GUI） |
| Node.js + pnpm | dsh 生态标准工具链 |
| 收款地址（可选但推荐） | 一个 **Polygon 网络**的 USDC 收款地址（交易所/钱包都有，如 OKX 钱包地址即可） |

## 第 1 步：安装插件

```bash
dsh plugin --profile <name> add dsh-tip-jar
```

> `<name>` 是你的 profile 名（常见为 `web`）。也可以手动把 `dsh-tip-jar` 加进 profile 的 `dsh.profile.bundles`。

## 第 2 步：创建你的注册表

```bash
# 把包内示例复制到工作区根目录
copy node_modules/dsh-tip-jar/sponsors.example.json sponsors.json
```

> 若 `node_modules` 路径不便，也可直接新建 `sponsors.json`（见下方字段说明）。

## 第 3 步：编辑 sponsors.json

```jsonc
{
  "schemaVersion": 1,
  "privacyNote": "…（可选，展示给受益人的隐私说明）",
  "contributors": [{
    "id": "your-id",              // 必填：唯一标识（如 GitHub 用户名）
    "alias": "your_alias",        // 必填：展示的化名（可用真名或化名）
    "verified": false,            // 必填：false = 未验证徽章（生态认证前）
    "bio": "一句话简介",           // 可选
    "ethics": {                   // 必填：伦理声明
      "voluntary": true,          // 自愿打赏（无付费墙）
      "paidWall": false           // false = 无付费墙
    },
    "tips": {
      "usdc": "0x…(40位hex)",     // 可选：Polygon USDC 收款地址
      "chains": ["polygon"],      // 可选：支持的链
      "fiat": [                   // 可选：法币/平台链接
        { "label": "爱发电", "url": "https://afdian.com/a/你的ID" },
        { "label": "GitHub Sponsors", "url": "https://github.com/sponsors/你的GitHub" }
      ],
      "qrCodes": [                // 可选：收款码图片（微信/支付宝/数币等平台直付）
        { "label": "微信", "image": "https://…/wechat.png 或 /assets/wechat.png" },
        { "label": "支付宝", "image": "…" }
      ]
    },
    "subscriptions": []           // 可选：订阅（须对应额外交付）；写在 tips 内同样生效（两处合并去重）
  }],
  "plugins": [{
    "pluginId": "your-plugin-id", // 必填：你的插件 ID
    "name": "你的插件名",
    "contributorId": "your-id",   // 引用 contributors[].id
    "upstream": {                 // 可选：若参照了其他项目，声明来源（署名义务）
      "repo": "https://github.com/…",
      "author": "上游作者",
      "license": "MIT"
    }
  }]
}
```

**最低可用的最小配置**：

```json
{
  "schemaVersion": 1,
  "contributors": [{
    "id": "me",
    "alias": "my_name",
    "verified": false,
    "ethics": { "voluntary": true, "paidWall": false },
    "tips": { "usdc": "0x0000000000000000000000000000000000000000" }
  }],
  "plugins": [{ "pluginId": "my-plugin", "name": "我的插件", "contributorId": "me" }]
}
```

> ⚠️ 格式错误（地址非法、URL 非法、引用缺失）会在面板显示错误提示，不会崩溃。

## 第 3.5 步：先校验，再重启（推荐）

编辑完 `sponsors.json` 后，用包内自带的命令校验一遍——不用等重启才发现填错：

```bash
npx dsh-tip-jar-validate sponsors.json
```

通过时：

```
✓ sponsors.json 校验通过（1 个贡献者 / 1 个插件）
```

有问题时逐条指出，**退出码非 0**（可以直接挂在 CI 里）：

```
✗ contributors[0].tips.usdc 地址格式无效: 0xNOTHEX
✗ plugins[0].contributorId 未知: MISSING
```

**编辑器自动补全 / 实时校验**：`sponsors.schema.json` 是机器可读的 JSON Schema，
在 `sponsors.json` 里加一行 `$schema` 即可让 VSCode 等编辑器补全字段并即时标错：

```json
{
  "$schema": "./node_modules/dsh-tip-jar/sponsors.schema.json",
  "schemaVersion": 1,
  "contributors": [ … ],
  "plugins": [ … ]
}
```

> 校验规则只有一份实现（`src/validate.js`），Schema 与它由测试逐字比对——
> 不会出现"编辑器说合法、运行时却拒绝"的情况。

## 第 4 步：重启并验证

1. 重启 Harness（`/restart` 或重启进程）
2. 打开任意会话 → 「支持」Tab
3. 看到你的卡片 = 上线成功 ✅

受益人此时可以：扫码/复制你的 USDC 地址转账（Polygon，链上可追踪 → 致谢墙）、点击法币链接、**扫微信/支付宝收款码**（如果你配置了 `qrCodes`，平台直付、不走链上、无致谢墙）、看到你的伦理徽章。

## 第 5 步（可选）：嵌入你自己的插件 UI

其他插件只需在自己的构建中引入 `dsh-tip-jar/embed`（纯 ESM 组件，无副作用）：

```js
import { createElement } from 'react'
import { TipJarEmbed } from 'dsh-tip-jar/embed'

// 在你的 slot 里：
slots.register({ name: '你的slot名', id: 'my-tipjar' },
  () => createElement(TipJarEmbed, { ctx: ctx, pluginId: 'your-plugin-id' }))
```

详见 [EMBED.md](EMBED.md)。

## 收到打赏后会发生什么

1. 受益者在 Polygon 网络向你的地址转账 USDC（原生直连，无中间商）
2. 链上雷达（约 60 秒轮询、1 区块确认）检测到转账
3. 致谢墙实时显示：金额 + 笔数 + 去重支持人数
4. 所有记录本地持久化（`D:/tool/dsh_data/` 或配置的 statsFiles）

## 常见问题

**Q: 我没有 USDC 地址怎么办？**
A: 任何支持 Polygon 的钱包/交易所（OKX、MetaMask 等）都能生成 EVM 地址。打赏只收 USDC（Polygon 原生合约）。没有地址可以只放法币平台链接（爱发电/GitHub Sponsors/Ko-fi）。

**Q: 打赏的钱去哪了？**
A: 直接到你的地址 —— 插件不代收、不托管、不经手任何资金，纯 P2P。

**Q: 必须要真实身份吗？**
A: 不需要。化名即可（`alias`），地址公开与否自选。未经生态认证前显示"未验证"徽章。

**Q: 可以放多个收款渠道吗？**
A: 可以。`tips.fiat` 是数组，USDC + 爱发电 + GitHub Sponsors 可同时存在。

**Q: 打赏罐是打赏给谁用的？**
A: 打赏罐是**服务其他插件/项目贡献者的工具** —— 注册表里登记的是第三方贡献者及其插件，打赏罐作者不在此列。页面展示的是"支持贡献者"（使用打赏罐的人），不是打赏罐自己。

## 下一步

- [EMBED.md](EMBED.md) — 嵌入组件详解
- [ETHICS.md](ETHICS.md) — 伦理规范（自愿打赏基线）
- [ECOSYSTEM-RISKS.md](ECOSYSTEM-RISKS.md) — 治理机制（冒名防欺诈/署名权守门）
- [README.md](README.md) — 完整功能与开发
