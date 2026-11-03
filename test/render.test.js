// dsh-tip-jar/test/render.test.js
// 渲染回归测试：真的把组件渲染一遍。
//
// 为什么要有这个文件：2026-10 面板**两次**变成整块空白
//   1) QrImage 引用了作用域外的 h（qrPng 一成功就 ReferenceError）
//   2) ErrorBoundary 自身崩溃
// 而当时 122 项测试全绿 —— 因为它们只测纯函数（resolveEmbed / schema / QR 逻辑），
// 从不真正渲染组件。这个文件补上"画一遍"这一层。
//
// 用 react-dom/server 的 renderToString：不需要浏览器、不需要 jsdom，
// 但足以抓住"渲染时抛异常"这一类 bug（effect 不会执行，正好只测渲染路径）。

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { QrImage, SponsorCenter, ToolCard, PanelErrorBoundary } from '../src/client.js'
import { TipJarEmbed } from '../src/embed.js'

let failures = 0
function check(name, cond, detail) {
  if (cond) { console.log('  PASS ' + name) }
  else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')) }
}

function safeRender(label, element) {
  try {
    const html = renderToString(element)
    check(label, true)
    return html
  } catch (e) {
    check(label, false, (e && e.constructor && e.constructor.name) + ': ' + (e && e.message))
    return null
  }
}

// 只提供渲染期会用到的字段；effect 在 SSR 下不会执行，所以这里返回永远 pending 的 Promise
const api = {
  listSponsors: () => new Promise(() => {}),
  tipStats: () => new Promise(() => {}),
  qrPng: () => new Promise(() => {}),
  saveTipStats: () => new Promise(() => {}),
}
const ctx = {}

// ── 1. 组件渲染不崩 ──
safeRender('QrImage 渲染不抛错（回归：h 作用域）', createElement(QrImage, { api, text: '0x' + '1'.repeat(40), className: 'sps-qr' }))
safeRender('QrImage 没有 api 时也不抛错', createElement(QrImage, { api: null, text: '' }))
safeRender('SponsorCenter 渲染不抛错', createElement(SponsorCenter, { api, ctx }))
safeRender('ToolCard 渲染不抛错', createElement(ToolCard, { api, ctx, pluginId: 'p1' }))
const embedHtml = safeRender('TipJarEmbed 渲染不抛错', createElement(TipJarEmbed, { api, ctx, pluginId: 'p1' }))
check('TipJarEmbed 初始渲染出现「支持作者」', typeof embedHtml === 'string' && embedHtml.includes('支持作者'), embedHtml ? embedHtml.slice(0, 80) : 'null')

// ── 2. ErrorBoundary 的生命周期方法必须真实存在 ──
// 这一条如果是红的，说明 componentDidCatch 被误改（2026-11-03 实际发生过：
// 一次批量替换把 "ch" 换成了 createElement，方法名变成 componentDidCatccreateElement，
// 于是面板崩溃时控制台什么都没留下）。
check('PanelErrorBoundary 定义了 componentDidCatch', typeof PanelErrorBoundary.prototype.componentDidCatch === 'function',
  '实际是: ' + Object.getOwnPropertyNames(PanelErrorBoundary.prototype).join(', '))
check('PanelErrorBoundary 定义了 getDerivedStateFromError', typeof PanelErrorBoundary.getDerivedStateFromError === 'function')

// ── 3. 出错时渲染"错误详情"，而不是空白 ──
try {
  const inst = new PanelErrorBoundary({ children: null })
  inst.state = { error: new Error('boom') }
  const html = renderToString(inst.render())
  check('ErrorBoundary 出错时显示错误详情（不再空白）', html.includes('面板渲染失败'))
  check('ErrorBoundary 的输出带上了原始堆栈', html.includes('boom'))
} catch (e) {
  check('ErrorBoundary 出错时显示错误详情（不再空白）', false, String(e && e.message))
}

// ── 4. 静态守卫：标识符污染 ──
// 上一类 bug 的根因是"批量替换误伤标识符"，这里做一个廉价的模式检查。
const PKG = fileURLToPath(new URL('..', import.meta.url))
for (const rel of ['src/client.js', 'src/embed.js']) {
  const src = readFileSync(new URL('../' + rel, import.meta.url), 'utf8')
  check(rel + ' 没有 componentDidCat 被截断', !/componentDidCat(?!ch)/.test(src))
  check(rel + ' 没有标识符中嵌入 createElement', !/[A-Za-z_]createElement/.test(src))
}

// ── 5. 地址框不许被固定宽度压扁 ──
// 2026-11-03：USDC 地址（42 字符）在 200px 固定宽度里被截掉尾巴，看起来像"地址短了一截"，
// 有让人手动抄错的风险。这里守住"给足宽度"这条不变量。
{
  const src = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
  const rule = /\.sps-addr\{([^}]*)\}/.exec(src)
  check('存在 .sps-addr 样式规则', !!rule)
  if (rule) {
    const css = rule[1]
    check('地址框没有写死像素宽度', !/width:\s*\d+px/.test(css), css.slice(0, 120))
    const minCh = /min-width:\s*(\d+)ch/.exec(css)
    check('地址框 min-width >= 42ch（42 位地址放得下）', !!minCh && Number(minCh[1]) >= 42, minCh ? minCh[0] : '未设置')
  }
}
console.log('')
if (failures > 0) { console.error('✗ ' + failures + ' 项渲染检查失败'); process.exit(1) }
console.log('✓ 渲染检查全部通过')