import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'

const DATASUL_CODE_REGEX = /^\d{4}\.\d{4}\.\d{4}$/

type ClientRetailPriceRow = {
  id: string
  client_id: string
  datasul_code: string
  nome_site: string
  retail_price: number | string
  currency: string
  collected_at: string
  source?: string | null
  created_at?: string | null
}

type PontaResult = {
  code: string
  nome_site: string
  preco_ponta: number | string
  moeda: string
  data_coleta: string
  fonte: string | null
}

function compareCollectedDesc(a: ClientRetailPriceRow, b: ClientRetailPriceRow): number {
  const aCollected = a.collected_at ? String(a.collected_at) : ''
  const bCollected = b.collected_at ? String(b.collected_at) : ''
  if (aCollected < bCollected) return 1
  if (aCollected > bCollected) return -1

  const aCreated = a.created_at ? String(a.created_at) : ''
  const bCreated = b.created_at ? String(b.created_at) : ''
  if (aCreated < bCreated) return 1
  if (aCreated > bCreated) return -1

  return 0
}

/**
 * Mantém, por datasul_code, apenas a coleta mais recente (collected_at, desempate created_at desc).
 */
function selecionarPontaMaisRecente(rows: readonly ClientRetailPriceRow[]): ClientRetailPriceRow[] {
  const byCode = new Map<string, ClientRetailPriceRow[]>()
  for (const row of rows) {
    const key = String(row.datasul_code || '').trim()
    if (!byCode.has(key)) byCode.set(key, [])
    byCode.get(key)!.push(row)
  }

  const selecionadas: ClientRetailPriceRow[] = []
  for (const group of byCode.values()) {
    const sorted = [...group].sort(compareCollectedDesc)
    if (sorted[0]) selecionadas.push(sorted[0])
  }
  return selecionadas
}

export function registerConsultarPrecoPontaTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'consultar_preco_ponta',
    {
      description:
        'Consulta os preços de ponta coletados (client_retail_prices) de um cliente, retornando a coleta mais recente por datasul_code. Use após obter o client_id.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        client_id: z.string().uuid().describe('ID do cliente (clients.id).'),
        code: z
          .string()
          .trim()
          .regex(DATASUL_CODE_REGEX, 'Formato do code deve ser 0000.0000.0000')
          .optional()
          .describe('Código Datasul (datasul_code) no formato 0000.0000.0000. Opcional: se omitido, retorna todos os codes do cliente.'),
      }),
    },
    async (input) => {
      try {
        const clientId = typeof input?.client_id === 'string' ? input.client_id.trim() : ''
        const code = typeof input?.code === 'string' ? input.code.trim() : null

        if (!clientId) {
          return errorResult('O parâmetro "client_id" (uuid) é obrigatório.')
        }
        if (code && !DATASUL_CODE_REGEX.test(code)) {
          return errorResult('O parâmetro "code" deve estar no formato 0000.0000.0000.')
        }

        let query = supabase
          .from('client_retail_prices')
          .select('id, client_id, datasul_code, nome_site, retail_price, currency, collected_at, source, created_at')
          .eq('client_id', clientId)

        if (code) {
          query = query.eq('datasul_code', code)
        }

        const { data, error } = await query

        if (error) throw error

        const rows = (data as ClientRetailPriceRow[] | null) ?? []

        if (rows.length === 0) {
          return jsonResult({
            mensagem: 'Nenhuma coleta de preço de ponta encontrada',
            resultados: [],
          })
        }

        const selecionadas = selecionarPontaMaisRecente(rows)

        const resultados: PontaResult[] = selecionadas.map((row) => ({
          code: String(row.datasul_code || '').trim(),
          nome_site: row.nome_site,
          preco_ponta: row.retail_price,
          moeda: row.currency,
          data_coleta: row.collected_at,
          fonte: row.source ?? null,
        }))

        return jsonResult(resultados)
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
