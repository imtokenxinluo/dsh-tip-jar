// dsh-tip-jar/src/embed.js
// 嵌入式打赏组件模块（纯 ESM，无副作用）：
// 供其他插件在自己的构建中直接打包使用（esbuild external react），
// 实现 EMBED.md 的"一行接入"。本模块不注入 slot、不 $mount、不注入样式——
// 宿主 dsh-tip-jar 的 client 插件负责这些（Remote 命名空间 + CSS）。
import { createElement, useState, useEffect } from 'react'
import { formatUsdc } from './onchain.js'

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

  reportContributor(targetId, category, anonId, note) {
    return this.call('reportContributor', { targetId, category, anonId, note })
  }

  disputed() {
    return this.call('disputed', {})
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
  const subscriptions = Array.isArray(c.subscriptions)
    ? c.subscriptions.filter(function (s) { return s && typeof s.url === 'string' && s.url.length > 0 && typeof s.label === 'string' })
    : []
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
    stat ? h('span', { className: 'sps-tip-amount' }, ' · ' + formatUsdc(stat.amountUsdc) + ' / ' + stat.count + ' 笔') : null)

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
    fiat,
    subs,
    qr,
    payQr.length ? h('div', null, payQr) : null,
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