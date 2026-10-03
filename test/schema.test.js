// dsh-tip-jar/test/schema.test.js
// sponsors.schema.json 契约测试。
//
// 为什么要有这个文件：Schema 是给编辑器/CI/第三方工具看的"对外契约"，而真正拦数据的是
// src/validate.js。两者写的是同一套规则，一旦漂移就会出现"编辑器说合法、运行时拒绝"的
// 最糟体验。这里把两者的关键规则钉在一起，改了一边忘了另一边就会红。
//
// 跑法：node test/schema.test.js（受限沙箱下不 spawn 子进程）
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

let failures = 0
function check(name, cond, detail) {
  if (cond) { console.log('  PASS ' + name) }
  else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')) }
}

// ── 1. 文件存在且是合法 JSON ───────────────────────────────────────────────
const schemaPath = join(root, 'sponsors.schema.json')
check('sponsors.schema.json 存在', existsSync(schemaPath))

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
check('声明了 $schema 方言', typeof schema.$schema === 'string' && schema.$schema.includes('json-schema.org'))
check('顶层要求 schemaVersion / contributors / plugins',
  ['schemaVersion', 'contributors', 'plugins'].every(function (k) { return (schema.required || []).includes(k) }))
check('schemaVersion 固定为 1', schema.properties.schemaVersion.const === 1)

// ── 2. 关键 pattern 必须与 validate.js 的实际规则逐字一致 ──────────────────
// 这两条正则是"地址写错就收不到钱"的那道闸门，最不能漂移。
const validateSrc = readFileSync(join(root, 'src', 'validate.js'), 'utf8')
// 提取到"未转义的下一个 /" 为止：URL 正则里含 \/ 转义，朴素的 /(.+?)\// 会在那里截断。
const RE_BODY = '((?:\\\\.|[^/\\\\])+)'
const addrRe = (validateSrc.match(new RegExp('const ADDR_RE = /' + RE_BODY + '/')) || [])[1]
const urlRe = (validateSrc.match(new RegExp('const URL_RE = /' + RE_BODY + '/')) || [])[1]

// 正则"源码字面量"与 JSON Schema 里的 pattern 对 '/' 的转义要求不同（前者可写 \/），
// 语义相同即可 —— 比较前统一去掉多余的反斜杠转义。
function normalizeRe(re) {
  return String(re == null ? '' : re).replace(/\\\//g, '/')
}

check('validate.js 里能取到 ADDR_RE', typeof addrRe === 'string' && addrRe.length > 0, String(addrRe))
check('validate.js 里能取到 URL_RE', typeof urlRe === 'string' && urlRe.length > 0, String(urlRe))

const schemaAddr = schema.$defs.tips.properties.usdc.pattern
const schemaUrl = schema.$defs.link.properties.url.pattern
check('USDC 地址 pattern 与 ADDR_RE 一致（漂移 = 编辑器放行、运行时拒绝）',
  normalizeRe(schemaAddr) === normalizeRe(addrRe), 'schema=' + schemaAddr + ' validate=' + addrRe)
check('链接 URL pattern 与 URL_RE 一致',
  normalizeRe(schemaUrl) === normalizeRe(urlRe), 'schema=' + schemaUrl + ' validate=' + urlRe)

// ── 3. 每种通道都在 Schema 里有定义（embed 曾经漏掉三种通道）────────────────
const tipProps = Object.keys(schema.$defs.tips.properties)
for (const ch of ['usdc', 'fiat', 'qrCodes', 'subscriptions']) {
  const declared = ch === 'subscriptions' ? Object.keys(schema.$defs.contributor.properties).includes(ch) : tipProps.includes(ch)
  check('Schema 覆盖通道: ' + ch, declared)
}
check('qrCode 通道要求 label + image',
  ['label', 'image'].every(function (k) { return (schema.$defs.qrCode.required || []).includes(k) }))

// ── 4. 引用完整性相关字段存在（plugin.contributorId 指向 contributor.id）──────
check('plugin 要求 pluginId + contributorId',
  ['pluginId', 'contributorId'].every(function (k) { return (schema.$defs.plugin.required || []).includes(k) }))
check('contributor 要求 id / alias / verified / tips',
  ['id', 'alias', 'verified', 'tips'].every(function (k) { return (schema.$defs.contributor.required || []).includes(k) }))

// ── 5. CLI 入口已接线（存在 + 声明在 package.json 的 bin 里）────────────────
const binPath = join(root, 'bin', 'validate-sponsors.mjs')
check('bin/validate-sponsors.mjs 存在', existsSync(binPath))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
check('package.json 声明了 bin.dsh-tip-jar-validate',
  pkg.bin && pkg.bin['dsh-tip-jar-validate'] === './bin/validate-sponsors.mjs',
  JSON.stringify(pkg.bin))
check('files 白名单含 bin 与 sponsors.schema.json（否则装了包也没有这些）',
  (pkg.files || []).includes('bin') && (pkg.files || []).includes('sponsors.schema.json'),
  JSON.stringify(pkg.files))
check('bin 脚本带 shebang', readFileSync(binPath, 'utf8').startsWith('#!/usr/bin/env node'))

process.exit(failures > 0 ? 1 : 0)
