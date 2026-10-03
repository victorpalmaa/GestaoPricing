import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'

const DATASUL_CODE_REGEX = /^\d{4}\.\d{4}\.\d{4}$/

export function registerHistoricoPrecosTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'historico_precos',
    {
      description:
        'Retorna o histórico de preços líquidos e brutos de um SKU/code para um cliente a partir do pricing_history. Ordenado por mês/date decrescente. Use após obter o client_id. Inclui is_current em cada linha para indicar qual é o vigente atualmente.',
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
          .describe('Código Datasul (code) no formato 0000.0000.0000. Obrigatório.'),
        limite: z
          .number()
          .int()
          .min(1)
          .max(60)
          .default(24)
          .describe('Quantidade máxima de linhas no histórico. Padrão 24, máximo 60.'),
      }),
    },
    async (input) => {
      try {
        const clientId = typeof input?.client_id === 'string' ? input.client_id.trim() : ''
        const code = typeof input?.code === 'string' ? input.code.trim() : ''
        const limite = typeof input?.limite === 'number' ? Number(input.limite) : 24

        if (!clientId) {
          return errorResult('O parâmetro "client_id" (uuid) é obrigatório.')
        }
        if (!DATASUL_CODE_REGEX.test(code)) {
          return errorResult('O parâmetro "code" (formato 0000.0000.0000) é obrigatório.')
        }
        if (!Number.isFinite(limite) || limite < 1 || limite > 60) {
          return errorResult('O parâmetro "limite" deve ser um inteiro entre 1 e 60.')
        }

        const { data, error } = await supabase
          .from('pricing_history')
          .select('*')
          .eq('client_id', clientId)
          .eq('code', code)
          .order('date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(limite)

        if (error) throw error

        return jsonResult(data ?? [])
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
