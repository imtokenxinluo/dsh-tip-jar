// dsh-tip-jar/test/embed.test.js
// 红绿测试：嵌入组件数据组装（resolveEmbed）——未登记/缺贡献者/正常/统计 四态。
import { resolveEmbed, resolveChannels, registerTipJarSlot, ensureEmbedStyles, EMBED_CLASSES } from '../src/embed.js'
import { validateRegistry } from '../src/validate.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let failures = 0
function check(name, cond, detail) {
  if (cond) { console.log('  PASS ' + name) }
  else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')) }
}

const sponsors = {
  contributors: [
    { id: 'ghost-trader', alias: 'ghost_trader', ethics: { voluntary: true, paidWall: false }, tips: { usdc: '0x1111111111111111111111111111111111111111' } },
  ],
  plugins: [
    { pluginId: 'pm-trading-assistant', name: '预测交易助手', contributorId: 'ghost-trader' },
  ],
}

// 1. 未登记 pluginId → unregistered
{
  const r = resolveEmbed(sponsors, 'unknown-plugin', null)
  check('未登记 → unregistered', r.status === 'unregistered', JSON.stringify(r))
}

// 2. 已登记但 contributorId 无对应贡献者 → no-contributor
{
  const broken = { contributors: [], plugins: [{ pluginId: 'pm-trading-assistant', name: 'x', contributorId: 'nobody' }] }
  const r = resolveEmbed(broken, 'pm-trading-assistant', null)
  check('贡献者缺失 → no-contributor', r.status === 'no-contributor', JSON.stringify(r))
}

// 3. 正常 → ok + contributor + plugin
{
  const r = resolveEmbed(sponsors, 'pm-trading-assistant', null)
  check('正常 → ok', r.status === 'ok', JSON.stringify(r))
  check('ok 返回贡献者', r.contributor && r.contributor.id === 'ghost-trader')
  check('ok 返回插件', r.plugin && r.plugin.pluginId === 'pm-trading-assistant')
}

// 4. 统计并入（雷达数据）
{
  const stats = { byContributorId: { 'ghost-trader': { count: 3, amountUsdc: 1.75, supporters: 2 } }, lastBlock: 100 }
  const r = resolveEmbed(sponsors, 'pm-trading-assistant', stats)
  check('ok 含链上统计', r.stat && r.stat.count === 3 && r.stat.amountUsdc === 1.75, JSON.stringify(r.stat))
}

// 5. 无统计时 stat 为 null（不崩）
{
  const r = resolveEmbed(sponsors, 'pm-trading-assistant', { byContributorId: {} })
  check('无统计 → stat null', r.status === 'ok' && r.stat === null, JSON.stringify(r))
}

// 6. 空输入 → loading（数据未加载）
{
  check('null 输入 → loading', resolveEmbed(null, 'pm-trading-assistant', null).status === 'loading')
}

// ── 7. resolveChannels：通道归一化 ──────────────────────────────────────────
// 回归背景：嵌入组件曾经只读 `tips.usdc`，于是"只登记法币链接或平台收款码的贡献者"
// 在嵌入版里看不到任何打赏入口 —— 对打赏者等于"收不到钱"。下面每条都对应那条边界。
{
  const r = resolveChannels({ tips: { usdc: '0xabc' } })
  check('通道：只登记 USDC', r.hasAny === true && r.usdc === '0xabc' && r.fiat.length === 0 && r.qrCodes.length === 0)
}
{
  const r = resolveChannels({ tips: { fiat: [{ label: '爱发电', url: 'https://afdian.com/a/x' }] } })
  check('通道：只登记法币 → hasAny 必须为真（曾判为"无通道"）', r.hasAny === true && r.fiat.length === 1 && r.usdc === '')
}
{
  const r = resolveChannels({ tips: { qrCodes: [{ label: '微信', image: 'assets/weixin.png' }] } })
  check('通道：只登记平台收款码 → hasAny 必须为真', r.hasAny === true && r.qrCodes.length === 1)
}
{
  const r = resolveChannels({ subscriptions: [{ label: '月付', url: 'https://x/y' }] })
  check('通道：只登记订阅 → hasAny 必须为真', r.hasAny === true && r.subscriptions.length === 1)
}
{
  check('通道：什么都没登记 → hasAny 为假', resolveChannels({ tips: {} }).hasAny === false)
  check('通道：null/undefined 输入不炸', resolveChannels(null).hasAny === false && resolveChannels(undefined).hasAny === false)
}
{
  const r = resolveChannels({
    tips: {
      fiat: [{ label: 'ok', url: 'https://a' }, { label: 'no-url' }, { url: 'https://b' }],
      qrCodes: [{ label: 'x' }, { image: 'y.png' }, { label: 'good', image: 'z.png' }],
    },
  })
  check('通道：脏数据被过滤（缺 url / 缺 label / 缺 image）', r.fiat.length === 1 && r.qrCodes.length === 1 && r.hasAny === true,
    JSON.stringify({ fiat: r.fiat.length, qr: r.qrCodes.length }))
}
{
  const r = resolveChannels({ tips: { usdc: '', fiat: [], qrCodes: [], subscriptions: [] } })
  check('通道：空字符串/空数组不算通道', r.hasAny === false && r.usdc === '')
}

// ── 8. 旧行为对照（把"原来的错"写进测试，防止有人改回去）────────────────────
// 修复前 embed 的判定等价于：只看 tips.usdc。于是下面这行会得到 false —— 那就是
// "只登记法币/二维码的贡献者在嵌入版里没有任何入口、等于收不到钱"的根因。
{
  function oldEmbedHadEntry(contributor) {
    const c = contributor || {}
    const addr = c.tips && c.tips.usdc
    return Boolean(addr)
  }
  const fiatOnly = { tips: { fiat: [{ label: '爱发电', url: 'https://afdian.com/a/x' }] } }
  const qrOnly = { tips: { qrCodes: [{ label: '微信', image: 'assets/weixin.png' }] } }
  check('旧逻辑对照：只登记法币时被判为"无入口"（这就是 bug 本身）', oldEmbedHadEntry(fiatOnly) === false)
  check('旧逻辑对照：只登记收款码时被判为"无入口"', oldEmbedHadEntry(qrOnly) === false)
  check('新逻辑：同样两个贡献者都被认作有入口（修复生效）',
    resolveChannels(fiatOnly).hasAny === true && resolveChannels(qrOnly).hasAny === true)
}

// ── 9. registerTipJarSlot：一行接入的帮助函数 ────────────────────────────────
// 接入方最关心的其实不是"组件长什么样"，而是"我加这一行会不会把我的插件搞崩"。
// 所以这里的重点是：缺参数要立即可见地报错，缺运行环境要安静地跳过。
{
  let threw = false
  try { registerTipJarSlot({}, {}) } catch (e) { threw = true }
  check('缺 slot 参数 → 同步抛错（不静默失败）', threw === true)

  const noSlots = registerTipJarSlot({}, { slot: 'x.y', pluginId: 'p' })
  check('ctx 没有 slots 服务 → 返回 no-op disposer 而不是抛错', typeof noSlots === 'function')
  check('no-op disposer 可安全调用', (function () { try { noSlots(); return true } catch (e) { return false } })())

  let injected = null
  let registered = null
  const fakeCtx = {
    slots: {
      inject: function (slot, cb) { injected = slot; cb(); return function () {} },
      register: function (meta, render) { registered = { meta: meta, render: render }; return function () {} },
    },
  }
  registerTipJarSlot(fakeCtx, { pluginId: 'my-plugin', slot: 'conversation.session.header.actions', order: 42 })
  check('把 slot 名透传给 slots.inject', injected === 'conversation.session.header.actions', String(injected))
  check('注册 id 默认由 pluginId 派生', registered && registered.meta.id === 'my-plugin-tipjar', JSON.stringify(registered && registered.meta))
  check('order 被透传', registered && registered.meta.order === 42)
  check('注册的 name 与 slot 一致', registered && registered.meta.name === 'conversation.session.header.actions')
  check('render 是函数（渲染 TipJarEmbed）', registered && typeof registered.render === 'function')

  const custom = { slots: fakeCtx.slots }
  registerTipJarSlot(custom, { pluginId: 'p', slot: 'a.b', id: 'my-custom-id' })
  check('显式 id 优先于派生值', registered && registered.meta.id === 'my-custom-id')
  const defaultOrder = (function () { registerTipJarSlot(custom, { pluginId: 'p', slot: 'a.b' }); return registered.meta.order })()
  check('未给 order 时默认 80', defaultOrder === 80)
}

// ── 10. 自带样式：接入方没装 tip-jar 也要能看 ─────────────────────────────────
// 此前嵌入版依赖宿主 client 注入的 CSS —— 没装 tip-jar 的机器上是裸 HTML。
{
  // 幂等：同一份 document 只注入一次
  const head = { children: [] }
  const doc = {
    head: { appendChild: (el) => { head.children.push(el); doc._byId[el.id] = el } },
    _byId: {},
    createElement: () => ({ id: '', textContent: '' }),
    getElementById: (id) => head.children.find((e) => e.id === id) ?? null,
  }
  const first = ensureEmbedStyles(doc)
  const second = ensureEmbedStyles(doc)
  check('首次调用会插入 style', first === true)
  check('再次调用是幂等的（不重复插入）', second === false && head.children.length === 1, 'children=' + head.children.length)
  check('注入的 style 带稳定 id', head.children[0] && head.children[0].id === 'dsh-tip-jar-embed-css', String(head.children[0] && head.children[0].id))
  check('注入的 CSS 非空', head.children[0] && head.children[0].textContent.length > 200)

  // 无 document（SSR / Node）时必须静默返回 false，不能抛
  let threw = false
  let ret = null
  try { ret = ensureEmbedStyles(null) } catch (e) { threw = true }
  check('无 document 时不抛错且返回 false', threw === false && ret === false)

  // 关键：组件用到的每个 sps-* 类都必须有自带样式 —— 否则又退回"裸 HTML"
  const here = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(join(here, '..', 'src', 'embed.js'), 'utf8')
  const body = src.slice(src.indexOf('function TipJarEmbed'))
  const used = new Set()
  for (const m of body.matchAll(/className: '([^']+)'/g)) {
    for (const c of m[1].split(/\s+/)) if (c.startsWith('sps-')) used.add(c)
  }
  const missing = [...used].filter((c) => !EMBED_CLASSES.includes(c))
  check('组件用到的每个 sps-* 类都在自带样式清单里（防漂移）', missing.length === 0, '缺: ' + missing.join(', '))

  // 每个主题变量都应带 fallback，否则主题变量缺失时会不可读
  const css = readFileSync(join(here, '..', 'src', 'embed.js'), 'utf8')
  const vars = [...css.matchAll(/var\(--dsw-[a-z0-9-]+([^)]*)\)/g)]
  const noFallback = vars.filter((m) => !m[1].startsWith(','))
  check('自带样式里每个主题变量都配了 fallback', noFallback.length === 0, '缺 fallback: ' + noFallback.slice(0, 3).map((m) => m[0]).join(' '))
  check('自带样式确实被引用（不是死代码）', /ensureEmbedStyles\(\)/.test(src))
}

// ── subscriptions 的层级兼容（曾静默失效）────────────────────────────────────
// 背景：usdc/fiat/qrCodes 在 c.tips 内，而 subscriptions 历史上只在贡献者顶层。
// 往 tips 里写 subscriptions 不报错、也永远不显示 —— 正是"静默失效"。
// 现在两处都读、按 url 去重合并；校验器两处都认，且 null 视同未登记。
{
  const gh = { label: 'GitHub Sponsors', url: 'https://github.com/sponsors/x' }
  const patreon = { label: 'Patreon', url: 'https://patreon.com/y' }

  check('subscriptions：只写顶层仍生效（向后兼容）',
    resolveChannels({ tips: {}, subscriptions: [gh] }).subscriptions.length === 1)
  check('subscriptions：只写 tips 内也生效（此前静默失效）',
    resolveChannels({ tips: { subscriptions: [gh] } }).subscriptions.length === 1)
  check('subscriptions：两处同一 url 去重',
    resolveChannels({ tips: { subscriptions: [gh] }, subscriptions: [gh] }).subscriptions.length === 1)
  const both = resolveChannels({ tips: { subscriptions: [gh] }, subscriptions: [patreon] })
  check('subscriptions：两处不同 url 合并', both.subscriptions.length === 2, String(both.subscriptions.length))
  check('subscriptions：合并后 hasAny 为真', both.hasAny === true)
  check('subscriptions：脏数据（null/缺 url/非数组）不炸且被过滤',
    resolveChannels({ tips: { subscriptions: [null, { label: 'x' }, 3] }, subscriptions: 'nope' }).subscriptions.length === 0)

  const reg = function (tipsSubs, topSubs) {
    const tips = { usdc: '0x' + '1'.repeat(40) }
    if (tipsSubs !== undefined) tips.subscriptions = tipsSubs
    return {
      schemaVersion: 1,
      contributors: [{ id: 'a', alias: 'A', verified: true, tips: tips, subscriptions: topSubs }],
      plugins: [],
    }
  }
  const v1 = validateRegistry(reg([gh], undefined))
  check('校验：tips.subscriptions 合法通过', v1.ok === true, v1.errors.join(' | '))
  check('校验：tips.subscriptions 非数组被拒', validateRegistry(reg('x', undefined)).ok === false)
  check('校验：tips.subscriptions 缺 url 被拒', validateRegistry(reg([{ label: 'x' }], undefined)).ok === false)
  const v4 = validateRegistry(reg(null, null))
  check('校验：subscriptions 为 null 视同未登记（与 tips.usdc 规则一致）', v4.ok === true, v4.errors.join(' | '))
}
process.exit(failures > 0 ? 1 : 0)
