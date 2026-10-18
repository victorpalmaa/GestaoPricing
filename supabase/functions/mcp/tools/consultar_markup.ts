import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'
import type { PricingHistoryRow, VigenciaResult } from './vigencia.ts'
import { selecionarVigentes } from './vigencia.ts'
import { calcularMarkup } from './markup.ts'

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

type MarkupItem = {
  code: string
  sku: string | null
  preco_bruto_vigente: number | string | null
  moeda: string | null
  vigente_desde: string | null
  vigencia_inferida: boolean | null
  preco_ponta: number | string | null
  moeda_ponta: string | null
  data_coleta: string | null
  markup: number | null
  markup_texto: string | null
  status: string
  mensagem?: string
}

const LIMITE_ITENS = 200

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

export function registerConsultarMarkupTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'consultar_markup',
    {
      description:
        'Consulta o markup de ponta (retail_price / preço bruto vigente) por code, combinando pricing_history e client_retail_prices. Use após obter o client_id. Retorna todos os codes vigentes do cliente; quando não há coleta de ponta, o item vem com status sem_ponta. Markup só é calculado quando o preço bruto está oficialmente vigente (is_current=true); preços inferidos por data retornam status preco_nao_vigente.',
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
          .describe('Código Datasul (code) no formato 0000.0000.0000. Opcional: se omitido, retorna todos os codes vigentes do cliente.'),
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

        let historyQuery = supabase
          .from('pricing_history')
          .select('id, code, sku, gross_price, currency, date, created_at, is_current')
          .eq('client_id', clientId)

        let retailQuery = supabase
          .from('client_retail_prices')
          .select('id, client_id, datasul_code, nome_site, retail_price, currency, collected_at, source, created_at')
          .eq('client_id', clientId)

        if (code) {
          historyQuery = historyQuery.eq('code', code)
          retailQuery = retailQuery.eq('datasul_code', code)
        }

        const [historyRes, retailRes] = await Promise.all([historyQuery, retailQuery])

        if (historyRes.error) throw historyRes.error
        if (retailRes.error) throw retailRes.error

        const historyRows = (historyRes.data as PricingHistoryRow[] | null) ?? []
        const retailRows = (retailRes.data as ClientRetailPriceRow[] | null) ?? []

        const vigentesPorCode = new Map<string, VigenciaResult>()
        for (const vigente of selecionarVigentes(historyRows)) {
          const key = vigente.code ? String(vigente.code).trim() : ''
          if (key) vigentesPorCode.set(key, vigente)
        }

        const pontasPorCode = new Map<string, ClientRetailPriceRow>()
        for (const ponta of selecionarPontaMaisRecente(retailRows)) {
          const key = String(ponta.datasul_code || '').trim()
          if (key) pontasPorCode.set(key, ponta)
        }

        // União dos codes vigentes (pricing_history) e dos codes com coleta
        // (client_retail_prices). Codes vigentes sem coleta entram com sem_ponta.
        const codesOrdenados: string[] = []
        const vistos = new Set<string>()
        for (const key of vigentesPorCode.keys()) {
          if (!vistos.has(key)) {
            vistos.add(key)
            codesOrdenados.push(key)
          }
        }
        for (const key of pontasPorCode.keys()) {
          if (!vistos.has(key)) {
            vistos.add(key)
            codesOrdenados.push(key)
          }
        }

        if (codesOrdenados.length === 0) {
          return jsonResult({
            mensagem: 'Nenhum preço vigente nem coleta de ponta encontrados para este cliente',
            resultados: [],
          })
        }

        const itens: MarkupItem[] = codesOrdenados.map((codeKey) => {
          const vigente = vigentesPorCode.get(codeKey)
          const ponta = pontasPorCode.get(codeKey)

          const item: MarkupItem = {
            code: codeKey,
            sku: vigente?.sku ?? null,
            preco_bruto_vigente: vigente ? (vigente.gross_price as number | string | null) ?? null : null,
            moeda: vigente?.currency ?? null,
            vigente_desde: vigente?.date ?? null,
            vigencia_inferida: vigente ? vigente.vigencia_inferida : null,
            preco_ponta: ponta ? ponta.retail_price : null,
            moeda_ponta: ponta?.currency ?? null,
            data_coleta: ponta?.collected_at ?? null,
            markup: null,
            markup_texto: null,
            status: 'sem_preco_vigente',
          }

          if (!vigente) {
            return item
          }

          const resultado = calcularMarkup({
            precoBruto: vigente.gross_price as number | string | null,
            moedaBruto: vigente.currency,
            precoPonta: ponta ? ponta.retail_price : null,
            moedaPonta: ponta?.currency ?? null,
            vigenciaInferida: vigente.vigencia_inferida,
          })

          item.markup = resultado.markup
          item.markup_texto = resultado.markup_texto
          item.status = resultado.status

          if (resultado.status === 'preco_nao_vigente') {
            item.mensagem = 'Preço não vigente: markup não calculado'
          }

          return item
        })

        if (itens.length > LIMITE_ITENS) {
          return jsonResult({
            resultados: itens.slice(0, LIMITE_ITENS),
            truncado: true,
          })
        }

        return jsonResult({ resultados: itens, truncado: false })
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
