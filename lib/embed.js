// src/embed.js
import { createElement, useState, useEffect } from "react";

// src/onchain.js
function formatUsdc(amountUsdc) {
  return "$" + (Math.round(amountUsdc * 100) / 100).toFixed(2);
}
function formatTipStats(entry) {
  if (!entry || typeof entry !== "object") return "";
  const amount = Number(entry.amountUsdc) || 0;
  const count = Number(entry.count) || 0;
  const supporters = Number(entry.supporters) || 0;
  const parts = [formatUsdc(amount)];
  if (count > 0) parts.push(count + " \u7B14");
  if (supporters > 0) parts.push(supporters + " \u4F4D\u652F\u6301\u8005");
  return parts.join(" \xB7 ");
}

// src/embed.js
var TipJarApiError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
var TipJarApi = class {
  /** @param {() => object|undefined} getNamespace live namespace getter */
  constructor(getNamespace) {
    this.getNamespace = getNamespace;
  }
  async call(method, args) {
    const namespace = this.getNamespace();
    const fn = namespace && namespace[method];
    if (typeof fn !== "function") {
      throw new TipJarApiError("not-mounted", 'tipJar Remote method "' + method + '" is not mounted');
    }
    const rpc = await fn(args);
    if (!rpc.ok) {
      throw new TipJarApiError("rpc-failed", rpc.error && rpc.error.message || "remote call failed");
    }
    const business = rpc.value;
    if (!business.ok) {
      throw new TipJarApiError("rpc-failed", business.error && business.error.message || "remote call failed");
    }
    return business.value;
  }
  async listSponsors() {
    const result = await this.call("listSponsors", {});
    if (result.ok) return result.data;
    throw new TipJarApiError("registry-invalid", result.errors && result.errors.length ? result.errors.join("; ") : "registry load failed");
  }
  tipStats() {
    return this.call("tipStats", {});
  }
  saveTipStats(stats) {
    return this.call("saveTipStats", { stats });
  }
  /** 宿主本地生成二维码（data URL），避免请求第三方 CDN。 */
  qrPng(text) {
    return this.call("qrPng", { text });
  }
};
function createTipJarApi(ctx) {
  return new TipJarApi(() => {
    const remote = ctx.remote;
    if (!remote || !remote.namespaces) return void 0;
    const ns = remote.namespaces.get("tipJar");
    return ns ? ns.service : void 0;
  });
}
function resolveChannels(contributor) {
  const c = contributor || {};
  const tips = c.tips || {};
  const usdc = typeof tips.usdc === "string" && tips.usdc.length > 0 ? tips.usdc : "";
  const fiat = Array.isArray(tips.fiat) ? tips.fiat.filter(function(f) {
    return f && typeof f.url === "string" && f.url.length > 0 && typeof f.label === "string";
  }) : [];
  const qrCodes = Array.isArray(tips.qrCodes) ? tips.qrCodes.filter(function(q) {
    return q && typeof q.image === "string" && q.image.length > 0 && typeof q.label === "string";
  }) : [];
  const subscriptions = [];
  const seenSub = /* @__PURE__ */ new Set();
  for (const list of [tips.subscriptions, c.subscriptions]) {
    if (!Array.isArray(list)) continue;
    for (const s of list) {
      if (!s || typeof s.url !== "string" || s.url.length === 0 || typeof s.label !== "string") continue;
      if (seenSub.has(s.url)) continue;
      seenSub.add(s.url);
      subscriptions.push(s);
    }
  }
  return {
    usdc,
    fiat,
    qrCodes,
    subscriptions,
    hasAny: Boolean(usdc || fiat.length || qrCodes.length || subscriptions.length)
  };
}
function resolveEmbed(sponsors, pluginId, stats) {
  if (!sponsors || !Array.isArray(sponsors.plugins)) return { status: "loading" };
  const plugin = sponsors.plugins.filter(function(p) {
    return p.pluginId === pluginId;
  })[0];
  if (!plugin) return { status: "unregistered" };
  const contributor = (sponsors.contributors || []).filter(function(x) {
    return x.id === plugin.contributorId;
  })[0];
  if (!contributor) return { status: "no-contributor" };
  const stat = stats && stats.byContributorId && stats.byContributorId[contributor.id] ? stats.byContributorId[contributor.id] : null;
  return { status: "ok", plugin, contributor, stat };
}
var EMBED_STYLE_ID = "dsh-tip-jar-embed-css";
var EMBED_CSS = [
  ".sps-toolcard{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));border-radius:10px;background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.06));padding:10px 12px;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-primary,inherit)}",
  ".sps-tool-head{font-weight:600;margin-bottom:6px}",
  ".sps-tool-support{font-size:12px;color:var(--dsw-alias-label-secondary,inherit);border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.3));padding-top:6px}",
  ".sps-tool-support b{color:var(--dsw-alias-state-warn-primary,#d08700)}",
  ".sps-tip-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,inherit)}",
  ".sps-tip-alias{font-weight:600;color:var(--dsw-alias-label-primary,inherit)}",
  ".sps-tip-amount{color:var(--dsw-alias-state-success-primary,#22a06b);font-weight:600;font-variant-numeric:tabular-nums}",
  ".sps-badge-vol{font-size:10px;color:var(--dsw-alias-state-success-primary,#22a06b);border:1px solid var(--dsw-alias-state-success-primary,#22a06b);border-radius:10px;padding:0 6px}",
  ".sps-badge-pw{font-size:10px;color:var(--dsw-alias-state-error-primary,#c94a4a);border:1px solid var(--dsw-alias-state-error-primary,#c94a4a);border-radius:10px;padding:0 6px}",
  ".sps-badge-un{font-size:10px;color:var(--dsw-alias-label-secondary,inherit);border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));border-radius:10px;padding:0 6px}",
  ".sps-btn{background:none;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));border-radius:5px;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font-size:11px;padding:2px 8px;display:inline-flex;align-items:center;justify-content:center}",
  ".sps-btn:hover{color:var(--dsw-alias-label-primary,inherit);border-color:var(--dsw-alias-brand-primary,#4d6bfe)}",
  ".sps-qr{width:120px;height:120px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));border-radius:6px;object-fit:contain}",
  ".sps-qr-row{display:flex;align-items:center;gap:10px}",
  ".sps-links{display:flex;flex-wrap:wrap;gap:5px;align-items:center}",
  ".sps-links-block{margin-top:8px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l1,rgba(128,128,128,.35));display:flex;flex-direction:column;gap:4px}.sps-link{font-size:11px;color:var(--dsw-alias-brand-primary,#4d6bfe);text-decoration:none}",
  ".sps-link:hover{text-decoration:underline}",
  ".sps-label{font-size:10px;color:var(--dsw-alias-label-secondary,inherit);text-transform:uppercase;letter-spacing:.04em}",
  ".sps-pay-meta{display:flex;flex-direction:column;gap:2px}",
  ".sps-pay-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}",
  ".sps-qrcode-note{font-size:9px;color:var(--dsw-alias-label-secondary,inherit);line-height:1.3;margin-top:1px}"
].join("");
function ensureEmbedStyles(doc) {
  const d = doc ?? (typeof document === "undefined" ? null : document);
  if (!d || !d.head || typeof d.createElement !== "function") return false;
  if (typeof d.getElementById === "function" && d.getElementById(EMBED_STYLE_ID)) return false;
  const el = d.createElement("style");
  el.id = EMBED_STYLE_ID;
  el.textContent = EMBED_CSS;
  d.head.appendChild(el);
  return true;
}
var EMBED_CLASSES = [
  "sps-toolcard",
  "sps-tool-head",
  "sps-tool-support",
  "sps-tip-line",
  "sps-tip-alias",
  "sps-tip-amount",
  "sps-btn",
  "sps-qr",
  "sps-qr-row",
  "sps-links",
  "sps-links-block",
  "sps-link",
  "sps-label",
  "sps-pay-meta",
  "sps-pay-name",
  "sps-qrcode-note",
  "sps-badge-vol",
  "sps-badge-pw",
  "sps-badge-un"
];
function TipJarEmbed(props) {
  const api = createTipJarApi(props.ctx);
  const pluginId = props.pluginId;
  const [data, setData] = useState(null);
  const [tipState, setTipState] = useState({ stats: null });
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const h = createElement;
  useEffect(function() {
    ensureEmbedStyles();
    let alive = true;
    api.listSponsors().then(function(d) {
      if (alive && d) setData(d);
    }).catch(function(e) {
      if (!alive) return;
      const msg = e && e.message ? e.message : String(e);
      console.warn("[dsh-tip-jar] embed: listSponsors \u5931\u8D25\uFF08\u6253\u8D4F\u6761\u65E0\u6CD5\u663E\u793A\uFF09:", msg);
      setLoadError(msg);
    });
    api.tipStats().then(function(r) {
      if (alive && r) setTipState({ stats: r.stats });
    }).catch(function(e) {
      if (alive) console.warn("[dsh-tip-jar] embed: tipStats \u5931\u8D25\uFF08\u94FE\u4E0A\u7EDF\u8BA1\u6682\u7F3A\uFF09:", e && e.message ? e.message : e);
    });
    return function() {
      alive = false;
    };
  }, [api, pluginId]);
  useEffect(function() {
    let alive = true;
    const r = resolveEmbed(data, pluginId, null);
    const addr2 = r.status === "ok" && r.contributor && r.contributor.tips && typeof r.contributor.tips.usdc === "string" ? r.contributor.tips.usdc : "";
    if (!addr2) {
      setQrUrl(null);
      return function() {
        alive = false;
      };
    }
    api.qrPng(addr2).then(function(v) {
      if (alive && v && typeof v.dataUrl === "string") setQrUrl(v.dataUrl);
    }).catch(function() {
      if (alive) setQrUrl(null);
    });
    return function() {
      alive = false;
    };
  }, [api, data, pluginId]);
  const resolved = resolveEmbed(data, pluginId, tipState.stats);
  if (resolved.status === "loading") return h("div", { className: "sps-toolcard" }, loadError ? "\u{1F91D} \u652F\u6301\u4F5C\u8005\uFF08\u52A0\u8F7D\u5931\u8D25\uFF1A" + loadError + "\uFF09" : "\u{1F91D} \u652F\u6301\u4F5C\u8005\uFF08\u52A0\u8F7D\u4E2D\u2026\uFF09");
  if (resolved.status === "unregistered") return h("div", { className: "sps-toolcard sps-tip-line" }, "\u8BE5\u63D2\u4EF6\u672A\u5728\u8D5E\u52A9\u6CE8\u518C\u8868\u767B\u8BB0\uFF08sponsors.json\uFF09");
  if (resolved.status === "no-contributor") return h("div", { className: "sps-toolcard sps-tip-line" }, "\u8D21\u732E\u8005\u672A\u767B\u8BB0");
  const c = resolved.contributor;
  const plugin = resolved.plugin;
  const stat = resolved.stat;
  const eth = c.ethics || {};
  const ethicsBadge = eth.paidWall === true ? h("span", { className: "sps-badge-pw" }, "\u{1F534} \u4ED8\u8D39\u5899") : eth.voluntary === true ? h("span", { className: "sps-badge-vol" }, "\u{1F7E2} \u81EA\u613F\u6253\u8D4F") : h("span", { className: "sps-badge-un" }, "\u26AA \u672A\u786E\u8BA4");
  const channels = resolveChannels(c);
  const addr = channels.usdc;
  const copyBtn = addr ? h("button", {
    className: "sps-btn",
    title: copied ? "\u5DF2\u590D\u5236 \u2713" : "\u590D\u5236\u5730\u5740",
    onClick: function() {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(addr).catch(function() {
          });
        }
      } catch (e) {
      }
      setCopied(true);
      setTimeout(function() {
        setCopied(false);
      }, 1500);
    }
  }, copied ? "\u2713 \u5DF2\u590D\u5236" : "\u{1F4CB} \u590D\u5236\u5730\u5740") : null;
  const line = h(
    "div",
    { className: "sps-tool-support" },
    h("span", { className: "sps-tip-alias" }, "\u652F\u6301\u4F5C\u8005 @" + c.alias),
    ethicsBadge,
    copyBtn,
    stat ? h("span", { className: "sps-tip-amount" }, " \xB7 " + formatTipStats(stat)) : null
  );
  const qr = addr && qrUrl ? h(
    "div",
    { style: { display: "flex", justifyContent: "center", paddingTop: 6 } },
    h("img", { className: "sps-qr", src: qrUrl, alt: "USDC \u6536\u6B3E\u4E8C\u7EF4\u7801" })
  ) : null;
  const fiat = channels.fiat.length ? h(
    "div",
    { className: "sps-links" },
    h("span", { className: "sps-label" }, "\u6CD5\u5E01"),
    channels.fiat.map(function(f) {
      return h("a", { key: f.url, className: "sps-link", href: f.url, target: "_blank", rel: "noreferrer" }, f.label);
    })
  ) : null;
  const subs = channels.subscriptions.length ? h(
    "div",
    { className: "sps-links" },
    h("span", { className: "sps-label" }, "\u8BA2\u9605"),
    channels.subscriptions.map(function(s) {
      return h("a", { key: s.url, className: "sps-link", href: s.url, target: "_blank", rel: "noreferrer" }, s.label);
    })
  ) : null;
  const payQr = channels.qrCodes.map(function(q) {
    return h(
      "div",
      { key: q.label, className: "sps-qr-row", title: q.label + " \u6536\u6B3E\u7801\uFF08\u5E73\u53F0\u76F4\u4ED8\uFF09" },
      h("img", { className: "sps-qr", src: q.image, alt: q.label + " \u6536\u6B3E\u7801" }),
      h(
        "div",
        { className: "sps-pay-meta" },
        h("div", { className: "sps-pay-name" }, q.label),
        h("div", { className: "sps-qrcode-note" }, "\u626B\u7801\u76F4\u4ED8")
      )
    );
  });
  const none = channels.hasAny ? null : h("div", { className: "sps-tip-line" }, "\u8BE5\u8D21\u732E\u8005\u5C1A\u672A\u767B\u8BB0\u4EFB\u4F55\u6253\u8D4F\u65B9\u5F0F");
  return h(
    "div",
    { className: "sps-toolcard" },
    h("div", { className: "sps-tool-head" }, "\u{1F91D} " + (plugin.name || pluginId)),
    line,
    qr,
    payQr.length ? h("div", null, payQr) : null,
    fiat || subs ? h("div", { className: "sps-links-block" }, fiat, subs) : null,
    none
  );
}
function registerTipJarSlot(ctx, options) {
  const opts = options || {};
  const slot = opts.slot;
  if (typeof slot !== "string" || slot.length === 0) {
    throw new Error("registerTipJarSlot: options.slot is required");
  }
  const slots = ctx && ctx.slots;
  if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") {
    return function() {
    };
  }
  const id = typeof opts.id === "string" && opts.id.length > 0 ? opts.id : String(opts.pluginId || "plugin") + "-tipjar";
  const order = typeof opts.order === "number" ? opts.order : 80;
  return slots.inject(slot, function() {
    return slots.register(
      { name: slot, id, order },
      function() {
        return createElement(TipJarEmbed, { ctx, pluginId: opts.pluginId });
      }
    );
  });
}
export {
  EMBED_CLASSES,
  TipJarApi,
  TipJarEmbed,
  createTipJarApi,
  ensureEmbedStyles,
  registerTipJarSlot,
  resolveChannels,
  resolveEmbed
};
