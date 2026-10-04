import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'

export function registerConfirmarInsercaoPrecosTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'confirmar_insercao_precos',
    {
      description:
        'Grava em prices o lote previamente preparado. Use SOMENTE depois que o usuário confirmar explicitamente o preview no chat.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: false,
      },
      inputSchema: z.object({
        lote_id: z.string().uuid(),
      }),
    },
    async (input) => {
      try {
        const { data, error } = await supabase.rpc('mcp_confirmar_lote_precos', {
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
