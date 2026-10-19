import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'

type PricingHistoryRow = {
  client_id: string
  code?: string | null
  date?: string | null
}

type ClienteRow = {
  id: string
  name: string
}

export function registerListarClientesExportacaoTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'listar_clientes_exportacao',
    {
      description:
        'Lista clientes da base com preço vigente em USD. Prospects ficam em consultar_propostas_precos.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_history')
          .select('client_id, code, date')
          .eq('currency', 'USD')
          .eq('is_current', true)

        if (error) throw error

        const rows = (data as PricingHistoryRow[] | null) ?? []

        const porCliente = new Map<string, { codes: Set<string>; ultimaData: string | null }>()
        for (const row of rows) {
          const clientId = row.client_id ? String(row.client_id) : ''
          if (!clientId) continue

          if (!porCliente.has(clientId)) {
            porCliente.set(clientId, { codes: new Set<string>(), ultimaData: null })
          }
          const grupo = porCliente.get(clientId)!

          const code = row.code ? String(row.code).trim() : ''
          if (code) grupo.codes.add(code)

          const date = row.date ? String(row.date) : ''
          if (date && (grupo.ultimaData === null || date > grupo.ultimaData)) {
            grupo.ultimaData = date
          }
        }

        if (porCliente.size === 0) {
          return jsonResult({
            mensagem: 'Nenhum cliente com preço vigente em USD',
            resultados: [],
          })
        }

        const clientIds = [...porCliente.keys()]
        const { data: clientesData, error: clientesError } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds)

        if (clientesError) throw clientesError

        const nomesPorId = new Map<string, string>()
        for (const cliente of (clientesData as ClienteRow[] | null) ?? []) {
          nomesPorId.set(String(cliente.id), cliente.name)
        }

        const resultados = clientIds.map((clientId) => {
          const grupo = porCliente.get(clientId)!
          return {
            client_id: clientId,
            nome: nomesPorId.get(clientId) ?? '',
            qtd_skus_vigentes_usd: grupo.codes.size,
            ultima_data_vigente: grupo.ultimaData,
          }
        })

        resultados.sort((a, b) => a.nome.localeCompare(b.nome))

        return jsonResult(resultados)
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
