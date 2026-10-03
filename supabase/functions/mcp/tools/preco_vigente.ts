import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'

type PricingHistoryRow = {
  id: string
  client_id: string
  sku?: string | null
  code?: string | null
  date?: string | null
  month?: string | null
  currency?: string | null
  created_at?: string | null
  is_current?: boolean | null
  size?: string | null
  manager?: string | null
  net_price?: unknown
  gross_price?: unknown
  margin_budget?: unknown
  category?: string | null
  subcategory?: string | null
  obs?: string | null
  readjustment_status?: string | null
  last_price_date?: string | null
  gate?: string | null
}

const DATASUL_CODE_REGEX = /^\d{4}\.\d{4}\.\d{4}$/

function compareRowsByDateDesc(a: PricingHistoryRow, b: PricingHistoryRow): number {
  const aDate = a.date ? String(a.date) : ''
  const bDate = b.date ? String(b.date) : ''
  if (aDate < bDate) return 1
  if (aDate > bDate) return -1

  const aCreated = a.created_at ? String(a.created_at) : ''
  const bCreated = b.created_at ? String(b.created_at) : ''
  if (aCreated < bCreated) return 1
  if (aCreated > bCreated) return -1

  return String(b.id || '').localeCompare(String(a.id || ''))
}

export function registerPrecoVigenteTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'preco_vigente',
    {
      description:
        'Retorna o preço líquido e preço bruto vigentes (por SKU, Datasul code) de um cliente a partir do pricing_history. Use após obter o client_id. Retorna is_current=true quando o preço está marcado no banco; se não houver nenhum marcado, retorna o mais recente com vigencia_inferida=true.',
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
          .describe('Código Datasul (code) no formato 0000.0000.0000. Opcional: se omitido, retorna todos os codes do cliente.'),
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
          .from('pricing_history')
          .select('*')
          .eq('client_id', clientId)

        if (code) {
          query = query.eq('code', code)
        }

        const { data, error } = await query

        if (error) throw error

        const rows = (data as PricingHistoryRow[] | null) ?? []

        const byCode = new Map<string, PricingHistoryRow[]>()
        for (const row of rows) {
          const key = (row.code && String(row.code).trim() !== '')
            ? String(row.code).trim()
            : `__no_code__${String(row.id || '')}`
          if (!byCode.has(key)) byCode.set(key, [])
          byCode.get(key)!.push(row)
        }

        const resultados: Array<PricingHistoryRow & { vigencia_inferida: boolean }> = []

        for (const groupRows of byCode.values()) {
          const flaggedCurrent = groupRows.find(r => Boolean(r.is_current))
          if (flaggedCurrent) {
            resultados.push({ ...flaggedCurrent, vigencia_inferida: false })
            continue
          }

          const sorted = [...groupRows].sort(compareRowsByDateDesc)
          if (sorted[0]) {
            resultados.push({ ...sorted[0], vigencia_inferida: true })
          }
        }

        return jsonResult(resultados)
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
