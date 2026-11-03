// dsh-tip-jar/src/client.js
// Client 半：赞助中心面板（会话「支持」Tab + 设置页）+ 工具卡致谢 + 链上到账雷达
// 通过 Typert Remote 调用 Host（ctx.remote.namespaces.get('tipJar')）
import { createElement, Component, useState, useEffect, useRef } from 'react'
import { TYPERT_REMOTE } from './remote.js'
import { buildGetLogsRequest, parseTransferLogs, aggregateStats, mergeStats, formatTipStats } from './onchain.js'
import { TipJarEmbed, createTipJarApi } from './embed.js'

// 链上到账雷达配置（浏览器友好公共 RPC，按序回退；原生 USDC 合约）
const RPC_URLS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://1rpc.io/matic',
]
const USDC_ADDRESS = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'
const POLL_INTERVAL_MS = 60000

async function rpcCall(method, params) {
  let lastErr = null
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (!res.ok) { lastErr = new Error('rpc http ' + res.status); continue }
      const json = await res.json()
      if (json.error) { lastErr = new Error((json.error && json.error.message) || 'rpc error'); continue }
      return json.result
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('rpc unavailable')
}

// ── Styles ──────────────────────────────────────────────────────────────────

function insertStyles(css) {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  return () => style.remove()
}

const CSS =
  '.sps-root{display:flex;flex-direction:column;gap:12px;padding:14px 16px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary);overflow-y:auto;height:100%}' +
  '.sps-title{font-weight:600;font-size:14px;color:var(--dsw-alias-brand-primary)}' +
  '.sps-note{font-size:12px;color:var(--dsw-alias-label-secondary)}' +
  '.sps-empty{color:var(--dsw-alias-label-secondary);padding:16px 0}' +
  '.sps-errors{color:var(--dsw-alias-state-error-primary);font-size:12px;margin:0;padding-left:16px}' +
  '.sps-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px;display:flex;flex-direction:column;gap:6px}' +
  '.sps-card-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
  '.sps-alias{font-weight:600;font-size:14px}' +
  '.sps-badge{font-size:10px;color:var(--dsw-alias-state-warn-primary);border:1px solid var(--dsw-alias-state-warn-primary);border-radius:10px;padding:0 6px}' +
  '.sps-badge-ok{font-size:10px;color:var(--dsw-alias-state-success-primary);border:1px solid var(--dsw-alias-state-success-primary);border-radius:10px;padding:0 6px}' +
  '.sps-badge-vol{font-size:10px;color:var(--dsw-alias-state-success-primary);border:1px solid var(--dsw-alias-state-success-primary);border-radius:10px;padding:0 6px}' +
  '.sps-badge-pw{font-size:10px;color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;padding:0 6px}' +
  '.sps-badge-un{font-size:10px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:0 6px}' +
  '.sps-badge-ds{font-size:10px;color:var(--dsw-alias-state-warn-primary);border:1px solid var(--dsw-alias-state-warn-primary);border-radius:10px;padding:0 6px}' +
  '.sps-bio{font-size:12px;color:var(--dsw-alias-label-secondary)}' +
  '.sps-addr-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
  '.sps-label{font-size:10px;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em}' +
  '.sps-addr{flex:1 1 auto;min-width:0;font-family:ui-monospace,Consolas,monospace;font-size:11px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:5px;padding:2px 6px;width:200px;color:var(--dsw-alias-label-primary)}' +
  '.sps-btn{background:none;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;padding:2px 8px;display:inline-flex;align-items:center;justify-content:center}' +
  '.sps-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}' +
  '.sps-qr{width:120px;height:120px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;object-fit:contain}' +
  '.sps-qr-row{display:flex;align-items:center;gap:10px}' +
  '.sps-links{display:flex;flex-wrap:wrap;gap:5px;align-items:center}' +
  '.sps-links-block{margin-top:8px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:4px}.sps-link{font-size:11px;color:var(--dsw-alias-brand-primary);text-decoration:none}' +
  '.sps-link:hover{text-decoration:underline}' +
  '.sps-pay-meta{display:flex;flex-direction:column;gap:2px}' +
  '.sps-pay-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
  '.sps-qrcode-note{font-size:9px;color:var(--dsw-alias-label-secondary);line-height:1.3;margin-top:1px}' +
  '.sps-sec-title{font-size:11px;color:var(--dsw-alias-label-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-top:4px}' +
  '.sps-sponsor{font-size:12px;color:var(--dsw-alias-label-secondary)}' +
  '.sps-sponsor b{color:var(--dsw-alias-state-warn-primary)}' +
  '.sps-toolcard{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px;font-size:12.5px;color:var(--dsw-alias-label-primary)}' +
  '.sps-tool-head{font-weight:600;margin-bottom:6px}' +
  '.sps-tool-body{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;margin-bottom:8px}' +
  '.sps-tool-support{font-size:12px;color:var(--dsw-alias-label-secondary);border-top:1px solid var(--dsw-alias-border-l1);padding-top:6px}' +
  '.sps-tool-fiat{display:flex;flex-direction:column;gap:6px;border-top:1px dashed var(--dsw-alias-border-l2);margin-top:8px;padding-top:8px}' +
  '.sps-tool-support b{color:var(--dsw-alias-state-warn-primary)}' +
  '.sps-tip-line{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
  '.sps-tip-rank{color:var(--dsw-alias-label-secondary);min-width:16px}' +
  '.sps-tip-alias{font-weight:600;color:var(--dsw-alias-label-primary)}' +
  '.sps-tip-amount{color:var(--dsw-alias-state-success-primary);font-weight:600;font-variant-numeric:tabular-nums}' +
  '.sps-tip-count{color:var(--dsw-alias-label-secondary)}' +
  '.sps-tip-note{margin-top:6px;font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary);opacity:.85}'

// ── SponsorCenter ───────────────────────────────────────────────────────────

/**
 * USDC 收款二维码：由宿主本地生成（data URL），不再请求第三方 CDN ——
 * 既不把收款地址交给外部服务，也不受其可用性影响。生成失败时不渲染（降级为仅地址 + 复制按钮）。
 */
// 渲染崩溃时把错误直接显示在面板上（此前崩溃=整块空白，无人知道发生了什么）
class PanelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    try { console.error('[dsh-tip-jar] 面板渲染失败:', error, info && info.componentStack) } catch (e) {}
  }
  render() {
    if (this.state.error) {
      const e = this.state.error
      return createElement('div', { className: 'sps-root' },
        createElement('div', { className: 'sps-title' }, '🤝 支持贡献者'),
        createElement('div', { className: 'sps-errors' }, '⚠️ 面板渲染失败 —— 下面是错误详情（截图发给我即可修复）：'),
        createElement('pre', { style: { whiteSpace: 'pre-wrap', fontSize: 11, color: 'var(--dsw-alias-state-error-primary,#c94a4a)' } },
          String((e && e.stack) || e)),
        createElement('div', { className: 'sps-note' }, '这是插件自己的错误显示框（ErrorBoundary），不是 DSH 的问题。'))
    }
    return this.props.children
  }
}

function QrImage(props) {
  const h = createElement
  const api = props.api
  const text = props.text
  const [url, setUrl] = useState(null)
  useEffect(function () {
    let alive = true
    if (!api || !text) { setUrl(null); return function () { alive = false } }
    api.qrPng(text).then(function (v) {
      if (alive && v && typeof v.dataUrl === 'string') setUrl(v.dataUrl)
    }).catch(function (e) { if (alive) { console.warn('[dsh-tip-jar] qrPng failed, USDC QR hidden:', e && e.message ? e.message : e); setUrl(null) } })
    return function () { alive = false }
  }, [api, text])
  if (!url) return null
  return h('img', { className: props.className || 'sps-qr', src: url, alt: props.alt || '收款二维码' })
}

function SponsorCenter(props) {
  const api = props.api
  const ctx = props.ctx
  const [state, setState] = useState(null)
  const [tipState, setTipState] = useState({ stats: null, present: false, paused: false })
  const [copiedId, setCopiedId] = useState(null)
  const dataRef = useRef(null)
  const tipRef = useRef({ stats: null, present: false })

  useEffect(function () {
    let alive = true
    const load = async function () {
      try {
        const data = await api.listSponsors()
        if (alive) { dataRef.current = data; setState({ ok: true, data }) }
      } catch (e) {
        if (alive) setState({ ok: false, errors: [e && e.message ? e.message : 'RPC 调用失败'], data: null })
      }
      try {
        const r = await api.tipStats()
        if (alive && r) {
          tipRef.current = { stats: r.stats, present: !!r.present }
          setTipState({ stats: r.stats, present: !!r.present, paused: false })
        }
      } catch (e) { /* 统计暂不可用，轮询会重试 */ }
      // v1.1-B：举报只记录、不自动标记 —— 不再拉取/渲染 disputed 徽章（见 ECOSYSTEM-RISKS §5.1-B）
    }
    load()
    return function () { alive = false }
  }, [api])

  // 链上到账雷达：60s 增量轮询 Polygon USDC Transfer 事件
  useEffect(function () {
    let alive = true
    const poll = async function () {
      const data = dataRef.current
      if (!data) return
      const contributors = (data.contributors || []).filter(function (c) { return c.tips && c.tips.usdc })
      if (contributors.length === 0) return
      try {
        const bnHex = await rpcCall('eth_blockNumber', [])
        const current = parseInt(bnHex, 16)
        const prevBlock = (tipRef.current.stats && tipRef.current.stats.lastBlock) || 0
        // 从安装时刻起算：无持久化进度时从当前区块开始（不扫历史）
        const fromBlock = prevBlock > 0 ? prevBlock + 1 : current
        if (fromBlock > current) return
        const resp = await rpcCall('eth_getLogs', [
          buildGetLogsRequest(USDC_ADDRESS, contributors, '0x' + fromBlock.toString(16), 'latest').params[0],
        ])
        const logs = Array.isArray(resp) ? resp : (resp && resp.result) || []
        const parsed = parseTransferLogs(logs, USDC_ADDRESS)
        const agg = aggregateStats(parsed, contributors)
        const merged = mergeStats(tipRef.current.stats || { byContributorId: {}, lastBlock: 0 }, agg)
        tipRef.current = { stats: merged, present: true }
        if (alive) setTipState({ stats: merged, present: true, paused: false })
        api.saveTipStats(merged).catch(function (e) {
          // 统计写盘失败不该静默：链上进度会回退，用户却看不到任何提示
          console.warn('[dsh-tip-jar] saveTipStats 失败（链上统计进度未持久化）:', e && e.message ? e.message : e)
        })
      } catch (e) {
        if (alive) setTipState(function (prev) { return { stats: prev.stats, present: prev.present, paused: true } })
      }
    }
    poll()
    const stop = ctx.interval(poll, POLL_INTERVAL_MS)
    return function () { alive = false; stop() }
  }, [api, ctx])

  const h = createElement
  if (!state) {
    return h('div', { className: 'sps-root' }, h('div', { className: 'sps-title' }, '🤝 支持贡献者'), h('div', { className: 'sps-empty' }, '加载中…'))
  }
  if (!state.ok || !state.data) {
    const errs = state.errors && state.errors.length
      ? h('ul', { className: 'sps-errors' }, state.errors.map(function (e, i) { return h('li', { key: i }, e) }))
      : null
    return h('div', { className: 'sps-root' },
      h('div', { className: 'sps-title' }, '🤝 支持贡献者'),
      h('div', { className: 'sps-empty' }, '暂无赞助信息'),
      errs,
      h('div', { className: 'sps-note' }, '贡献者在工作区根目录 sponsors.json 中声明支持渠道后，此处即可展示。'))
  }

  const d = state.data
  const byId = {}
  ;(d.contributors || []).forEach(function (c) { byId[c.id] = c })

  const cards = (d.contributors || []).map(function (c) {
    const addr = c.tips && c.tips.usdc
    // 自愿打赏伦理徽章（dsh-sponsor-ethics）
    const eth = c.ethics || {}
    let ethicsBadge = null
    if (eth.paidWall === true) {
      ethicsBadge = h('span', { className: 'sps-badge-pw', title: '该贡献者声明存在付费墙，违反自愿打赏伦理规范（ETHICS.md）' }, '🔴 存在付费墙')
    } else if (eth.voluntary === true) {
      ethicsBadge = h('span', { className: 'sps-badge-vol', title: '已声明：打赏自愿、无条件、无付费墙（遵循 dsh-sponsor-ethics）' }, '🟢 自愿打赏')
    } else {
      ethicsBadge = h('span', { className: 'sps-badge-un', title: '未声明自愿性，请自行判断（规范见 ETHICS.md）' }, '⚪ 未确认自愿性')
    }
    const head = h('div', { className: 'sps-card-head' },
      h('span', { className: 'sps-alias' }, '@' + c.alias),
      h('span', { className: c.verified ? 'sps-badge-ok' : 'sps-badge' }, c.verified ? '已认证' : '未验证'),
      ethicsBadge)
    const rows = [head]
    const tipEntry = tipState.stats && tipState.stats.byContributorId && tipState.stats.byContributorId[c.id]
    if (tipEntry) {
      // 金额 · 笔数 · 独立支持者数（后者由 onchain 聚合时算出，长期没被显示过）
      rows.push(h('div', { className: 'sps-tip-line' },
        '🎖 链上已收 ', h('b', { className: 'sps-tip-amount' }, formatTipStats(tipEntry))))
    }
    if (addr) {
      const short = addr.slice(0, 6) + '…' + addr.slice(-4)
      const isCopied = copiedId === c.id
      const copyBtn = h('button', {
        className: 'sps-btn',
        title: isCopied ? '已复制 ✓' : '复制地址',
        onClick: function () {
          try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(addr).catch(function () {})
            }
          } catch (e) { /* fallback: select manually */ }
          setCopiedId(c.id)
          setTimeout(function () { setCopiedId(null) }, 1500)
        },
      }, isCopied
        ? h('span', { style: { color: 'var(--dsw-alias-state-success-primary)' } }, '✓')
        : h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
            h('rect', { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }),
            h('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' })))
      const addrRow = h('div', { className: 'sps-addr-row' },
        h('span', { className: 'sps-label' }, 'USDC (Polygon)'),
        h('input', { className: 'sps-addr', readOnly: true, defaultValue: addr, title: '点击全选后 Ctrl+C 复制', onFocus: function (e) { e.target.select() } }),
        copyBtn)
      const qr = h(QrImage, { api: api, text: addr, className: 'sps-qr', alt: 'USDC ' + short + ' 收款二维码' })
      rows.push(h('div', { className: 'sps-qr-row' }, qr, addrRow))
    }
    const fiat = (c.tips && c.tips.fiat && c.tips.fiat.length)
      ? h('div', { className: 'sps-links' }, c.tips.fiat.map(function (f) {
          return h('a', { key: f.url, className: 'sps-link', href: f.url, target: '_blank', rel: 'noreferrer' }, f.label)
        }))
      : null
    const subsList = (c.tips && c.tips.subscriptions && c.tips.subscriptions.length) ? c.tips.subscriptions : (c.subscriptions || [])
    const subs = subsList.length
      ? h('div', { className: 'sps-links' }, subsList.map(function (s) {
          return h('a', { key: s.url, className: 'sps-link', href: s.url, target: '_blank', rel: 'noreferrer' }, s.label)
        }))
      : null
    // 收款码（微信/支付宝等平台直付）：每个二维码独占一行，与 USDC 同款（左码右说明）
    const payRows = (c.tips && c.tips.qrCodes && c.tips.qrCodes.length)
      ? c.tips.qrCodes.map(function (q) {
          return h('div', { key: q.label, className: 'sps-qr-row', title: q.label + ' 收款码（平台直付）' },
            h('img', { className: 'sps-qr', src: q.image, alt: q.label + ' 收款码' }),
            h('div', { className: 'sps-pay-meta' },
              h('div', { className: 'sps-pay-name' }, q.label),
              h('div', { className: 'sps-qrcode-note' }, '扫码直付')))
        })
      : null
    // 二维码先连成完整一块（USDC + 平台直付），文字链接不再插在它们中间
    if (payRows) {
      payRows.forEach(function (r) { rows.push(r) })
      rows.push(h('div', { className: 'sps-qrcode-note' }, '平台直付，不走链上，无致谢墙'))
    }
    // 链接型渠道（平台网页，非扫码）统一收在卡片底部，避免切断二维码
    if (fiat || subs) {
      rows.push(h('div', { className: 'sps-links-block' },
        fiat ? h('div', { className: 'sps-links' }, h('span', { className: 'sps-label' }, '法币'), fiat) : null,
        subs ? h('div', { className: 'sps-links' }, h('span', { className: 'sps-label' }, '订阅'), subs) : null))
    }
    return h('div', { key: c.id, className: 'sps-card' }, ...rows)
  })

  const sponsored = (d.plugins || []).filter(function (p) { return p.sponsors && p.sponsors.length })
  const sponsorSec = sponsored.length
    ? h('div', { className: 'sps-section' },
        h('div', { className: 'sps-sec-title' }, '🤝 甲方赞助位'),
        sponsored.map(function (p) {
          const c = byId[p.contributorId]
          return p.sponsors.map(function (s, i) {
            return h('div', { key: p.pluginId + '-' + i, className: 'sps-sponsor' },
              'Sponsored by ', h('b', null, s.name), ' — ', s.message,
              '（', h('a', { className: 'sps-link', href: s.url, target: '_blank', rel: 'noreferrer' }, '了解'), '）',
              c ? ' · 贡献者 @' + c.alias : '')
          })
        }))
    : null

  // 🎖 致谢墙：仅在有链上到账时展示（无数据则整体隐藏）
  const tipEntries = []
  if (tipState.stats && tipState.stats.byContributorId) {
    for (const id of Object.keys(tipState.stats.byContributorId)) {
      const c = byId[id]
      if (!c) continue
      const s = tipState.stats.byContributorId[id]
      tipEntries.push({ id, alias: c.alias, count: s.count, amountUsdc: s.amountUsdc, supporters: s.supporters })
    }
  }
  tipEntries.sort(function (a, b) { return b.amountUsdc - a.amountUsdc })
  const lastBlock = tipState.stats && tipState.stats.lastBlock
  // 只读统计面：让贡献者看到"多少人支持我"，而不是只有金额。
  // 同时如实交代数据边界 —— 链上雷达有覆盖范围，不该假装是完整账本。
  const wall = tipEntries.length
    ? h('div', { className: 'sps-section' },
        h('div', { className: 'sps-sec-title' }, '🎖 致谢墙'),
        tipEntries.map(function (t, i) {
          return h('div', { key: t.id, className: 'sps-tip-line' },
            h('span', { className: 'sps-tip-rank' }, String(i + 1) + '. '),
            h('span', { className: 'sps-tip-alias' }, '@' + t.alias),
            h('span', { className: 'sps-tip-amount' }, formatTipStats(t)))
        }),
        h('div', { className: 'sps-tip-note' },
          lastBlock
            ? '统计来自链上转账扫描（Polygon USDC），已扫至区块 ' + String(lastBlock) + '；仅覆盖登记地址的到账，不代表完整账本。'
            : '统计来自链上转账扫描（Polygon USDC）；仅覆盖登记地址的到账，不代表完整账本。'))
    : null

  return h('div', { className: 'sps-root' },
    h('div', { className: 'sps-title' }, '🤝 支持贡献者'),
    cards,
    wall,
    sponsorSec)
}

// ── ToolCard ────────────────────────────────────────────────────────────────

function ToolCard(props) {
  const api = props.api
  const [data, setData] = useState(null)
  useEffect(function () {
    let alive = true
    api.listSponsors().then(function (d) {
      if (alive && d) setData(d)
    }).catch(function (e) {
      if (alive) console.warn('[dsh-tip-jar] tool card: listSponsors 失败:', e && e.message ? e.message : e)
    })
    return function () { alive = false }
  }, [api])

  const h = createElement
  let body = null
  try {
    const block = props && props.block
    if (block) {
      if (typeof block.text === 'string') body = block.text
      const c = block.content || block.result
      if (Array.isArray(c)) {
        const parts = c.filter(function (b) { return b && b.type === 'text' && typeof b.text === 'string' }).map(function (b) { return b.text })
        if (parts.length) body = parts.join('\n')
      }
    }
  } catch (e) { /* defensive */ }

  let support = null
  if (data) {
    const plugin = (data.plugins || []).filter(function (p) { return p.pluginId === 'trd-1' })[0]
    if (plugin) {
      const c = (data.contributors || []).filter(function (x) { return x.id === plugin.contributorId })[0]
      const lines = []
      if (c) {
        const addr = c.tips && c.tips.usdc
        lines.push('支持作者 @' + c.alias + (addr ? ' · USDC ' + addr.slice(0, 6) + '…' + addr.slice(-4) : ''))
      }
      if (plugin.sponsors && plugin.sponsors.length) {
        lines.push('Sponsored by ' + plugin.sponsors.map(function (s) { return s.name }).join(' / '))
      }
      if (lines.length) {
        support = h('div', { className: 'sps-tool-support' },
          lines.map(function (l, i) { return h('div', { key: i }, l) }))
      }
    }
  }

  return h('div', { className: 'sps-toolcard' },
    h('div', { className: 'sps-tool-head' }, '🔧 ' + (props && props.toolName ? props.toolName : '工具')),
    body ? h('div', { className: 'sps-tool-body' }, body) : null,
    support)
}

// ── Plugin ──────────────────────────────────────────────────────────────────

export default {
  inject: ['remote', 'slots', 'timer'],
  async apply(ctx) {
    const slots = ctx.slots
    if (!slots) return

    // 挂载 Remote 命名空间：ctx.remote.namespaces 只能由 $mount 填充
    const disposers = []
    try {
      const dispose = await ctx.remote.$mount(TYPERT_REMOTE)
      if (typeof dispose === 'function') {
        disposers.push(dispose)
        ctx.effect(() => dispose)
      }
    } catch (error) {
      for (const d of disposers.reverse()) await d()
      throw error
    }

    const api = createTipJarApi(ctx)

    ctx.effect(() => insertStyles(CSS))

    // 入口 1（已移除）：会话视图 Tab「支持」—— 打赏入口已收进各插件的「设置→关于」，
    // 不再单独占用一个会话页签（SponsorCenter 仍可在设置页入口使用）。
    // 入口 2：设置页「支持贡献者」
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'sponsors', order: 30, label: '支持贡献者' },
        function () { return createElement(PanelErrorBoundary, null, createElement(SponsorCenter, { api: api, ctx: ctx })) })
    })
    // 入口 3：pm_trading_status 工具卡致谢
    slots.inject('tool.call.toolview', function () {
      return slots.register(
        { name: 'tool.call.toolview', key: 'pm_trading_status' },
        function (props) { return createElement(ToolCard, Object.assign({}, props, { api: api })) })
    })
  },
}

export { TipJarEmbed } from './embed.js'
export { QrImage, SponsorCenter, ToolCard, PanelErrorBoundary }

// 上面这行只服务于测试（test/render.test.js）：把内部组件暴露出来，让测试能真的渲染一遍。
// 浏览器构建里这些命名导出不会被使用，不影响产物大小。