#!/usr/bin/env node
// 逐个运行 test/*.test.js。
//
// 这些测试文件是自带 "  PASS / FAIL" 输出的普通脚本（不是 node:test），
// 所以 `node --test test/` 跑不了；而 npm test 之前只跑了 registry.test.js 一个文件 ——
// 6 个文件里 5 个从来没在 npm test 里被执行过（2026-10-26 发现）。
//
// 规则：任何一个文件退出码非 0 即整体失败。
// stdio 用 inherit（受限沙箱下 pipe 会被拒）。
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test')
const files = readdirSync(testDir).filter((f) => f.endsWith('.test.js')).sort()

let failed = []
for (const f of files) {
  const r = spawnSync(process.execPath, [join(testDir, f)], { stdio: 'inherit' })
  if (r.status !== 0) failed.push(f)
}

console.log('')
if (failed.length > 0) {
  console.error(`✗ ${failed.length}/${files.length} 个测试文件失败：${failed.join(', ')}`)
  process.exit(1)
}
console.log(`✓ ${files.length} 个测试文件全部通过`)