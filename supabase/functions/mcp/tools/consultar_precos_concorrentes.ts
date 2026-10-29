import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import {
  buildComparison,
  formatDelta,
  type ComparisonAttrs,
  type ComparisonMatch,
  type ComparisonRow,
} from './competitorComparison.ts'
import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'
import { escapeIlikeWildcards } from './util.ts'

type BatchRow = {
  id: string
  label: string
  quoted_from: string | null
  quoted_to: string | null
  is_current: boolean
}

type CatalogPriceRow = {
  sku: string | null
  volume: number | string | null
  catalog_gross_price: number | string | null
}

type CatalogAttrsRow = {
  pack_qty: number | string | null
  pack_unit: string | null
  pack_weight_g: number | string | null
}

type MapRow = {
  catalog_sku: string | null
  competitor: string | null
  competitor_sku: string | null
  match_level: string | null
  diff_reason: string | null
  note: string | null
}

type CompetitorPriceRow = {
  batch_id: string
  competitor: string | null
  competitor_sku: string | null
  pack_qty: number | string | null
  pack_unit: string | null
  pack_weight_g: number | string | null
  volume: number | string | null
  gross_price: number | string | null
  quoted_at: string | null
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeInteger(value: unknown): number | null {
  const number = normalizeNumber(value)
  if (number === null || !Number.isInteger(number)) return null
  return number
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

function normalizeAttrs(row: CatalogAttrsRow | CompetitorPriceRow | null | undefined): ComparisonAttrs {
  return {
    pack_qty: normalizeNumber(row?.pack_qty),
    pack_unit: normalizeText(row?.pack_unit),
    pack_weight_g: normalizeNumber(row?.pack_weight_g),
  }
}

function getMatchKey(competitor: string | null, competitorSku: string | null): string {
  return `${String(competitor || '').trim()}::${String(competitorSku || '').trim()}`
}

function buildBatchPayload(batch: BatchRow) {
  const range =
    batch.quoted_from && batch.quoted_to
      ? ` · cotações de ${batch.quoted_from} a ${batch.quoted_to}`
      : ''

  return {
    rotulo: batch.label,
    quoted_from: batch.quoted_from,
    quoted_to: batch.quoted_to,
    texto: `Lote ${batch.label}${range}`,
  }
}

function mapComparisonRow(row: ComparisonRow) {
  return {
    concorrente: row.competitor,
    sku_concorrente: row.competitor_sku,
    match_level: row.match_level,
    volume_cotado: row.quote?.volume ?? null,
    preco_bruto: row.quote?.gross_price ?? null,
    cotado_em: row.quote?.quoted_at ?? null,
    metrica_pro: row.mPro,
    metrica_concorrente: row.mConc,
    delta: row.delta,
    delta_texto: formatDelta(row.delta),
    fora_do_tier: row.outOfTier,
    idade: row.ageBadge,
    diff_reason: row.diff_reason,
    note: row.note,
  }
}

export function registerConsultarPrecosConcorrentesTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'consultar_precos_concorrentes',
    {
      description:
        'Consulta o comparativo de preços de concorrentes do Catálogo PRO para um SKU do catálogo Brasil. Usa o lote vigente, normaliza por R$/100g ou R$/unidade, retorna delta em fração e replica a síntese do popup de concorrentes.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        sku: z
          .string()
          .trim()
          .min(2)
          .describe('SKU ou trecho do SKU para buscar em catalog_br_prices.sku via ILIKE.'),
        volume: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Tier opcional. Se omitido, retorna o resumo de todos os tiers e as linhas detalhadas só do menor tier.'),
      }),
    },
    async (input: { sku?: unknown; volume?: unknown }) => {
      try {
        const sku = typeof input?.sku === 'string' ? input.sku.trim() : ''
        const requestedVolume = typeof input?.volume === 'number' ? Number(input.volume) : null

        if (sku.length < 2) {
          return errorResult('O parâmetro "sku" é obrigatório e deve ter pelo menos 2 caracteres.')
        }
        if (
          requestedVolume !== null &&
          (!Number.isFinite(requestedVolume) || requestedVolume <= 0 || !Number.isInteger(requestedVolume))
        ) {
          return errorResult('O parâmetro "volume" deve ser um número inteiro positivo.')
        }

        const skuLike = `%${escapeIlikeWildcards(sku)}%`

        const { data: skuRows, error: skuError } = await supabase
          .from('catalog_br_prices')
          .select('sku')
          .ilike('sku', skuLike)
          .order('sku')
          .limit(100)

        if (skuError) throw skuError

        const matchedSkus = Array.from(
          new Set(
            ((skuRows ?? []) as Array<{ sku: string | null }>)
              .map((row) => normalizeText(row.sku))
              .filter((value): value is string => value !== null)
          )
        )

        if (matchedSkus.length === 0) {
          return jsonResult({
            status: 'sku_nao_encontrado',
            mensagem: 'Nenhum SKU encontrado no catálogo Brasil para a busca informada.',
            sku_buscado: sku,
            skus: [],
          })
        }

        if (matchedSkus.length > 1) {
          return jsonResult({
            status: 'escolher_sku',
            mensagem: 'A busca encontrou mais de um SKU distinto. Escolha um SKU exato antes de comparar.',
            sku_buscado: sku,
            skus: matchedSkus,
          })
        }

        const resolvedSku = matchedSkus[0]

        const [pricesResult, attrsResult, batchResult, mapResult] = await Promise.all([
          supabase
            .from('catalog_br_prices')
            .select('sku, volume, catalog_gross_price')
            .eq('sku', resolvedSku)
            .order('volume', { ascending: true }),
          supabase
            .from('catalog_sku_attributes')
            .select('pack_qty, pack_unit, pack_weight_g')
            .eq('catalog_sku', resolvedSku)
            .maybeSingle(),
          supabase
            .from('competitor_import_batches')
            .select('id, label, quoted_from, quoted_to, is_current')
            .eq('is_current', true)
            .maybeSingle(),
          supabase
            .from('competitor_sku_map')
            .select('catalog_sku, competitor, competitor_sku, match_level, diff_reason, note')
            .eq('catalog_sku', resolvedSku)
            .order('competitor', { ascending: true })
            .order('competitor_sku', { ascending: true }),
        ])

        if (pricesResult.error) throw pricesResult.error
        if (attrsResult.error) throw attrsResult.error
        if (batchResult.error) throw batchResult.error
        if (mapResult.error) throw mapResult.error

        const priceRows = (pricesResult.data ?? []) as CatalogPriceRow[]
        const tiers = priceRows
          .map((row) => normalizeInteger(row.volume))
          .filter((value): value is number => value !== null)
          .sort((a, b) => a - b)

        const pricesByTier = priceRows.reduce<Record<number, number | null>>((acc, row) => {
          const volume = normalizeInteger(row.volume)
          if (volume !== null) {
            acc[volume] = normalizeNumber(row.catalog_gross_price)
          }
          return acc
        }, {})

        if (tiers.length === 0) {
          return jsonResult({
            status: 'sku_sem_preco',
            mensagem: 'O SKU encontrado não possui preços no catálogo Brasil.',
            sku_buscado: sku,
            sku: resolvedSku,
            skus: [resolvedSku],
          })
        }

        if (requestedVolume !== null && !tiers.includes(requestedVolume)) {
          return jsonResult({
            status: 'volume_nao_encontrado',
            mensagem: 'O volume solicitado não existe para este SKU no catálogo Brasil.',
            sku_buscado: sku,
            sku: resolvedSku,
            volume: requestedVolume,
            tiers_disponiveis: tiers,
          })
        }

        const proAttrs = attrsResult.data ? normalizeAttrs(attrsResult.data as CatalogAttrsRow) : null
        const batch = (batchResult.data as BatchRow | null) ?? null

        if (!batch) {
          return jsonResult({
            status: 'sem_lote',
            mensagem: 'Nenhum lote de cotações vigente.',
            sku_buscado: sku,
            sku: resolvedSku,
            tiers_disponiveis: tiers,
            precos_pro: tiers.map((tier) => ({
              volume: tier,
              preco_bruto_pro: pricesByTier[tier] ?? null,
            })),
            pro_attrs: proAttrs,
          })
        }

        const mapRows = (mapResult.data ?? []) as MapRow[]
        let competitorPrices: CompetitorPriceRow[] = []

        if (mapRows.length > 0) {
          const competitorSkus = Array.from(
            new Set(
              mapRows
                .map((row) => normalizeText(row.competitor_sku))
                .filter((value): value is string => value !== null)
            )
          )

          if (competitorSkus.length > 0) {
            const competitorPricesResult = await supabase
              .from('competitor_prices')
              .select(
                'batch_id, competitor, competitor_sku, pack_qty, pack_unit, pack_weight_g, volume, gross_price, quoted_at'
              )
              .eq('batch_id', batch.id)
              .in('competitor_sku', competitorSkus)
              .order('competitor', { ascending: true })
              .order('competitor_sku', { ascending: true })
              .order('volume', { ascending: true })

            if (competitorPricesResult.error) throw competitorPricesResult.error

            competitorPrices = (competitorPricesResult.data ?? []) as CompetitorPriceRow[]
          }
        }

        const quotesByMatch = new Map<string, Array<{ volume: number; gross_price: number; quoted_at: string | null }>>()
        const attrsByMatch = new Map<string, ComparisonAttrs>()

        for (const row of competitorPrices) {
          const competitor = normalizeText(row.competitor)
          const competitorSku = normalizeText(row.competitor_sku)
          if (!competitor || !competitorSku) continue

          const key = getMatchKey(competitor, competitorSku)
          if (!quotesByMatch.has(key)) quotesByMatch.set(key, [])
          if (!attrsByMatch.has(key)) attrsByMatch.set(key, normalizeAttrs(row))

          const volume = normalizeInteger(row.volume)
          const grossPrice = normalizeNumber(row.gross_price)
          if (volume === null || grossPrice === null) continue

          quotesByMatch.get(key)?.push({
            volume,
            gross_price: grossPrice,
            quoted_at: row.quoted_at ?? null,
          })
        }

        const matches: ComparisonMatch[] = mapRows.map((row) => {
          const competitor = normalizeText(row.competitor)
          const competitorSku = normalizeText(row.competitor_sku)
          const key = getMatchKey(competitor, competitorSku)

          return {
            competitor: competitor || '—',
            competitor_sku: competitorSku || '—',
            match_level:
              row.match_level === 'exato' || row.match_level === 'similar' || row.match_level === 'referencia'
                ? row.match_level
                : 'referencia',
            diff_reason: normalizeText(row.diff_reason),
            note: normalizeText(row.note),
            attrs: attrsByMatch.get(key) || {
              pack_qty: null,
              pack_unit: null,
              pack_weight_g: null,
            },
            quotes: quotesByMatch.get(key) || [],
          }
        })

        const detailTier = requestedVolume ?? tiers[0]
        const tiersToReturn = requestedVolume === null ? tiers : [detailTier]
        const today = new Date().toISOString()
        const batchPayload = buildBatchPayload(batch)

        const tierResults = tiersToReturn.map((tier) => {
          const comparison = buildComparison({
            tier,
            proPrice: pricesByTier[tier] ?? null,
            proAttrs,
            matches,
            today,
          })

          const includeRows = tier === detailTier
          const directRows = includeRows
            ? comparison.rows
                .filter((row) => row.match_level === 'exato' || row.match_level === 'similar')
                .map(mapComparisonRow)
            : []
          const referenceRows = includeRows
            ? comparison.rows
                .filter((row) => row.match_level === 'referencia')
                .map(mapComparisonRow)
            : []

          return {
            lote: batchPayload,
            sku: resolvedSku,
            volume: tier,
            preco_bruto_pro: pricesByTier[tier] ?? null,
            base: comparison.summary.preferredBasis,
            linhas_incluidas: includeRows,
            diretos: directRows,
            referencias: referenceRows,
            resumo: {
              n: comparison.summary.n,
              mediana: comparison.summary.median,
              mediana_equivalente_produto: comparison.summary.medianProductEquivalent,
              delta_vs_mediana: comparison.summary.deltaVsMedian,
              minimo: comparison.summary.min,
              concorrente_mais_barato: comparison.summary.cheapestCompetitor,
              delta_vs_minimo: comparison.summary.deltaVsMin,
              posicao: comparison.summary.position,
              total: comparison.summary.total,
            },
          }
        })

        return jsonResult({
          status: 'ok',
          mensagem:
            matches.length === 0
              ? 'Sem concorrente mapeado para este SKU.'
              : requestedVolume === null
                ? 'Volume omitido: retornando o resumo de todos os tiers e as linhas detalhadas só do menor tier.'
                : null,
          sku_buscado: sku,
          sku: resolvedSku,
          volume_solicitado: requestedVolume,
          volume_detalhado: detailTier,
          tiers_disponiveis: tiers,
          lote: batchPayload,
          pro_attrs: proAttrs,
          tiers: tierResults,
        })
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
