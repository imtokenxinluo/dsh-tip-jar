// dsh-tip-jar/test/onchain.test.js
// 红绿测试：链上到账雷达的纯逻辑（查询构造 / 日志解析 / 聚合 / 合并 / 格式化）
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  TRANSFER_TOPIC,
  padAddress,
  buildGetLogsRequest,
  parseTransferLogs,
  aggregateStats,
  mergeStats,
  formatUsdc,
  formatTipStats,
} from '../src/onchain.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
function check(name, cond, detail) {
  if (cond) { console.log('  PASS ' + name) }
  else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')) }
}

const USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'
const CONTRIBUTORS = [
  { id: 'ghost-trader', usdc: '0x1111111111111111111111111111111111111111' },
  { id: 'algo-wizard', usdc: '0x2222222222222222222222222222222222222222' },
]

// 1. padAddress：32 字节左补零
check('padAddress 32字节左补零',
  padAddress('0x1111111111111111111111111111111111111111') ===
  '0x000000000000000000000000' + '1111111111111111111111111111111111111111')

// 2. buildGetLogsRequest：topic0=Transfer，topic2 为各贡献者地址
const req = buildGetLogsRequest(USDC, CONTRIBUTORS, 100, 200)
const reqParams = req && req.params && req.params[0]
check('buildGetLogsRequest 方法为 eth_getLogs', req && req.method === 'eth_getLogs')
check('buildGetLogsRequest topic0 为 Transfer', reqParams && reqParams.topics && reqParams.topics[0] === TRANSFER_TOPIC)
check('buildGetLogsRequest topic2 含两个贡献者地址',
  reqParams && Array.isArray(reqParams.topics && reqParams.topics[2]) && reqParams.topics[2].length === 2)
check('buildGetLogsRequest 区块范围', reqParams && reqParams.fromBlock === 100 && reqParams.toBlock === 200)

// 3. parseTransferLogs：data 解析 + 6 位小数
const log1 = {
  address: USDC,
  topics: [
    TRANSFER_TOPIC,
    '0x000000000000000000000000' + 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '0x000000000000000000000000' + '1111111111111111111111111111111111111111',
  ],
  data: '0x00000000000000000000000000000000000000000000000000000000001e8480', // 2_000_000 units = 2 USDC
  blockNumber: '0x64',
}
const parsed = parseTransferLogs([log1], USDC)
check('parseTransferLogs 解析出 1 条', parsed.length === 1)
check('parseTransferLogs 金额=2 USDC', parsed[0] && parsed[0].amountUsdc === 2)
check('parseTransferLogs to 地址解包正确', parsed[0] && parsed[0].to === '0x1111111111111111111111111111111111111111')

// 4. aggregateStats：只统计贡献者收款 + 求和
const log2 = {
  address: USDC,
  topics: [
    TRANSFER_TOPIC,
    '0x000000000000000000000000' + 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '0x000000000000000000000000' + '1111111111111111111111111111111111111111',
  ],
  data: '0x00000000000000000000000000000000000000000000000000000000000f4240', // 1_000_000 = 1 USDC
  blockNumber: '0x65',
}
const log3 = {
  address: USDC,
  topics: [
    TRANSFER_TOPIC,
    '0x000000000000000000000000' + 'cccccccccccccccccccccccccccccccccccccccc',
    '0x000000000000000000000000' + '9999999999999999999999999999999999999999', // 非贡献者
  ],
  data: '0x0000000000000000000000000000000000000000000000000000000000000064', // 100 units
  blockNumber: '0x66',
}
const agg = aggregateStats(parseTransferLogs([log1, log2, log3], USDC), CONTRIBUTORS)
check('aggregateStats 忽略非贡献者收款', agg && !agg.byContributorId['unknown'] && Object.keys(agg.byContributorId).length === 1)
check('aggregateStats 求和=3 USDC / 2笔',
  agg && agg.byContributorId['ghost-trader'] && agg.byContributorId['ghost-trader'].count === 2 && agg.byContributorId['ghost-trader'].amountUsdc === 3)
check('aggregateStats lastBlock=0x66', agg && agg.lastBlock === 0x66)

// 5. mergeStats：合并两批（幂等累加）
const prev = { byContributorId: { 'ghost-trader': { count: 1, amountUsdc: 0.5 } }, lastBlock: 0x20 }
const next = { byContributorId: { 'ghost-trader': { count: 2, amountUsdc: 1.25 }, 'algo-wizard': { count: 1, amountUsdc: 3 } }, lastBlock: 0x40 }
const merged = mergeStats(prev, next)
check('mergeStats 累加 count', merged && merged.byContributorId['ghost-trader'] && merged.byContributorId['ghost-trader'].count === 3)
check('mergeStats 累加金额', merged && merged.byContributorId['ghost-trader'] && merged.byContributorId['ghost-trader'].amountUsdc === 1.75)
check('mergeStats 引入新贡献者', merged && merged.byContributorId['algo-wizard'] && merged.byContributorId['algo-wizard'].amountUsdc === 3)
check('mergeStats 取较大 lastBlock', merged && merged.lastBlock === 0x40)

// 6. formatUsdc：两位小数
check('formatUsdc 两位小数', formatUsdc(3) === '$3.00' && formatUsdc(1.234567) === '$1.23')

// 7. 支持人数：按 from 地址去重
const agg2 = aggregateStats(parseTransferLogs([log1, log2, log3], USDC), CONTRIBUTORS)
check('supporters 去重统计（2 个不同 from）',
  agg2.byContributorId['ghost-trader'].supporters === 2)
const sameFrom = [log1, Object.assign({}, log1, { blockNumber: '0x67' })]
const agg3 = aggregateStats(parseTransferLogs(sameFrom, USDC), CONTRIBUTORS)
check('同 from 两次只算 1 个支持者', agg3.byContributorId['ghost-trader'].supporters === 1)

// 8. mergeStats 支持者取并集
const prevM = {
  byContributorId: { 'ghost-trader': { count: 1, amountUsdc: 0.5, supporters: 1, fromSet: ['0xaaa'] } },
  lastBlock: 0x20,
}
const nextM = {
  byContributorId: {
    'ghost-trader': { count: 2, amountUsdc: 1.25, supporters: 1, fromSet: ['0xbbb'] },
    'algo-wizard': { count: 1, amountUsdc: 3, supporters: 1, fromSet: ['0xccc'] },
  },
  lastBlock: 0x40,
}
const mergedM = mergeStats(prevM, nextM)
check('merge 支持者取并集', mergedM.byContributorId['ghost-trader'].supporters === 2)

// ── formatTipStats：把统计渲染成一行（贡献者可见性）─────────────────────────
check('统计文本：全字段齐全', formatTipStats({ amountUsdc: 12.3, count: 5, supporters: 3 }) === '$12.30 · 5 笔 · 3 位支持者',
  formatTipStats({ amountUsdc: 12.3, count: 5, supporters: 3 }))
check('统计文本：只有金额时不编造笔数/人数', formatTipStats({ amountUsdc: 1 }) === '$1.00', formatTipStats({ amountUsdc: 1 }))
check('统计文本：有金额与笔数但无支持者数据（旧记录）',
  formatTipStats({ amountUsdc: 2, count: 2 }) === '$2.00 · 2 笔', formatTipStats({ amountUsdc: 2, count: 2 }))
check('统计文本：支持者为 0 不显示', formatTipStats({ amountUsdc: 0, count: 1, supporters: 0 }) === '$0.00 · 1 笔',
  formatTipStats({ amountUsdc: 0, count: 1, supporters: 0 }))
check('统计文本：空/非法输入返回空串', formatTipStats(null) === '' && formatTipStats(undefined) === '' && formatTipStats('x') === '')
check('统计文本：字符串数字也能处理（配置/JSON 宽松）',
  formatTipStats({ amountUsdc: '3.5', count: '2', supporters: '1' }) === '$3.50 · 2 笔 · 1 位支持者',
  formatTipStats({ amountUsdc: '3.5', count: '2', supporters: '1' }))

console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILED')
process.exit(failures === 0 ? 0 : 1)
