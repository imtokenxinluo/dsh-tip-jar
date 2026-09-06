# 插件贡献者快速配置打赏（CONTRIBUTING.md）

> 你是某个插件（如荐股插件）的贡献者，想用打赏罐收打赏？三步搞定，
> 全程不需要写插件代码（除非要嵌入打赏条）。

## 前置条件

- 已安装并运行 `dsh-tip-jar`（`dsh plugin --profile <name> add dsh-tip-jar`）
- 找到打赏罐读取的注册表文件：默认是工作区根目录的 `sponsors.json`
  （部署可配置 `roots`，见插件配置；本机部署在 `D:/tool/dsh_data/sponsors.json`）

## 第 1 步：注册表登记（必做，让打赏罐页面显示你的插件）

编辑 `sponsors.json`，加一个贡献者 + 一个插件条目：

```json
{
  "schemaVersion": 1,
  "contributors": [{
    "id": "your-id",              // 你的唯一标识（如 GitHub 用户名）
    "alias": "your_alias",        // 展示名
    "verified": false,
    "ethics": { "voluntary": true, "paidWall": false },
    "tips": {
      "usdc": "0x…(你的 Polygon USDC 地址)",
      "chains": ["polygon"],
      "fiat": [{ "label": "GitHub Sponsors", "url": "https://github.com/sponsors/you" }],
      "qrCodes": [{ "label": "微信", "image": "https://…/wechat.png" }]  // 可选：平台直付收款码
    }
  }],
  "plugins": [{
    "pluginId": "你的插件id",      // 必须与插件实际 id 一致（如 dsh-stock-picks）
    "name": "你的插件名",
    "contributorId": "your-id"
  }]
}
```

保存后刷新页面 → 打赏罐「支持贡献者」页面出现你的卡片（地址 + 二维码 + 伦理徽章）。

## 第 2 步（可选但推荐）：嵌入打赏条到你的插件 UI

受益人**看完你的功能直接打赏**，不用去设置页：

```bash
npm i -D dsh-tip-jar   # 构建期依赖（embed 会打包进你的 bundle）
```

你的插件 client 里（无副作用，纯组件）：

```js
import { createElement } from 'react'
import { TipJarEmbed } from 'dsh-tip-jar/embed'

// 在你的某个 slot 里渲染（ctx 是你的插件 ctx）：
slots.register({ name: '你的slot名', id: 'my-tipjar' },
  () => createElement(TipJarEmbed, { ctx: ctx, pluginId: '你的插件id' }))
```

效果：你的插件 UI 里出现「支持作者 @你 · USDC 0x…」打赏条。
（详见 `EMBED.md`；`dsh-tip-jar` 记得放 devDependencies —— 构建期打包，不发布为运行时依赖）

## 第 3 步：验证

- **打赏罐页面**：设置 → 支持贡献者 → 看到你的卡片（地址/二维码/徽章）
- **嵌入条**（如果做了第 2 步）：你的插件 UI 里显示"支持作者 @你"

## 常见问题

**Q: 注册表在哪？**
A: 打赏罐配置的 `roots` 列表（默认工作区根 `sponsors.json`；部署可能改为其他路径，以插件配置为准）。

**Q: 格式错了会怎样？**
A: 页面显示错误提示，不崩溃。地址必须是 `0x`+40 位 hex；URL 必须是 http(s)。

**Q: 不想显示某些信息？**
A: `tips.fiat` / `subscriptions` 都是可选数组，只留你要的渠道。

**Q: 打赏怎么到账？**
A: 链上直连：受益人向你的地址转账 USDC（Polygon），约 60 秒后打赏罐致谢墙显示金额/笔数（需真实到账）。

## 参考

- [EMBED.md](EMBED.md) — 嵌入组件详解
- [QUICKSTART.md](QUICKSTART.md) — 贡献者收款完整指南
- [ETHICS.md](ETHICS.md) — 伦理规范（自愿打赏）
