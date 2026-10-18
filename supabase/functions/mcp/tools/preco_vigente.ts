import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'
import type { PricingHistoryRow } from './vigencia.ts'
import { selecionarVigentes } from './vigencia.ts'

const DATASUL_CODE_REGEX = /^\d{4}\.\d{4}\.\d{4}$/

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

        const resultados = selecionarVigentes(rows)

        return jsonResult(resultados)
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
