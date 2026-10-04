import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'

export function registerCancelarLotePrecosTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'cancelar_lote_precos',
    {
      description:
        'Cancela um lote de preços preparado mas ainda não confirmado. Use quando o usuário pedir ajustes após o preview.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        lote_id: z.string().uuid(),
      }),
    },
    async (input) => {
      try {
        const { data, error } = await supabase.rpc('mcp_cancelar_lote_precos', {
          p_lote_id: input.lote_id,
        })

        if (error) {
          return errorResult(error.message || String(error))
        }

        return jsonResult(data)
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
