// dsh-tip-jar/src/qr.js
// 宿主侧二维码生成：把文本（收款地址等）渲染成 data URL。
//
// 为什么单独一个模块：在服务方法里内联"带缓存的一行"是没法测的，而"地址画不出码"
// 恰好是打赏链路最关键的失败点 —— 用户看不到码就等于收不到钱。抽出来后可红绿测试。
//
// 依赖：qrcode（package.json 的 dependencies）。懒加载，只有真要画码时才引入。
export const MAX_TEXT_LENGTH = 512

/** 输入校验（纯函数）：空、超长都要在生成前拦掉。 */
export function validateQrText(input) {
  const text = typeof input === 'string' ? input.trim() : ''
  if (!text) return { ok: false, reason: 'text is required' }
  if (text.length > MAX_TEXT_LENGTH) return { ok: false, reason: 'text too long (max ' + MAX_TEXT_LENGTH + ')' }
  return { ok: true, text }
}

/**
 * 生成二维码 data URL。
 * @param {string} input 要编码的文本
 * @param {{width?: number}} [options]
 * @returns {Promise<string>} data:image/png;base64,…（PNG，浏览器可直接当 img src）
 */
export async function renderQrDataUrl(input, options = {}) {
  const check = validateQrText(input)
  if (!check.ok) throw new Error(check.reason)
  const mod = await import('qrcode')
  const QRCode = mod && mod.default ? mod.default : mod
  if (!QRCode || typeof QRCode.toDataURL !== 'function') {
    throw new Error('qrcode 模块不可用（toDataURL 缺失）')
  }
  return QRCode.toDataURL(check.text, {
    width: options.width || 220,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}
