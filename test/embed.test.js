// dsh-tip-jar/test/embed.test.js
// 红绿测试：嵌入组件数据组装（resolveEmbed）——未登记/缺贡献者/正常/统计 四态。
import { resolveEmbed, resolveChannels } from '../src/embed.js'

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

process.exit(failures > 0 ? 1 : 0)
