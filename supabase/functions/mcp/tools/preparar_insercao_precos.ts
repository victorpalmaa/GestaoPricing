import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.2'

import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'

const MERCADOS = ['nacional', 'exportacao'] as const
const ORIGIN_TYPES = ['novo_cliente', 'novo_sku'] as const
const CATEGORIAS = [
  'Pó',
  'Gel',
  'Goma',
  'Cápsula',
  'Pastilha',
  'Softgel',
] as const
const SUBCATEGORIAS = [
  'Goma',
  'Cápsula',
  'Colágeno',
  'Creatina',
  'Gel',
  'Glutamina',
  'Outros',
  'Pastilha',
  'Proteína',
] as const

const LinhaLoteSchema = z.object({
  idversao: z.union([z.number(), z.string()]).optional(),
  id: z.string(),
  versao: z.string(),
  margemcontribuicao: z.number().nullable(),
  margem: z.number(),
  coluna_h: z.number(),
  coluna_i: z.number(),
  categoria: z.enum(CATEGORIAS),
  subcategoria: z.enum(SUBCATEGORIAS),
})

export function registerPrepararInsercaoPrecosTool(
  server: McpServer,
  { supabase }: ToolContext
): void {
  server.registerTool(
    'preparar_insercao_precos',
    {
      description:
        "Valida e prepara a inserção de preços aprovados a partir do arquivo 'Aprovado ... - CLIENTE.xlsx'. NÃO grava em prices: cria um lote pendente e devolve o preview. Envie os valores das células exatamente como estão no arquivo, sem converter. Depois de chamar, mostre o preview ao usuário e aguarde confirmação explícita.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: false,
      },
      inputSchema: z.object({
        arquivo_nome: z.string(),
        cliente: z.string().trim().min(2),
        mercado: z.enum(MERCADOS),
        origin_type: z.enum(ORIGIN_TYPES),
        ptax: z.number().positive().optional(),
        aprovador: z.string().optional(),
        linhas: z.array(LinhaLoteSchema).min(1).max(100),
      }),
    },
    async (input) => {
      try {
        const { data, error } = await supabase.rpc('mcp_preparar_lote_precos', {
          p_arquivo_nome: input.arquivo_nome,
          p_cliente: input.cliente,
          p_mercado: input.mercado,
          p_origin_type: input.origin_type,
          p_ptax: input.ptax ?? null,
          p_aprovador: input.aprovador ?? null,
          p_linhas: input.linhas as unknown,
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
