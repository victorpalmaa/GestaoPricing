import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'
import { escapeIlikeWildcards } from './util.ts'
import { anexarRejeicoes, type RejeicaoRow } from './propostas.ts'

const PRICE_COLUMNS =
  'id, pricingid, cliente, sku, precoliquido, precobruto, margembruta, maco_pct, volume, status, mercado, preco_usd, ptax, origin_type, createdat'

type PriceRow = {
  id: string
  pricingid?: string | null
  cliente?: string | null
  sku?: string | null
  precoliquido?: unknown
  precobruto?: unknown
  margembruta?: unknown
  maco_pct?: unknown
  volume?: unknown
  status?: string | null
  mercado?: string | null
  preco_usd?: unknown
  ptax?: unknown
  origin_type?: string | null
  createdat?: string | null
}

export function registerConsultarPropostasPrecosTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'consultar_propostas_precos',
    {
      description:
        'Consulta as propostas de preço da /new-business (tabela prices), com filtros opcionais de cliente (ILIKE), mercado, status e limite. Retorna cada proposta com seus dados, incluindo as rejeições (motivo e data). status é a decisão do cliente; margembruta e maco_pct vêm em %. Em mercado exportacao, precoliquido e precobruto são o Preço BRL e o valor em dólar está em preco_usd com ptax.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        cliente: z
          .string()
          .trim()
          .min(2)
          .optional()
          .describe('Nome do cliente (campo cliente, ILIKE). Opcional.'),
        mercado: z
          .enum(['nacional', 'exportacao'])
          .optional()
          .describe('Mercado da proposta. Opcional: se omitido, retorna todos.'),
        status: z
          .enum(['em_aberto', 'aprovado', 'reprovado'])
          .optional()
          .describe('Status da proposta (decisão do cliente). Opcional: se omitido, retorna todos os status.'),
        limite: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(30)
          .describe('Quantidade máxima de propostas no retorno. Padrão 30, máximo 100.'),
      }),
    },
    async (input) => {
      try {
        const cliente = typeof input?.cliente === 'string' ? input.cliente.trim() : null
        const mercado = typeof input?.mercado === 'string' ? input.mercado.trim() : null
        const status = typeof input?.status === 'string' ? input.status.trim() : null
        const limite = typeof input?.limite === 'number' ? Number(input.limite) : 30

        if (cliente !== null && cliente.length < 2) {
          return errorResult('O parâmetro "cliente" deve ter pelo menos 2 caracteres.')
        }
        if (!Number.isFinite(limite) || limite < 1 || limite > 100) {
          return errorResult('O parâmetro "limite" deve ser um inteiro entre 1 e 100.')
        }

        let query = supabase.from('prices').select(PRICE_COLUMNS)

        if (cliente !== null) {
          query = query.ilike('cliente', `%${escapeIlikeWildcards(cliente)}%`)
        }
        if (mercado) {
          query = query.eq('mercado', mercado)
        }
        if (status) {
          query = query.eq('status', status)
        }

        const { data, error } = await query
          .order('createdat', { ascending: false })
          .limit(limite + 1)

        if (error) throw error

        const todas = (data as PriceRow[] | null) ?? []

        if (todas.length === 0) {
          return jsonResult({
            mensagem: 'Nenhuma proposta encontrada para os filtros informados',
            resultados: [],
          })
        }

        const truncado = todas.length > limite
        const rows = todas.slice(0, limite)

        const ids = rows.map((row) => row.id)
        let rejeicoes: RejeicaoRow[] = []
        if (ids.length > 0) {
          const { data: rejeicoesData, error: rejeicoesError } = await supabase
            .from('price_rejections')
            .select('price_id, motivo, created_at')
            .in('price_id', ids)

          if (rejeicoesError) throw rejeicoesError

          rejeicoes = (rejeicoesData as RejeicaoRow[] | null) ?? []
        }

        const comRejeicoes = anexarRejeicoes(rows, rejeicoes)

        const resultados = comRejeicoes.map((proposta) => ({
          pricingid: proposta.pricingid ?? null,
          cliente: proposta.cliente ?? null,
          sku: proposta.sku ?? null,
          precoliquido: proposta.precoliquido ?? null,
          precobruto: proposta.precobruto ?? null,
          margembruta: proposta.margembruta ?? null,
          maco_pct: proposta.maco_pct ?? null,
          volume: proposta.volume ?? null,
          status: proposta.status ?? null,
          mercado: proposta.mercado ?? null,
          preco_usd: proposta.preco_usd ?? null,
          ptax: proposta.ptax ?? null,
          origin_type: proposta.origin_type ?? null,
          criado_em: proposta.createdat ?? null,
          rejeicoes: proposta.rejeicoes,
        }))

        return jsonResult({ resultados, truncado })
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
