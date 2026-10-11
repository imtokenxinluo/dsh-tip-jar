// dsh-tip-jar/src/embed.js
// 嵌入式打赏组件模块（纯 ESM，无副作用）：
// 供其他插件在自己的构建中直接打包使用（esbuild external react），
// 实现 EMBED.md 的"一行接入"。本模块不注入 slot、不 $mount、不注入样式——
// 宿主 dsh-tip-jar 的 client 插件负责这些（Remote 命名空间 + CSS）。
import { createElement, useState, useEffect } from 'react'
import { formatTipStats } from './onchain.js'

class TipJarApiError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

class TipJarApi {
  /** @param {() => object|undefined} getNamespace live namespace getter */
  constructor(getNamespace) {
    this.getNamespace = getNamespace
  }

  async call(method, args) {
    const namespace = this.getNamespace()
    const fn = namespace && namespace[method]
    if (typeof fn !== 'function') {
      throw new TipJarApiError('not-mounted', 'tipJar Remote method "' + method + '" is not mounted')
    }
    const rpc = await fn(args)
    if (!rpc.ok) {
      throw new TipJarApiError('rpc-failed', (rpc.error && rpc.error.message) || 'remote call failed')
    }
    const business = rpc.value
    if (!business.ok) {
      throw new TipJarApiError('rpc-failed', (business.error && business.error.message) || 'remote call failed')
    }
    return business.value
  }

  async listSponsors() {
    const result = await this.call('listSponsors', {})
    if (result.ok) return result.data
    throw new TipJarApiError('registry-invalid', (result.errors && result.errors.length) ? result.errors.join('; ') : 'registry load failed')
  }

  tipStats() {
    return this.call('tipStats', {})
  }

  saveTipStats(stats) {
    return this.call('saveTipStats', { stats })
  }

  /** 宿主本地生成二维码（data URL），避免请求第三方 CDN。 */
  qrPng(text) {
    return this.call('qrPng', { text })
  }
}

function createTipJarApi(ctx) {
  return new TipJarApi(() => {
    const remote = ctx.remote
    if (!remote || !remote.namespaces) return undefined
    const ns = remote.namespaces.get('tipJar')
    return ns ? ns.service : undefined
  })
}

// ── resolveChannels：把一个贡献者的 tips 归一成可用通道（纯函数，红绿可测）──────
// 抽出来的原因：嵌入组件曾经只认 USDC，导致"只登记法币或平台二维码的贡献者在嵌入版里
// 看不到任何打赏入口"——对真实打赏者等于收不到钱。把归一化做成纯函数后，这条边界有了测试。
export function resolveChannels(contributor) {
  const c = contributor || {}
  const tips = c.tips || {}
  const usdc = typeof tips.usdc === 'string' && tips.usdc.length > 0 ? tips.usdc : ''
  const fiat = Array.isArray(tips.fiat)
    ? tips.fiat.filter(function (f) { return f && typeof f.url === 'string' && f.url.length > 0 && typeof f.label === 'string' })
    : []
  const qrCodes = Array.isArray(tips.qrCodes)
    ? tips.qrCodes.filter(function (q) { return q && typeof q.image === 'string' && q.image.length > 0 && typeof q.label === 'string' })
    : []
  // subscriptions 历史上放在**贡献者顶层**（c.subscriptions），而 usdc/fiat/qrCodes 在 c.tips 内。
  // 这个层级不一致曾导致"写进 tips.subscriptions 静默失效"——不报错，也永远不显示。
  // 现在两处都读、按 url 去重合并：写在任一层都生效，既有的顶层写法完全兼容。
  const subscriptions = []
  const seenSub = new Set()
  for (const list of [tips.subscriptions, c.subscriptions]) {
    if (!Array.isArray(list)) continue
    for (const s of list) {
      if (!s || typeof s.url !== 'string' || s.url.length === 0 || typeof s.label !== 'string') continue
      if (seenSub.has(s.url)) continue
      seenSub.add(s.url)
      subscriptions.push(s)
    }
  }
  return {
    usdc: usdc,
    fiat: fiat,
    qrCodes: qrCodes,
    subscriptions: subscriptions,
    hasAny: Boolean(usdc || fiat.length || qrCodes.length || subscriptions.length),
  }
}

// ── resolveEmbed：纯数据组装（红绿可测）───────────────────────────────────
// 输入注册表 + pluginId + 链上统计 → 输出嵌入组件的渲染数据或降级状态
export function resolveEmbed(sponsors, pluginId, stats) {
  if (!sponsors || !Array.isArray(sponsors.plugins)) return { status: 'loading' }
  const plugin = sponsors.plugins.filter(function (p) { return p.pluginId === pluginId })[0]
  if (!plugin) return { status: 'unregistered' }
  const contributor = (sponsors.contributors || []).filter(function (x) { return x.id === plugin.contributorId })[0]
  if (!contributor) return { status: 'no-contributor' }
  const stat = stats && stats.byContributorId && stats.byContributorId[contributor.id] ? stats.byContributorId[contributor.id] : null
  return { status: 'ok', plugin, contributor, stat }
}

// ── 自带样式 ────────────────────────────────────────────────────────────────
// 为什么必须自带：嵌入版此前依赖**宿主 dsh-tip-jar 的 client 注入的 CSS**。
// 接入方若没装 tip-jar，组件就渲染成**裸 HTML** —— 那样的"一行接入"名不副实。
//
// 这份样式只依赖 DSH 的主题变量（任何 DSH 都有），并且**每个变量都配了 fallback**，
// 所以主题变量缺失或换主题时也不会退化成不可读的黑白块。
// 类名沿用 sps-*：宿主若也注入了同值样式，重复无害。
const EMBED_STYLE_ID = 'dsh-tip-jar-embed-css'

const EMBED_CSS = [
  '.sps-toolcard{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));border-radius:10px;background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.06));padding:10px 12px;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-primary,inherit)}',
  '.sps-tool-head{font-weight:600;margin-bottom:6px}',
  '.sps-tool-support{font-size:12px;color:var(--dsw-alias-label-secondary,inherit);border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.3));padding-top:6px}',
  '.sps-tool-support b{color:var(--dsw-alias-state-warn-primary,#d08700)}',
  '.sps-tip-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,inherit)}',
  '.sps-tip-alias{font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
  '.sps-tip-amount{color:var(--dsw-alias-state-success-primary,#22a06b);font-weight:600;font-variant-numeric:tabular-nums}',
  '.sps-badge-vol{font-size:10px;color:var(--dsw-alias-state-success-primary,#22a06b);border:1px solid var(--dsw-alias-state-success-primary,#22a06b);border-radius:10px;padding:0 6px}',
  '.sps-badge-pw{font-size:10px;color:var(--dsw-alias-state-error-primary,#c94a4a);border:1px solid var(--dsw-alias-state-error-primary,#c94a4a);border-radius:10px;padding:0 6px}',
  '.sps-badge-un{font-size:10px;color:var(--dsw-alias-label-secondary,inherit);border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));border-radius:10px;padding:0 6px}',
  '.sps-btn{background:none;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));border-radius:5px;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font-size:11px;padding:2px 8px;display:inline-flex;align-items:center;justify-content:center}',
  '.sps-btn:hover{color:var(--dsw-alias-label-primary,inherit);border-color:var(--dsw-alias-brand-primary,#4d6bfe)}',
  '.sps-qr{width:120px;height:120px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));border-radius:6px;object-fit:contain}',
  '.sps-qr-row{display:flex;align-items:center;gap:10px}',
  '.sps-links{display:flex;flex-wrap:wrap;gap:5px;align-items:center}',
  '.sps-links-block{margin-top:8px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l1,rgba(128,128,128,.35));display:flex;flex-direction:column;gap:4px}.sps-link{font-size:11px;color:var(--dsw-alias-brand-primary,#4d6bfe);text-decoration:none}',
  '.sps-link:hover{text-decoration:underline}',
  '.sps-label{font-size:10px;color:var(--dsw-alias-label-secondary,inherit);text-transform:uppercase;letter-spacing:.04em}',
  '.sps-pay-meta{display:flex;flex-direction:column;gap:2px}',
  '.sps-pay-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
  '.sps-qrcode-note{font-size:9px;color:var(--dsw-alias-label-secondary,inherit);line-height:1.3;margin-top:1px}',
].join('')

/**
 * 幂等注入自带样式。无 document 时（SSR / Node 测试）返回 false，不抛错。
 * @param {Document} [doc] 测试可注入替身
 * @returns {boolean} 本次是否真的插入了 style
 */
export function ensureEmbedStyles(doc) {
  const d = doc ?? (typeof document === 'undefined' ? null : document)
  if (!d || !d.head || typeof d.createElement !== 'function') return false
  if (typeof d.getElementById === 'function' && d.getElementById(EMBED_STYLE_ID)) return false
  const el = d.createElement('style')
  el.id = EMBED_STYLE_ID
  el.textContent = EMBED_CSS
  d.head.appendChild(el)
  return true
}

/** 自带样式覆盖的类名（供测试与接入方核对）。 */
export const EMBED_CLASSES = [
  'sps-toolcard', 'sps-tool-head', 'sps-tool-support', 'sps-tip-line', 'sps-tip-alias',
  'sps-tip-amount', 'sps-btn', 'sps-qr', 'sps-qr-row', 'sps-links', 'sps-links-block', 'sps-link',
  'sps-label', 'sps-pay-meta', 'sps-pay-name', 'sps-qrcode-note',
  'sps-badge-vol', 'sps-badge-pw', 'sps-badge-un',
]

// ── TipJarEmbed（嵌入式打赏组件：其他插件一行接入）──────────────────────────
// 用法：其他插件在自己的 slot 里渲染 <TipJarEmbed ctx={ctx} pluginId="xxx" />
// 详细接入见 EMBED.md。组件读取注册表对应插件 → 展示贡献者打赏入口。

function TipJarEmbed(props) {
  const api = createTipJarApi(props.ctx)
  const pluginId = props.pluginId
  const [data, setData] = useState(null)
  const [tipState, setTipState] = useState({ stats: null })
  const [copied, setCopied] = useState(false)
  const [qrUrl, setQrUrl] = useState(null)
  const h = createElement

  useEffect(function () {
    // 自带样式：不假设宿主装了 dsh-tip-jar（见文件上方的说明）
    ensureEmbedStyles()
    let alive = true
    api.listSponsors().then(function (d) { if (alive && d) setData(d) }).catch(function () {})
    api.tipStats().then(function (r) { if (alive && r) setTipState({ stats: r.stats }) }).catch(function () {})
    return function () { alive = false }
  }, [api, pluginId])

  // 二维码由宿主本地生成（不再请求第三方 CDN）。必须在下面那些提前 return 之前调用 hook，
  // 所以这里自己解析一次 contributor —— 拿不到地址就保持 null，组件只显示地址与复制按钮。
  useEffect(function () {
    let alive = true
    const r = resolveEmbed(data, pluginId, null)
    const addr = r.status === 'ok' && r.contributor && r.contributor.tips && typeof r.contributor.tips.usdc === 'string'
      ? r.contributor.tips.usdc
      : ''
    if (!addr) { setQrUrl(null); return function () { alive = false } }
    api.qrPng(addr).then(function (v) {
      if (alive && v && typeof v.dataUrl === 'string') setQrUrl(v.dataUrl)
    }).catch(function () { if (alive) setQrUrl(null) })
    return function () { alive = false }
  }, [api, data, pluginId])

  const resolved = resolveEmbed(data, pluginId, tipState.stats)
  if (resolved.status === 'loading') return h('div', { className: 'sps-toolcard' }, '🤝 支持作者（加载中…）')
  if (resolved.status === 'unregistered') return h('div', { className: 'sps-toolcard sps-tip-line' }, '该插件未在赞助注册表登记（sponsors.json）')
  if (resolved.status === 'no-contributor') return h('div', { className: 'sps-toolcard sps-tip-line' }, '贡献者未登记')

  const c = resolved.contributor
  const plugin = resolved.plugin
  const stat = resolved.stat

  const eth = c.ethics || {}
  const ethicsBadge = eth.paidWall === true
    ? h('span', { className: 'sps-badge-pw' }, '🔴 付费墙')
    : (eth.voluntary === true ? h('span', { className: 'sps-badge-vol' }, '🟢 自愿打赏') : h('span', { className: 'sps-badge-un' }, '⚪ 未确认'))
  const channels = resolveChannels(c)
  const addr = channels.usdc

  // 不展示地址文本/二维码（乱码无用），只给复制按钮：一键复制完整地址
  const copyBtn = addr
    ? h('button', {
        className: 'sps-btn',
        title: copied ? '已复制 ✓' : '复制地址',
        onClick: function () {
          try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(addr).catch(function () {})
            }
          } catch (e) { /* fallback */ }
          setCopied(true)
          setTimeout(function () { setCopied(false) }, 1500)
        },
      }, copied ? '✓ 已复制' : '📋 复制地址')
    : null

  const line = h('div', { className: 'sps-tool-support' },
    h('span', { className: 'sps-tip-alias' }, '支持作者 @' + c.alias),
    ethicsBadge,
    copyBtn,
    stat ? h('span', { className: 'sps-tip-amount' }, ' · ' + formatTipStats(stat)) : null)

  // 收款二维码（USDC 地址，尺寸紧凑）：data URL 来自宿主本地生成，不再请求第三方 CDN。
  // 生成失败时降级为"只有地址与复制按钮"，绝不显示破图。
  const qr = (addr && qrUrl)
    ? h('div', { style: { display: 'flex', justifyContent: 'center', paddingTop: 6 } },
        h('img', { className: 'sps-qr', src: qrUrl, alt: 'USDC 收款二维码' }))
    : null

  // 法币通道（爱发电 / GitHub Sponsors 等）：只有链接，没有地址 —— 之前这里被整个漏掉，
  // 结果是"只登记法币渠道的贡献者在嵌入版里看不到任何打赏入口"，等于收不到钱。
  const fiat = channels.fiat.length
    ? h('div', { className: 'sps-links' },
        h('span', { className: 'sps-label' }, '法币'),
        channels.fiat.map(function (f) {
          return h('a', { key: f.url, className: 'sps-link', href: f.url, target: '_blank', rel: 'noreferrer' }, f.label)
        }))
    : null

  // 订阅通道
  const subs = channels.subscriptions.length
    ? h('div', { className: 'sps-links' },
        h('span', { className: 'sps-label' }, '订阅'),
        channels.subscriptions.map(function (s) {
          return h('a', { key: s.url, className: 'sps-link', href: s.url, target: '_blank', rel: 'noreferrer' }, s.label)
        }))
    : null

  // 平台直付收款码（微信 / 支付宝）：图片 URL 由注册表提供，不经过第三方生成服务。
  // 同样是被漏掉的一条：只登记二维码的贡献者此前在嵌入版里完全没有入口。
  const payQr = channels.qrCodes.map(function (q) {
    return h('div', { key: q.label, className: 'sps-qr-row', title: q.label + ' 收款码（平台直付）' },
      h('img', { className: 'sps-qr', src: q.image, alt: q.label + ' 收款码' }),
      h('div', { className: 'sps-pay-meta' },
        h('div', { className: 'sps-pay-name' }, q.label),
        h('div', { className: 'sps-qrcode-note' }, '扫码直付')))
  })

  // 一个通道都没有时如实说明，而不是渲染一张空卡片让人以为坏了
  const none = channels.hasAny ? null : h('div', { className: 'sps-tip-line' }, '该贡献者尚未登记任何打赏方式')

  return h('div', { className: 'sps-toolcard' },
    h('div', { className: 'sps-tool-head' }, '🤝 ' + (plugin.name || pluginId)),
    line,
    qr,
    payQr.length ? h('div', null, payQr) : null,
    (fiat || subs) ? h('div', { className: 'sps-links-block' }, fiat, subs) : null,
    none)
}

// ── registerTipJarSlot：真正的一行接入 ──────────────────────────────────────
// 接入方原本要自己写 slots.inject + slots.register + createElement 三件事，
// 且每处都要重复同样的样板和"没装 tip-jar 时别崩"的保护。这里一次封装。
//
//   registerTipJarSlot(ctx, { pluginId: 'my-plugin', slot: 'conversation.session.header.actions' })
//
// 返回与 slots.inject 相同的 disposer（可直接交给 ctx.effect 或忽略）。
function registerTipJarSlot(ctx, options) {
  const opts = options || {}
  const slot = opts.slot
  if (typeof slot !== 'string' || slot.length === 0) {
    throw new Error('registerTipJarSlot: options.slot is required')
  }
  const slots = ctx && ctx.slots
  // 没有 slot 服务（或宿主未装 tip-jar）时静默跳过：接入方不该因为打赏入口而崩。
  if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
    return function () {}
  }
  const id = typeof opts.id === 'string' && opts.id.length > 0
    ? opts.id
    : String(opts.pluginId || 'plugin') + '-tipjar'
  const order = typeof opts.order === 'number' ? opts.order : 80
  return slots.inject(slot, function () {
    return slots.register(
      { name: slot, id: id, order: order },
      function () { return createElement(TipJarEmbed, { ctx: ctx, pluginId: opts.pluginId }) },
    )
  })
}

export { TipJarEmbed, TipJarApi, createTipJarApi, registerTipJarSlot }