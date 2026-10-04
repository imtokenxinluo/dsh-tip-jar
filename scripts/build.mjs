// dsh-tip-jar/scripts/build.mjs
// esbuild 构建：lib/index.js（host ESM）、lib/remote.js（共享契约）、
// lib/client.js（浏览器 bundle，包装为 window.__ModuleLoader__.load 格式）
import { build } from 'esbuild'
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'

mkdirSync('lib', { recursive: true })

const EXTERNAL = ['@deepseek-ai/*']

await build({
  entryPoints: ['src/index.js'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  // qrcode 必须保持 external：打包它会把 Node 的 require('fs') 变成
  // "__require('fs')"，在 ESM 宿主里抛 "Dynamic require of fs is not supported"
  // —— qrPng 每次执行都炸，USDC 的码因此永远不显示（2026-10-04 实测定位）。
  // external 后由宿主从 node_modules 解析（已实测可解析、可生成）。
  external: [...EXTERNAL, 'qrcode'],
})

await build({
  entryPoints: ['src/remote.js'],
  outfile: 'lib/remote.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: EXTERNAL,
})

await build({
  entryPoints: ['src/typert.js'],
  outfile: 'lib/typert.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: EXTERNAL,
})

await build({
  entryPoints: ['src/client.js'],
  outfile: 'lib/.client.tmp.js',
  bundle: true,
  format: 'iife',
  globalName: '__tipJarClient',
  platform: 'browser',
  target: 'es2020',
  external: ['react'],
})

// lib/embed.js：嵌入式打赏组件（纯 ESM，无副作用）。
// 其他插件在自己的构建中 import 'dsh-tip-jar/embed' 直接打包（React external）。
await build({
  entryPoints: ['src/embed.js'],
  outfile: 'lib/embed.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  external: ['react'],
})

const bundle = readFileSync('lib/.client.tmp.js', 'utf8')
const wrapped =
  'window.__ModuleLoader__.load({\n' +
  '\tid: "dsh-tip-jar",\n' +
  '\tfactory: (require) => {\n' +
  bundle +
  '\n\t\treturn __tipJarClient.default || __tipJarClient;\n' +
  '\t}\n' +
  '});\n'
writeFileSync('lib/client.js', wrapped)
rmSync('lib/.client.tmp.js')

console.log('built lib/index.js, lib/remote.js, lib/embed.js, lib/client.js')
