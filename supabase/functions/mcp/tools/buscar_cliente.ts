import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'
import { escapeIlikeWildcards } from './util.ts'

export function registerBuscarClienteTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'buscar_cliente',
    {
      description:
        'Busca clientes do Portal de Pricing pelo nome ou por apelido (alias). Use antes de qualquer consulta de preço para obter o client_id.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        termo: z
          .string()
          .trim()
          .min(2)
          .describe('Nome do cliente ou apelido (alias) para buscar.'),
      }),
    },
    async (input) => {
      try {
        const termo = typeof input?.termo === 'string' ? input.termo.trim() : ''

        if (termo.length < 2) {
          return errorResult(
            'O parâmetro "termo" é obrigatório e deve ter pelo menos 2 caracteres.'
          )
        }

        const termoLike = `%${escapeIlikeWildcards(termo)}%`

        const { data: matchClients, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .ilike('name', termoLike)
          .order('name')
          .limit(10)

        if (clientsError) throw clientsError

        const { data: matchAliases, error: aliasesError } = await supabase
          .from('client_aliases')
          .select('id, client_id, alias_name, clients!inner(id, name)')
          .ilike('alias_name', termoLike)
          .order('alias_name')
          .limit(10)

        if (aliasesError) throw aliasesError

        const seen = new Set<string>()
        const resultados: Array<{
          client_id: string
          nome: string
          alias: string | null
        }> = []

        for (const c of matchClients ?? []) {
          if (!seen.has(c.id)) {
            seen.add(c.id)
            resultados.push({
              client_id: c.id,
              nome: c.name,
              alias: null,
            })
          }
        }

        for (const a of matchAliases ?? []) {
          const clientId =
            a.client_id ??
            (a.clients && typeof a.clients === 'object' && 'id' in a.clients
              ? String((a.clients as { id: unknown }).id)
              : null)
          const clientName =
            a.clients && typeof a.clients === 'object' && 'name' in a.clients
              ? String((a.clients as { name: unknown }).name)
              : null

          if (!clientId) continue

          if (!seen.has(clientId)) {
            seen.add(clientId)
            resultados.push({
              client_id: clientId,
              nome: clientName ?? '',
              alias: a.alias_name,
            })
          }
        }

        return jsonResult(resultados.slice(0, 10))
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
