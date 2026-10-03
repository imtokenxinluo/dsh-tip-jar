// dsh-tip-jar/src/typert.js
// Host 侧 Typert 贡献（./typert 导出）：typert-loader 导入它注册进 ctx.typert，
// 从而暴露 /api/tipJar/<method> 路由。invocations 复用 remote.js 的描述符。
import { TYPERT_REMOTE } from './remote.js'

const TYPERT = {
  package: 'dsh-tip-jar',
  face: 'host',
  schemas: [],
  invocations: TYPERT_REMOTE.descriptors,
  model: {
    events: [],
    objects: [],
    services: [
      {
        key: 'tipJar',
        exportName: 'TipJarService',
        description: 'Contributor tip jar registry: read and validate sponsors.json, expose sponsor channels to the client.',
        summary: 'Tip jar sponsor registry (USDC / fiat / subscription / sponsor slots).',
        tags: [],
        jsDoc: '/** Contributor tip jar registry. */',
        members: [
          {
            kind: 'method',
            name: 'listSponsors',
            signature: 'async listSponsors(request: TipJarListSponsorsRequest): Promise<TipJarListSponsorsResult>',
          },
          {
            kind: 'method',
            name: 'tipStats',
            signature: 'async tipStats(request: TipJarTipStatsRequest): Promise<TipJarTipStatsResult>',
          },
          {
            kind: 'method',
            name: 'saveTipStats',
            signature: 'async saveTipStats(request: TipJarSaveTipStatsRequest): Promise<TipJarSaveTipStatsResult>',
          },
          {
            kind: 'method',
            name: 'qrPng',
            signature: 'async qrPng(request: TipJarQrPngRequest): Promise<TipJarQrPngResult>',
          },
        ],
        types: [
          {
            name: 'TipJarListSponsorsRequest',
            declaration: 'export interface TipJarListSponsorsRequest {}',
          },
          {
            name: 'TipJarListSponsorsResult',
            declaration: 'export type TipJarListSponsorsResult = TipJarResult<{ ok: boolean; errors: string[]; data: TipJarRegistry | null }>',
          },
          {
            name: 'TipJarTipStatsRequest',
            declaration: 'export interface TipJarTipStatsRequest {}',
          },
          {
            name: 'TipJarTipStatsResult',
            declaration: 'export type TipJarTipStatsResult = TipJarResult<{ stats: TipJarStats | null; present: boolean }>',
          },
          {
            name: 'TipJarSaveTipStatsRequest',
            declaration: 'export interface TipJarSaveTipStatsRequest { readonly stats: TipJarStats }',
          },
          {
            name: 'TipJarSaveTipStatsResult',
            declaration: 'export type TipJarSaveTipStatsResult = TipJarResult<{ saved: boolean }>',
          },
          {
            name: 'TipJarQrPngRequest',
            declaration: 'export interface TipJarQrPngRequest { readonly text: string }',
          },
          {
            name: 'TipJarQrPngResult',
            declaration: 'export type TipJarQrPngResult = TipJarResult<{ dataUrl: string }>',
          },
        ],
      },
    ],
  },
}

export { TYPERT, TYPERT as default }
