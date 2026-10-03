// dsh-tip-jar/src/index.js
// Host 半：读取并校验 sponsors.json，经 Typert Remote 暴露给 Client
import { Service } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { validateRegistry } from './validate.js'
import { validateQrText, renderQrDataUrl } from './qr.js'

// 默认查找工作区根目录的 sponsors.json；可通过插件配置 config.roots 覆盖
const DEFAULT_ROOTS = ['sponsors.json']
// 链上统计持久化文件候选（部署本地路径由 row config 补充）
const DEFAULT_STATS_FILES = ['.tip-jar-stats.json']

function fail(code, message) {
  return { code, message }
}

class TipJarService extends TypertRemoteService {
  static inject = ['fs']

  constructor(ctx, config = {}) {
    super(ctx, 'tipJar')
    this.config = {
      roots: DEFAULT_ROOTS,
      statsFiles: DEFAULT_STATS_FILES,
      ...config,
    }
  }

  async [Service.init]() {
    // 无异步初始化；注册表在每次 listSponsors 时实时读取
  }

  async listSponsors() {
    try {
      const value = await this.loadRegistry()
      return { ok: true, value }
    } catch (error) {
      return {
        ok: false,
        error: fail('tip-jar-load-failed', error && error.message ? error.message : String(error)),
      }
    }
  }

  async tipStats() {
    try {
      const data = await this.readStats()
      return { ok: true, value: data }
    } catch (error) {
      return { ok: false, error: fail('tip-jar-stats-read-failed', error && error.message ? error.message : String(error)) }
    }
  }

  async saveTipStats(request) {
    const stats = request && request.stats
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
      return { ok: false, error: fail('tip-jar-bad-stats', 'invalid stats payload') }
    }
    try {
      await this.writeStats(stats)
      return { ok: true, value: { saved: true } }
    } catch (error) {
      return { ok: false, error: fail('tip-jar-stats-write-failed', error && error.message ? error.message : String(error)) }
    }
  }

  /**
   * 本地生成收款地址二维码（返回 data URL）。
   *
   * 为什么放在宿主而不是客户端：客户端生成要把 qrcode 打进每个接入插件的 bundle；
   * 请求第三方 CDN 又等于把收款地址交给外部服务、且服务不可用时二维码直接消失。
   * 宿主生成一次、缓存复用，接入方零成本。
   */
  async qrPng(request) {
    const check = validateQrText(request && request.text)
    if (!check.ok) return { ok: false, error: fail('tip-jar-bad-qr-text', check.reason) }
    try {
      const dataUrl = await this.renderQr(check.text)
      return { ok: true, value: { dataUrl } }
    } catch (error) {
      return { ok: false, error: fail('tip-jar-qr-failed', error && error.message ? error.message : String(error)) }
    }
  }

  async renderQr(text) {
    if (this.qrCache === undefined) this.qrCache = new Map()
    const cached = this.qrCache.get(text)
    if (cached !== undefined) return cached
    const dataUrl = await renderQrDataUrl(text, { width: 220 })
    if (this.qrCache.size >= 64) this.qrCache.clear()
    this.qrCache.set(text, dataUrl)
    return dataUrl
  }

  async readStats() {
    const fs = this.ctx.fs
    if (!fs) return { stats: null, present: false }
    for (const f of this.config.statsFiles) {
      try {
        const target = await fs.resolve(f, {})
        const text = await fs.readText(target)
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { stats: parsed, present: true }
        }
      } catch (e) { /* try next candidate */ }
    }
    return { stats: null, present: false }
  }

  async writeStats(stats) {
    const fs = this.ctx.fs
    if (!fs) throw new Error('fs 服务不可用')
    const text = JSON.stringify(stats)
    let lastError = null
    for (const f of this.config.statsFiles) {
      try {
        const target = await fs.resolve(f, {})
        await fs.writeText(target, text)
        return
      } catch (e) { lastError = e /* try next candidate */ }
    }
    throw lastError || new Error('所有统计文件路径均不可写: ' + this.config.statsFiles.join(', '))
  }

  async loadRegistry() {
    const fs = this.ctx.fs
    if (!fs) return { ok: false, errors: ['fs 服务不可用'], data: null }
    for (const root of this.config.roots) {
      try {
        const target = await fs.resolve(root, {})
        const text = await fs.readText(target)
        let parsed = null
        try { parsed = JSON.parse(text) } catch (e) {
          return { ok: false, errors: ['sponsors.json 不是合法 JSON'], data: null }
        }
        const v = validateRegistry(parsed)
        return { ok: v.ok, errors: v.errors, data: parsed }
      } catch (e) { /* try next root */ }
    }
    return { ok: false, errors: ['sponsors.json 未找到（期望在工作区根目录）'], data: null }
  }
}

export default TipJarService
