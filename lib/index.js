// src/index.js
import { Service } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

// src/validate.js
var ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
var URL_RE = /^https?:\/\/\S+$/;
function isStr(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function isArr(v) {
  return Array.isArray(v);
}
function isObj(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function checkLink(errors, prefix, item) {
  if (!isObj(item) || !isStr(item.label) || !isStr(item.url) || !URL_RE.test(item.url)) {
    errors.push(prefix + " \u9700\u8981 {label, url(https://\u2026)}");
  }
}
function validateRegistry(input) {
  const errors = [];
  const warnings = [];
  if (!isObj(input)) {
    return { ok: false, errors: ["\u6CE8\u518C\u8868\u5FC5\u987B\u662F JSON \u5BF9\u8C61"], warnings };
  }
  if (input.schemaVersion !== 1) {
    errors.push("schemaVersion \u5FC5\u987B\u4E3A 1");
  }
  if (!isArr(input.contributors)) {
    errors.push("contributors \u5FC5\u987B\u662F\u6570\u7EC4");
  } else {
    const seen = /* @__PURE__ */ new Set();
    input.contributors.forEach(function(c, i) {
      const p = "contributors[" + i + "]";
      if (!isObj(c)) {
        errors.push(p + " \u5FC5\u987B\u662F\u5BF9\u8C61");
        return;
      }
      if (!isStr(c.id)) errors.push(p + ".id \u7F3A\u5931");
      else if (seen.has(c.id)) errors.push(p + ".id \u91CD\u590D: " + c.id);
      else seen.add(c.id);
      if (!isStr(c.alias)) errors.push(p + ".alias \u7F3A\u5931\uFF08\u5316\u540D\u662F\u9690\u79C1\u9ED8\u8BA4\uFF09");
      if (typeof c.verified !== "boolean") errors.push(p + ".verified \u5FC5\u987B\u662F\u5E03\u5C14\u503C");
      if (!isObj(c.tips)) errors.push(p + ".tips \u7F3A\u5931");
      else {
        if (c.tips.usdc !== void 0 && c.tips.usdc !== null && !ADDR_RE.test(c.tips.usdc)) {
          errors.push(p + ".tips.usdc \u5730\u5740\u683C\u5F0F\u65E0\u6548: " + c.tips.usdc);
        }
        if (c.tips.fiat !== void 0) {
          if (!isArr(c.tips.fiat)) errors.push(p + ".tips.fiat \u5FC5\u987B\u662F\u6570\u7EC4");
          else c.tips.fiat.forEach(function(f, j) {
            checkLink(errors, p + ".tips.fiat[" + j + "]", f);
          });
        }
        if (c.tips.qrCodes !== void 0) {
          if (!isArr(c.tips.qrCodes)) errors.push(p + ".tips.qrCodes \u5FC5\u987B\u662F\u6570\u7EC4");
          else c.tips.qrCodes.forEach(function(q, j) {
            const qp = p + ".tips.qrCodes[" + j + "]";
            if (!isObj(q)) {
              errors.push(qp + " \u5FC5\u987B\u662F\u5BF9\u8C61");
              return;
            }
            if (!isStr(q.label) || !q.label.trim()) errors.push(qp + ".label \u7F3A\u5931\uFF08\u5982 \u5FAE\u4FE1/\u652F\u4ED8\u5B9D\uFF09");
            if (!isStr(q.image) || !q.image.trim()) errors.push(qp + ".image \u7F3A\u5931\uFF08\u6536\u6B3E\u7801\u56FE\u7247 URL \u6216\u8DEF\u5F84\uFF09");
          });
        }
        if (c.tips.subscriptions !== void 0 && c.tips.subscriptions !== null) {
          if (!isArr(c.tips.subscriptions)) errors.push(p + ".tips.subscriptions \u5FC5\u987B\u662F\u6570\u7EC4");
          else c.tips.subscriptions.forEach(function(s, j) {
            checkLink(errors, p + ".tips.subscriptions[" + j + "]", s);
          });
        }
      }
      if (c.subscriptions !== void 0 && c.subscriptions !== null) {
        if (!isArr(c.subscriptions)) errors.push(p + ".subscriptions \u5FC5\u987B\u662F\u6570\u7EC4");
        else c.subscriptions.forEach(function(s, j) {
          checkLink(errors, p + ".subscriptions[" + j + "]", s);
        });
      }
      if (c.ethics !== void 0) {
        if (!isObj(c.ethics)) {
          errors.push(p + ".ethics \u5FC5\u987B\u662F\u5BF9\u8C61");
        } else {
          if (c.ethics.voluntary !== void 0 && typeof c.ethics.voluntary !== "boolean") {
            errors.push(p + ".ethics.voluntary \u5FC5\u987B\u662F\u5E03\u5C14\u503C");
          }
          if (c.ethics.paidWall !== void 0 && typeof c.ethics.paidWall !== "boolean") {
            errors.push(p + ".ethics.paidWall \u5FC5\u987B\u662F\u5E03\u5C14\u503C");
          }
          if (c.ethics.paidWall === true) {
            warnings.push(p + ".ethics.paidWall=true\uFF1A\u8BE5\u8D21\u732E\u8005\u58F0\u660E\u5B58\u5728\u4ED8\u8D39\u5899\uFF0C\u8FDD\u53CD\u81EA\u613F\u6253\u8D4F\u4F26\u7406\u89C4\u8303");
          }
        }
      }
    });
  }
  if (!isArr(input.plugins)) {
    errors.push("plugins \u5FC5\u987B\u662F\u6570\u7EC4");
  } else {
    const contributorIds = /* @__PURE__ */ new Set();
    (input.contributors || []).forEach(function(c) {
      if (isObj(c) && isStr(c.id)) contributorIds.add(c.id);
    });
    const pluginSeen = /* @__PURE__ */ new Set();
    input.plugins.forEach(function(p, i) {
      const pp = "plugins[" + i + "]";
      if (!isObj(p)) {
        errors.push(pp + " \u5FC5\u987B\u662F\u5BF9\u8C61");
        return;
      }
      if (!isStr(p.pluginId)) errors.push(pp + ".pluginId \u7F3A\u5931");
      else if (pluginSeen.has(p.pluginId)) errors.push(pp + ".pluginId \u91CD\u590D: " + p.pluginId);
      else pluginSeen.add(p.pluginId);
      if (!isStr(p.contributorId)) errors.push(pp + ".contributorId \u7F3A\u5931");
      else if (!contributorIds.has(p.contributorId)) errors.push(pp + ".contributorId \u672A\u77E5: " + p.contributorId);
      if (p.sponsors !== void 0) {
        if (!isArr(p.sponsors)) errors.push(pp + ".sponsors \u5FC5\u987B\u662F\u6570\u7EC4");
        else p.sponsors.forEach(function(s, j) {
          const sp = pp + ".sponsors[" + j + "]";
          if (!isObj(s) || !isStr(s.name) || !isStr(s.message) || !isStr(s.url) || !URL_RE.test(s.url)) {
            errors.push(sp + " \u9700\u8981 {name, message, url(https://\u2026)}");
          }
        });
      }
      if (p.upstream !== void 0) {
        if (!isObj(p.upstream)) {
          errors.push(pp + ".upstream \u5FC5\u987B\u662F\u5BF9\u8C61");
        } else {
          if (!isStr(p.upstream.repo) || !URL_RE.test(p.upstream.repo)) {
            errors.push(pp + ".upstream.repo \u5FC5\u987B\u662F http(s) URL\uFF08\u4E0A\u6E38\u4ED3\u5E93\uFF09");
          }
          if (!isStr(p.upstream.author)) {
            errors.push(pp + ".upstream.author \u7F3A\u5931\uFF08\u4E0A\u6E38\u4F5C\u8005\uFF09");
          }
          if (p.upstream.license !== void 0 && !isStr(p.upstream.license)) {
            errors.push(pp + ".upstream.license \u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
          }
        }
      }
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}

// src/qr.js
var MAX_TEXT_LENGTH = 512;
function validateQrText(input) {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return { ok: false, reason: "text is required" };
  if (text.length > MAX_TEXT_LENGTH) return { ok: false, reason: "text too long (max " + MAX_TEXT_LENGTH + ")" };
  return { ok: true, text };
}
async function renderQrDataUrl(input, options = {}) {
  const check = validateQrText(input);
  if (!check.ok) throw new Error(check.reason);
  const mod = await import("qrcode");
  const QRCode = mod && mod.default ? mod.default : mod;
  if (!QRCode || typeof QRCode.toDataURL !== "function") {
    throw new Error("qrcode \u6A21\u5757\u4E0D\u53EF\u7528\uFF08toDataURL \u7F3A\u5931\uFF09");
  }
  return QRCode.toDataURL(check.text, {
    width: options.width || 220,
    margin: 1,
    errorCorrectionLevel: "M"
  });
}

// src/index.js
var DEFAULT_ROOTS = ["sponsors.json"];
var DEFAULT_STATS_FILES = [".tip-jar-stats.json"];
function fail(code, message) {
  return { code, message };
}
var TipJarService = class extends TypertRemoteService {
  static inject = ["fs"];
  constructor(ctx, config = {}) {
    super(ctx, "tipJar");
    this.config = {
      roots: DEFAULT_ROOTS,
      statsFiles: DEFAULT_STATS_FILES,
      ...config
    };
  }
  async [Service.init]() {
  }
  async listSponsors() {
    try {
      const value = await this.loadRegistry();
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        error: fail("tip-jar-load-failed", error && error.message ? error.message : String(error))
      };
    }
  }
  async tipStats() {
    try {
      const data = await this.readStats();
      return { ok: true, value: data };
    } catch (error) {
      return { ok: false, error: fail("tip-jar-stats-read-failed", error && error.message ? error.message : String(error)) };
    }
  }
  async saveTipStats(request) {
    const stats = request && request.stats;
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
      return { ok: false, error: fail("tip-jar-bad-stats", "invalid stats payload") };
    }
    try {
      await this.writeStats(stats);
      return { ok: true, value: { saved: true } };
    } catch (error) {
      return { ok: false, error: fail("tip-jar-stats-write-failed", error && error.message ? error.message : String(error)) };
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
    const check = validateQrText(request && request.text);
    if (!check.ok) return { ok: false, error: fail("tip-jar-bad-qr-text", check.reason) };
    try {
      const dataUrl = await this.renderQr(check.text);
      return { ok: true, value: { dataUrl } };
    } catch (error) {
      return { ok: false, error: fail("tip-jar-qr-failed", error && error.message ? error.message : String(error)) };
    }
  }
  async renderQr(text) {
    if (this.qrCache === void 0) this.qrCache = /* @__PURE__ */ new Map();
    const cached = this.qrCache.get(text);
    if (cached !== void 0) return cached;
    const dataUrl = await renderQrDataUrl(text, { width: 220 });
    if (this.qrCache.size >= 64) this.qrCache.clear();
    this.qrCache.set(text, dataUrl);
    return dataUrl;
  }
  async readStats() {
    const fs = this.ctx.fs;
    if (!fs) return { stats: null, present: false };
    for (const f of this.config.statsFiles) {
      try {
        const target = await fs.resolve(f, {});
        const text = await fs.readText(target);
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return { stats: parsed, present: true };
        }
      } catch (e) {
      }
    }
    return { stats: null, present: false };
  }
  async writeStats(stats) {
    const fs = this.ctx.fs;
    if (!fs) throw new Error("fs \u670D\u52A1\u4E0D\u53EF\u7528");
    const text = JSON.stringify(stats);
    let lastError = null;
    for (const f of this.config.statsFiles) {
      try {
        const target = await fs.resolve(f, {});
        await fs.writeText(target, text);
        return;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error("\u6240\u6709\u7EDF\u8BA1\u6587\u4EF6\u8DEF\u5F84\u5747\u4E0D\u53EF\u5199: " + this.config.statsFiles.join(", "));
  }
  /**
   * 读注册表。带**短 TTL 缓存**：注册表是人工维护的只读文件（改它的唯一方式是编辑磁盘上的
   * sponsors.json），而每个接入插件的每次挂载都会调 listSponsors —— 页面里接了 N 处打赏条
   * 就会读 N 次同一个文件。缓存 10 秒足够消除这种重复，同时保证手工改完几乎立刻生效。
   *
   * 失败结果**不缓存**：文件写坏或暂时读不到时，应当立即重试，而不是把错误钉住 10 秒。
   */
  async loadRegistry() {
    const ttlMs = typeof this.config.registryTtlMs === "number" ? this.config.registryTtlMs : 1e4;
    const now = Date.now();
    if (ttlMs > 0 && this.registryCache && now - this.registryCache.at < ttlMs) {
      return this.registryCache.value;
    }
    const value = await this.readRegistryFromDisk();
    if (ttlMs > 0 && value && value.ok) this.registryCache = { at: now, value };
    return value;
  }
  async readRegistryFromDisk() {
    const fs = this.ctx.fs;
    if (!fs) return { ok: false, errors: ["fs \u670D\u52A1\u4E0D\u53EF\u7528"], data: null };
    for (const root of this.config.roots) {
      try {
        const target = await fs.resolve(root, {});
        const text = await fs.readText(target);
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          return { ok: false, errors: ["sponsors.json \u4E0D\u662F\u5408\u6CD5 JSON"], data: null };
        }
        const v = validateRegistry(parsed);
        return { ok: v.ok, errors: v.errors, data: parsed };
      } catch (e) {
      }
    }
    return { ok: false, errors: ["sponsors.json \u672A\u627E\u5230\uFF08\u671F\u671B\u5728\u5DE5\u4F5C\u533A\u6839\u76EE\u5F55\uFF09"], data: null };
  }
};
var index_default = TipJarService;
export {
  index_default as default
};
