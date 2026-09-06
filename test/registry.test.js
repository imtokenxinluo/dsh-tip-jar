// dsh-tip-jar/test/registry.test.js
// 红绿测试：sponsors.json 注册表校验规则（自包含：fixture 内嵌于 test/fixtures/）
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validateRegistry } from '../src/validate.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
function check(name, cond, detail) {
  if (cond) { console.log('  PASS ' + name) }
  else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')) }
}

const raw = readFileSync(join(root, 'test', 'fixtures', 'sponsors.json'), 'utf8')

// 1. 当前 sponsors.json 应通过校验
let parsed = null
try { parsed = JSON.parse(raw) } catch (e) { /* null */ }
check('sponsors.json 可解析', parsed !== null, 'JSON.parse 失败')
if (parsed !== null) {
  const r = validateRegistry(parsed)
  check('合法注册表通过校验', r.ok === true, 'errors=' + JSON.stringify(r.errors))
}

// 2. 非法 USDC 地址应被拒绝
const badAddr = JSON.parse(raw)
badAddr.contributors[0].tips.usdc = '0x1234'
const r2 = validateRegistry(badAddr)
check('非法 USDC 地址被拒绝', r2.ok === false && JSON.stringify(r2.errors).indexOf('usdc') !== -1)

// 3. 未知 contributorId 应被拒绝
const badRef = JSON.parse(raw)
badRef.plugins[0].contributorId = 'nobody-here'
const r3 = validateRegistry(badRef)
check('未知 contributorId 被拒绝', r3.ok === false && JSON.stringify(r3.errors).indexOf('nobody-here') !== -1)

// 4. 重复 id 应被拒绝
const dup = JSON.parse(raw)
dup.contributors.push({ id: dup.contributors[0].id, alias: 'dup', verified: false, tips: {} })
const r4 = validateRegistry(dup)
check('重复 contributor id 被拒绝', r4.ok === false)

// 5. 非对象输入应被拒绝
check('null 输入被拒绝', validateRegistry(null).ok === false)

// 6. ethics 合法结构：ok 且 warnings 为空数组
const goodEthics = JSON.parse(raw)
goodEthics.contributors[0].ethics = { voluntary: true, paidWall: false }
const r6 = validateRegistry(goodEthics)
check('ethics 合法结构通过且 warnings 为空数组',
  r6.ok === true && Array.isArray(r6.warnings) && r6.warnings.length === 0)

// 7. paidWall:true → 警告但不失败（合规标记，非结构错误）
const paidWall = JSON.parse(raw)
paidWall.contributors[0].ethics = { voluntary: true, paidWall: true }
const r7 = validateRegistry(paidWall)
check('paidWall=true 产生警告且 ok 仍为 true',
  r7.ok === true && Array.isArray(r7.warnings) && JSON.stringify(r7.warnings).indexOf('paidWall') !== -1)

// 8. ethics 字段类型错误应被拒绝
const badEthics = JSON.parse(raw)
badEthics.contributors[0].ethics = { voluntary: 'yes' }
const r8 = validateRegistry(badEthics)
check('ethics.voluntary 非布尔被拒', r8.ok === false)

// 9. upstream 合法结构（fork 来源声明）
const goodUp = JSON.parse(raw)
goodUp.plugins[0].upstream = { repo: 'https://github.com/original/plugin', author: 'original-author', license: 'MIT' }
check('upstream 合法结构通过', validateRegistry(goodUp).ok === true)

// 10. upstream.repo 非 URL 应被拒绝
const badUp1 = JSON.parse(raw)
badUp1.plugins[0].upstream = { repo: 'not-a-url', author: 'x' }
check('upstream.repo 非 URL 被拒', validateRegistry(badUp1).ok === false)

// 11. upstream.author 缺失应被拒绝
const badUp2 = JSON.parse(raw)
badUp2.plugins[0].upstream = { repo: 'https://github.com/a/b' }
check('upstream.author 缺失被拒', validateRegistry(badUp2).ok === false)

// 12. upstream 非对象应被拒绝
const badUp3 = JSON.parse(raw)
badUp3.plugins[0].upstream = 'MIT'
check('upstream 非对象被拒', validateRegistry(badUp3).ok === false)

// 13. qrCodes 合法结构（收款码：微信/支付宝等）应通过
const goodQr = JSON.parse(raw)
goodQr.contributors[0].tips.qrCodes = [
  { label: '微信', image: 'https://example.com/wechat.png' },
  { label: '支付宝', image: '/assets/alipay.png' },
]
check('qrCodes 合法结构通过', validateRegistry(goodQr).ok === true)

// 14. qrCodes 缺 label 应被拒绝
const badQr1 = JSON.parse(raw)
badQr1.contributors[0].tips.qrCodes = [{ image: 'https://example.com/x.png' }]
check('qrCodes 缺 label 被拒', validateRegistry(badQr1).ok === false)

// 15. qrCodes 缺 image 应被拒绝
const badQr2 = JSON.parse(raw)
badQr2.contributors[0].tips.qrCodes = [{ label: '微信' }]
check('qrCodes 缺 image 被拒', validateRegistry(badQr2).ok === false)

// 16. qrCodes 非数组应被拒绝
const badQr3 = JSON.parse(raw)
badQr3.contributors[0].tips.qrCodes = 'wechat'
check('qrCodes 非数组被拒', validateRegistry(badQr3).ok === false)

console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILED')
process.exit(failures === 0 ? 0 : 1)
