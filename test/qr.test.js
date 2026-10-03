// dsh-tip-jar/test/qr.test.js
// 二维码生成路径的红绿测试。
//
// 为什么值得单测：USDC 地址画不出码 = 打赏者扫不了 = 收不到钱。这条链路以前依赖
// 第三方 CDN（api.qrserver.com），既把收款地址交给外部服务，又受其可用性影响；
// 现在改由宿主本地生成，所以必须验证"真的能生成"和"坏输入被拦住"。
//
// 跑法：node test/qr.test.js
import { validateQrText, renderQrDataUrl, MAX_TEXT_LENGTH } from '../src/qr.js'

let failures = 0
function check(name, cond, detail) {
  if (cond) { console.log('  PASS ' + name) }
  else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')) }
}

// ── 1. 输入校验（同步、纯函数）────────────────────────────────────────────
check('空字符串被拒', validateQrText('').ok === false)
check('只有空白被拒', validateQrText('   ').ok === false)
check('null / undefined / 非字符串被拒',
  validateQrText(null).ok === false && validateQrText(undefined).ok === false && validateQrText(12345).ok === false)
check('首尾空白会被去掉', validateQrText('  0xabc  ').text === '0xabc')
check('超长文本被拒', validateQrText('x'.repeat(MAX_TEXT_LENGTH + 1)).ok === false)
check('恰好到上限可通过', validateQrText('x'.repeat(MAX_TEXT_LENGTH)).ok === true)
check('拒绝理由可读', typeof validateQrText('').reason === 'string' && validateQrText('').reason.length > 0)

// ── 2. 真正生成（异步，依赖已安装的 qrcode）────────────────────────────────
const ADDR = '0xcea407b16bc7ddd308d74330bdc271d490835123'

try {
  const dataUrl = await renderQrDataUrl(ADDR, { width: 220 })
  check('返回 PNG data URL', typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,'),
    String(dataUrl).slice(0, 40))
  check('内容不是空图（长度合理）', typeof dataUrl === 'string' && dataUrl.length > 500, 'len=' + String(dataUrl).length)
} catch (error) {
  check('生成 USDC 地址二维码', false, (error && error.message) || String(error))
}

try {
  await renderQrDataUrl('')
  check('坏输入必须抛错（不能静默返回空码）', false, '没有抛错')
} catch (error) {
  check('坏输入必须抛错（不能静默返回空码）', true)
}

// ── 3. 相同输入两次调用应稳定（缓存依赖它）────────────────────────────────
try {
  const a = await renderQrDataUrl(ADDR)
  const b = await renderQrDataUrl(ADDR)
  check('同输入两次生成结果一致（缓存前提）', a === b)
} catch (error) {
  check('同输入两次生成结果一致（缓存前提）', false, (error && error.message) || String(error))
}

process.exit(failures > 0 ? 1 : 0)
