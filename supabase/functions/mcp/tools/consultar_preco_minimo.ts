import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'
import { escapeIlikeWildcards } from './util.ts'

export function registerConsultarPrecoMinimoTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'consultar_preco_minimo',
    {
      description:
        'Consulta as regras de preço mínimo (simulation_minimum_price_rules) por SKU via campo versao (ILIKE). Retorna o preço bruto mínimo (precobruto) e a margem mínima em fração margem (0.25 = 25%). Se não encontrar nenhuma regra, retorna mensagem explícita ao invés de lista vazia.',
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
          .describe('Nome/SKU do produto a buscar (campo versao, ILIKE).'),
      }),
    },
    async (input) => {
      try {
        const sku = typeof input?.sku === 'string' ? input.sku.trim() : ''

        if (sku.length < 2) {
          return errorResult('O parâmetro "sku" é obrigatório e deve ter pelo menos 2 caracteres.')
        }

        const versaoLike = `%${escapeIlikeWildcards(sku)}%`

        const { data, error } = await supabase
          .from('simulation_minimum_price_rules')
          .select('*')
          .ilike('versao', versaoLike)
          .order('versao')
          .order('volume')
          .limit(60)

        if (error) throw error

        const results = data ?? []
        if (results.length === 0) {
          return jsonResult({
            mensagem: 'Nenhuma regra de preço mínimo encontrada para este SKU',
            sku_buscado: sku,
            resultados: [],
          })
        }

        return jsonResult(results)
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
