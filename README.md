# dsh-tip-jar 🫙

**打赏罐** — DeepSeek Harness 的贡献者支持系统。开源插件的贡献者只需在
`sponsors.json` 声明支持渠道（USDC / 法币平台 / 订阅 / 甲方赞助位），用户就能在
多个入口一键触达。纯 P2P，零经手，隐私默认（伪匿名 + 未验证标记）。

A tip jar for DeepSeek Harness: contributors declare their support channels once;
users tip from a sponsor-center panel, a settings page, or tool-card credits.

## 功能

- **赞助中心**：会话视图「支持」Tab + 设置页「支持贡献者」页
- **USDC (Polygon)**：收款二维码 + 复制地址（格式校验 `0x`+40hex）
  - 二维码由**宿主本地生成**（`src/qr.js`，懒加载 `qrcode` + 缓存）——不请求任何第三方 CDN：
    收款地址不会交给外部服务，出码也不受他人服务可用性影响；生成失败时降级为"仅地址 + 复制按钮"
- **法币 / 订阅**：爱发电、GitHub Sponsors、Patreon 等链接
- **甲方赞助位**：`Sponsored by …` 静态展示（作者直接与甲方洽谈）

### 三种支持渠道的区别（别混淆）

| 渠道 | 性质 | 钱进谁的口袋 | tip-jar 做什么 |
|------|------|-------------|---------------|
| **打赏**（USDC / 平台收款码） | 自愿、无条件、无回报 | 贡献者（链上直连 / 平台直付） | 展示地址与二维码；链上到账**只读**统计用于致谢墙 |
| **订阅**（Patreon / 爱发电 / GitHub Sponsors） | **商业行为**：明码标价的额外交付 | 贡献者（**由平台代收并抽成**） | 只展示跳转链接，**不参与交易** |
| **甲方赞助位** | 商业赞助（作者与甲方直接洽谈） | 贡献者 | 静态展示 `Sponsored by …` |

> **技术边界（重要）**：本插件**不代收任何款项、不处理支付、不存储任何支付凭据**。
> 对订阅与法币通道它只做**入口展示**（一个链接），交易全部发生在对应平台；
> USDC 为链上直连，本插件只**读取**公开转账记录用于致谢墙，**不持有私钥、不发起交易**。
> 订阅与打赏的伦理边界见 `ETHICS.md`（原则二：订阅必须明码标价；原则五：零中间商优先）。
- **隐私默认**：化名即可，未验证徽章，不强制真实身份
- **降级安全**：注册表缺失/损坏/地址非法 → 空态或错误提示，不崩溃
- **链上到账雷达**（0.1.5）：监听 Polygon USDC `Transfer` 事件（公共 RPC、60s 轮询、1 区块确认、自安装起算），实时统计每位贡献者的到账金额/笔数/去重支持人数，展示致谢墙
- **伦理徽章**（0.1.5）：🟢 自愿打赏 / ⚪ 未确认 / 🔴 付费墙 —— 由注册表 `ethics` 声明驱动，校验强制（自愿+无付费墙是收录前提）
- **upstream 来源声明**（0.1.6）：插件条目可声明 `upstream` 项目（署名权守门：抄代码无罪，冒名才防，规范 §5.4）
- **嵌入组件**（0.1.6）：`TipJarEmbed` —— 其他插件一行接入打赏入口（详见 `EMBED.md`）
- **收款码**（0.2.0）：微信/支付宝等平台直付收款码（`tips.qrCodes`，可选渠道）

## 演示

![打赏罐「支持贡献者」页面](assets/demo-sponsor-center.png)

*打赏罐页面：贡献者卡片展示 USDC 链上二维码 + 复制 + 微信/支付宝收款码*

![荐股插件嵌入打赏条](assets/demo-picks-embed.png)

*TipJarEmbed 嵌入：其他插件（如每日荐股）在自己 UI 里一行接入打赏*

## 快速开始（30 秒接入）

开源贡献者拿起来就能用：

```bash
# 1. 安装
dsh plugin --profile <name> add dsh-tip-jar
# 2. 复制示例注册表，改成你自己的
copy node_modules/dsh-tip-jar/sponsors.example.json sponsors.json
# 3. 编辑 sponsors.json：填你的 USDC 地址 / 打赏平台链接
# 4. 重启 Harness → 会话「支持」Tab 出现你的打赏入口
```

> 📖 完整的分步指南（字段说明 / 验证 / FAQ）见 **[QUICKSTART.md](QUICKSTART.md)**。

## 安装（常驻）

```bash
# 本地构建
npm install && npm run build

# 加入 profile（二选一）
dsh plugin --profile <name> add dsh-tip-jar
# 或将 "dsh-tip-jar" 加入 profile 的 dsh.profile.bundles（自动应用 cordis.patch.yml）
```

重启 Harness 后，所有会话都会加载赞助中心；页面刷新不丢失。

## 注册表 `sponsors.json`（工作区根目录）

```jsonc
{
  "schemaVersion": 1,
  "privacyNote": "贡献者可仅使用化名；未经认证前标记为未验证。",
  "contributors": [{
    "id": "ghost-trader",           // 必填，去重
    "alias": "ghost_trader",        // 必填，化名
    "verified": false,              // 必填；false → 未验证徽章
    "bio": "一句话介绍",
    "ethics": {                     // 0.1.5 起校验强制
      "voluntary": true,            // 自愿打赏（禁止付费墙）
      "paidWall": false             // true → 🔴 付费墙，不予收录
    },
    "tips": {
      "usdc": "0x…(40位hex)",       // 可选，格式校验
      "fiat": [{ "label": "爱发电", "url": "https://…" }],
      "qrCodes": [{ "label": "微信", "image": "…" }]  // 可选：平台直付收款码
    },
    "subscriptions": [{ "label": "Patreon", "url": "https://…" }]  // 放 tips 内也等价（两处合并、按 url 去重）
  }],
  "plugins": [{
    "pluginId": "dsh-tip-jar",
    "name": "打赏罐",
    "contributorId": "ghost-trader",  // 引用 contributors.id
    "upstream": {                     // 0.1.6：来源声明（防抄袭 L2）
      "repo": "https://github.com/…", // 上游仓库 URL（必填）
      "author": "上游作者名",          // 必填
      "license": "MIT"                // 可选
    },
    "sponsors": [{ "name": "甲方", "message": "标语", "url": "https://…" }]
  }]
}
```

完整规范见 `dsh-sponsors/PROJECT.md` 与 `dsh-sponsors/manifest-spec.md`（同仓库目录）。

## 开发

```bash
npm test    # 注册表/链上/争议/服务四套测试（红绿）
npm run build  # esbuild：host / remote / client(__ModuleLoader__)
```

## ☕ 支持作者

如果打赏罐帮你省了事，欢迎请作者喝杯咖啡 —— 完全自愿，先谢谢啦 🙏

| 链 | 地址 | 二维码 |
|----|------|--------|
| **Ethereum / EVM** | `0xcea407b16bc7ddd308d74330bdc271d490835123` | ![ETH](assets/eth.png) |

> 直接转账即可（链上到账、零中间商）。打赏罐作者不通过插件页面收打赏 —— 插件页面只服务第三方贡献者；这是作者的个人支持入口。

## License

MIT
