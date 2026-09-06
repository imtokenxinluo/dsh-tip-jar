// dsh-tip-jar/src/validate.js
// sponsors.json 注册表校验：结构、USDC 地址格式、URL、引用完整性、重复 id
//（与 dsh-sponsors/validate.js 同规则，ESM 版）

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/
const URL_RE = /^https?:\/\/\S+$/

function isStr(v) { return typeof v === 'string' && v.trim().length > 0 }
function isArr(v) { return Array.isArray(v) }
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }

function checkLink(errors, prefix, item) {
  if (!isObj(item) || !isStr(item.label) || !isStr(item.url) || !URL_RE.test(item.url)) {
    errors.push(prefix + ' 需要 {label, url(https://…)}')
  }
}

export function validateRegistry(input) {
  const errors = []
  const warnings = []
  if (!isObj(input)) {
    return { ok: false, errors: ['注册表必须是 JSON 对象'], warnings }
  }
  if (input.schemaVersion !== 1) {
    errors.push('schemaVersion 必须为 1')
  }

  // 允许空 contributors：打赏罐是工具，初始/过渡状态无贡献者是合法状态（页面显示空态）
  if (!isArr(input.contributors)) {
    errors.push('contributors 必须是数组')
  } else {
    const seen = new Set()
    input.contributors.forEach(function (c, i) {
      const p = 'contributors[' + i + ']'
      if (!isObj(c)) { errors.push(p + ' 必须是对象'); return }
      if (!isStr(c.id)) errors.push(p + '.id 缺失')
      else if (seen.has(c.id)) errors.push(p + '.id 重复: ' + c.id)
      else seen.add(c.id)
      if (!isStr(c.alias)) errors.push(p + '.alias 缺失（化名是隐私默认）')
      if (typeof c.verified !== 'boolean') errors.push(p + '.verified 必须是布尔值')
      if (!isObj(c.tips)) errors.push(p + '.tips 缺失')
      else {
        if (c.tips.usdc !== undefined && c.tips.usdc !== null && !ADDR_RE.test(c.tips.usdc)) {
          errors.push(p + '.tips.usdc 地址格式无效: ' + c.tips.usdc)
        }
        if (c.tips.fiat !== undefined) {
          if (!isArr(c.tips.fiat)) errors.push(p + '.tips.fiat 必须是数组')
          else c.tips.fiat.forEach(function (f, j) {
            checkLink(errors, p + '.tips.fiat[' + j + ']', f)
          })
        }
        // 收款码图片（微信/支付宝/数币等）：{label, image} — 平台直付，无链上追踪
        if (c.tips.qrCodes !== undefined) {
          if (!isArr(c.tips.qrCodes)) errors.push(p + '.tips.qrCodes 必须是数组')
          else c.tips.qrCodes.forEach(function (q, j) {
            const qp = p + '.tips.qrCodes[' + j + ']'
            if (!isObj(q)) { errors.push(qp + ' 必须是对象'); return }
            if (!isStr(q.label) || !q.label.trim()) errors.push(qp + '.label 缺失（如 微信/支付宝）')
            if (!isStr(q.image) || !q.image.trim()) errors.push(qp + '.image 缺失（收款码图片 URL 或路径）')
          })
        }
      }
      if (c.subscriptions !== undefined) {
        if (!isArr(c.subscriptions)) errors.push(p + '.subscriptions 必须是数组')
        else c.subscriptions.forEach(function (s, j) {
          checkLink(errors, p + '.subscriptions[' + j + ']', s)
        })
      }
      // 自愿打赏伦理声明（dsh-sponsor-ethics）
      if (c.ethics !== undefined) {
        if (!isObj(c.ethics)) {
          errors.push(p + '.ethics 必须是对象')
        } else {
          if (c.ethics.voluntary !== undefined && typeof c.ethics.voluntary !== 'boolean') {
            errors.push(p + '.ethics.voluntary 必须是布尔值')
          }
          if (c.ethics.paidWall !== undefined && typeof c.ethics.paidWall !== 'boolean') {
            errors.push(p + '.ethics.paidWall 必须是布尔值')
          }
          if (c.ethics.paidWall === true) {
            warnings.push(p + '.ethics.paidWall=true：该贡献者声明存在付费墙，违反自愿打赏伦理规范')
          }
        }
      }
    })
  }

  if (!isArr(input.plugins)) {
    errors.push('plugins 必须是数组')
  } else {
    const contributorIds = new Set()
    ;(input.contributors || []).forEach(function (c) { if (isObj(c) && isStr(c.id)) contributorIds.add(c.id) })
    const pluginSeen = new Set()
    input.plugins.forEach(function (p, i) {
      const pp = 'plugins[' + i + ']'
      if (!isObj(p)) { errors.push(pp + ' 必须是对象'); return }
      if (!isStr(p.pluginId)) errors.push(pp + '.pluginId 缺失')
      else if (pluginSeen.has(p.pluginId)) errors.push(pp + '.pluginId 重复: ' + p.pluginId)
      else pluginSeen.add(p.pluginId)
      if (!isStr(p.contributorId)) errors.push(pp + '.contributorId 缺失')
      else if (!contributorIds.has(p.contributorId)) errors.push(pp + '.contributorId 未知: ' + p.contributorId)
      if (p.sponsors !== undefined) {
        if (!isArr(p.sponsors)) errors.push(pp + '.sponsors 必须是数组')
        else p.sponsors.forEach(function (s, j) {
          const sp = pp + '.sponsors[' + j + ']'
          if (!isObj(s) || !isStr(s.name) || !isStr(s.message) || !isStr(s.url) || !URL_RE.test(s.url)) {
            errors.push(sp + ' 需要 {name, message, url(https://…)}')
          }
        })
      }
      // 防抄袭来源声明：fork/引用其他开源项目时必须声明 upstream（R2 / §5.4）
      if (p.upstream !== undefined) {
        if (!isObj(p.upstream)) {
          errors.push(pp + '.upstream 必须是对象')
        } else {
          if (!isStr(p.upstream.repo) || !URL_RE.test(p.upstream.repo)) {
            errors.push(pp + '.upstream.repo 必须是 http(s) URL（上游仓库）')
          }
          if (!isStr(p.upstream.author)) {
            errors.push(pp + '.upstream.author 缺失（上游作者）')
          }
          if (p.upstream.license !== undefined && !isStr(p.upstream.license)) {
            errors.push(pp + '.upstream.license 必须是字符串')
          }
        }
      }
    })
  }

  return { ok: errors.length === 0, errors, warnings }
}
