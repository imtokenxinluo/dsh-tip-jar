// dsh-tip-jar/src/remote.js
// Typert Remote 描述：Host 与 Client 共享的 RPC 契约。
// 参照 dsh-ssh-ops 模式：本地构造 InvocationDescriptor（def 辅助 + zod 信封），
// 不依赖协议包的 def 导出（该包只导出 @Remote 装饰器与类型）。
import { z } from 'zod'

const PACKAGE = 'dsh-tip-jar'
const NS = 'tipJar'

const errorSchema = z.object({ code: z.string(), message: z.string() })
function okSchema(value) {
  return z.object({ ok: z.literal(true), value })
}
function resultSchema(value) {
  return z.union([
    okSchema(value),
    z.object({ ok: z.literal(false), error: errorSchema }),
  ])
}

const registryEntrySchema = z.record(z.any())
const registrySchema = z.object({
  schemaVersion: z.number().optional(),
  privacyNote: z.string().optional(),
  contributors: z.array(registryEntrySchema).default([]),
  plugins: z.array(registryEntrySchema).default([]),
})
const sponsorsLoadSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()).default([]),
  data: registrySchema.nullable(),
})

const statsEntrySchema = z.object({
  count: z.number(),
  amountUsdc: z.number(),
  supporters: z.number().default(0),
  fromSet: z.array(z.string()).default([]),
})

const tipStatsSchema = z.object({
  stats: z
    .object({
      byContributorId: z.record(statsEntrySchema).default({}),
      lastBlock: z.number().default(0),
    })
    .nullable(),
  present: z.boolean().default(false),
})

const saveTipStatsSchema = z.object({ saved: z.boolean() })

// 二维码由宿主本地生成（返回 data URL），不再请求第三方 CDN：
// 既不把收款地址交给外部服务，也不受其可用性影响。客户端只负责显示。
const qrPngSchema = z.object({ dataUrl: z.string() })

function def(method, requestSchema, requestType, resultSchema2, resultType) {
  return {
    id: PACKAGE + '#' + NS + '/' + method,
    service: NS,
    namespace: NS,
    method,
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        // dsh 0.2 的 typert-loader 要求 strict codec 提供 create() 工厂（返回带 parse() 的
        // schema）；旧的 schema 字段保留，便于 0.1.x 运行时继续识别。
        codec: {
          mode: 'strict',
          typeSymbol: PACKAGE + '/types#' + requestType,
          schema: requestSchema,
          create: () => requestSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: PACKAGE + '/types#' + resultType,
      schema: resultSchema2,
      create: () => resultSchema2,
    },
    sourceLocation: { file: 'src/index.js', line: 1, column: 1 },
  }
}

const DESCRIPTORS = [
  def(
    'listSponsors',
    z.object({}),
    'TipJarListSponsorsRequest',
    resultSchema(sponsorsLoadSchema),
    'TipJarListSponsorsResult',
  ),
  def(
    'tipStats',
    z.object({}),
    'TipJarTipStatsRequest',
    resultSchema(tipStatsSchema),
    'TipJarTipStatsResult',
  ),
  def(
    'saveTipStats',
    z.object({
      stats: z.object({
        byContributorId: z.record(statsEntrySchema).default({}),
        lastBlock: z.number().default(0),
      }),
    }),
    'TipJarSaveTipStatsRequest',
    resultSchema(saveTipStatsSchema),
    'TipJarSaveTipStatsResult',
  ),
  def(
    'qrPng',
    z.object({ text: z.string() }),
    'TipJarQrPngRequest',
    resultSchema(qrPngSchema),
    'TipJarQrPngResult',
  ),
]

export const TYPERT_REMOTE = { package: PACKAGE, descriptors: DESCRIPTORS }
export default TYPERT_REMOTE
