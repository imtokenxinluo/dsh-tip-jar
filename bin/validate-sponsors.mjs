#!/usr/bin/env node
// dsh-tip-jar 注册表校验命令（无第三方依赖）。
//
//   npx dsh-tip-jar-validate sponsors.json
//   node bin/validate-sponsors.mjs sponsors.json
//
// 退出码：0 = 通过（可能有告警）｜1 = 校验失败｜2 = 用法/读取/解析错误。
// 规则与运行时同一份实现（src/validate.js），避免"文档说合法、运行时拒绝"的漂移。
import { readFileSync } from 'node:fs'
import { validateRegistry } from '../src/validate.js'

const USAGE = '用法: dsh-tip-jar-validate <sponsors.json>'

const target = process.argv[2]
if (!target || target === '-h' || target === '--help') {
  console.log(USAGE)
  process.exit(target ? 0 : 2)
}

let raw
try {
  raw = readFileSync(target, 'utf8')
} catch (error) {
  console.error('✗ 读取失败: ' + target + ' — ' + ((error && error.message) || error))
  process.exit(2)
}

let doc
try {
  doc = JSON.parse(raw)
} catch (error) {
  console.error('✗ JSON 解析失败: ' + ((error && error.message) || error))
  process.exit(1)
}

const result = validateRegistry(doc)

for (const w of result.warnings) console.log('⚠️  ' + w)
for (const e of result.errors) console.log('✗ ' + e)

if (!result.ok) {
  console.error('\n✗ 校验失败：' + result.errors.length + ' 个错误')
  process.exit(1)
}

const contributors = Array.isArray(doc.contributors) ? doc.contributors.length : 0
const plugins = Array.isArray(doc.plugins) ? doc.plugins.length : 0
console.log('✓ sponsors.json 校验通过（' + contributors + ' 个贡献者 / ' + plugins + ' 个插件）')
if (result.warnings.length > 0) console.log('  （' + result.warnings.length + ' 条告警，见上）')
process.exit(0)
