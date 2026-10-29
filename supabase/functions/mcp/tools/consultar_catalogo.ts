import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'
import { escapeIlikeWildcards } from './util.ts'

export function registerConsultarCatalogoTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'consultar_catalogo',
    {
      description:
        'Consulta o catálogo Brasil (catalog_br_prices) ou o catálogo LATAM (catalog_latam_prices) por SKU. Use o parâmetro mercado: "br" (padrão) ou "latam". No Brasil, retorna preço líquido (catalog_price), preço bruto (catalog_gross_price), custo (catalog_cost) e margem em fração catalog_margin (0.25 = 25%). No LATAM, retorna os campos nativos price_brl e price_usd, sem separar líquido/bruto. Não converta a margem; use a unidade conforme SERVER_INSTRUCTIONS.',
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
          .describe('Nome/SKU do produto a buscar no catálogo Brasil (ILIKE).'),
        volume: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Volume de referência opcional (ex: 1000, 1500, 3000, 5000). Se omitido, retorna todos os volumes encontrados.'),
        mercado: z
          .enum(['br', 'latam'])
          .optional()
          .describe('Mercado a consultar: "br" (padrão) para catalog_br_prices ou "latam" para catalog_latam_prices.'),
      }),
    },
    async (input: { sku?: unknown; volume?: unknown; mercado?: unknown }) => {
      try {
        const sku = typeof input?.sku === 'string' ? input.sku.trim() : ''
        const volume = typeof input?.volume === 'number' ? Number(input.volume) : null
        const mercado = input?.mercado === 'latam' ? 'latam' : 'br'

        if (sku.length < 2) {
          return errorResult('O parâmetro "sku" é obrigatório e deve ter pelo menos 2 caracteres.')
        }
        if (volume !== null && (!Number.isFinite(volume) || volume <= 0)) {
          return errorResult('O parâmetro "volume" deve ser um número inteiro positivo.')
        }

        const skuLike = `%${escapeIlikeWildcards(sku)}%`

        if (mercado === 'latam') {
          let query = supabase
            .from('catalog_latam_prices')
            .select('catalog_id, sku, category, volume, price_brl, price_usd, catalog_cost, catalog_margin')
            .ilike('sku', skuLike)

          if (volume !== null) {
            query = query.eq('volume', volume)
          }

          const { data, error } = await query
            .order('sku')
            .order('volume')
            .limit(20)

          if (error) throw error

          return jsonResult(data ?? [])
        }

        let query = supabase
          .from('catalog_br_prices')
          .select('*')
          .ilike('sku', skuLike)

        if (volume !== null) {
          query = query.eq('volume', volume)
        }

        const { data, error } = await query
          .order('sku')
          .order('volume')
          .limit(20)

        if (error) throw error

        return jsonResult(data ?? [])
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
