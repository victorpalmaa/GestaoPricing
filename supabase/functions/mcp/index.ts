import 'jsr:@supabase/functions-js@2.108.2/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { pipeline } from 'npm:@supabase/middleware@1'
import {
  withOAuthProtectedResource,
  withSupabase,
  type SupabaseContext,
} from 'npm:@supabase/server@1'

import { registerTools, type ToolContext } from './tools/index.ts'

// An MCP server as a single Supabase Edge Function, composed as a pipeline:
//
//   withOAuthProtectedResource  OAuth discovery for external MCP clients. Runs
//                               before the auth gate so unauthenticated clients
//                               can fetch the RFC 9728 metadata, and adds the
//                               WWW-Authenticate challenge to the gate's 401.
//   withSupabase                Verifies the user access token and builds an
//                               RLS-scoped client, so both embedded product
//                               agents and external OAuth clients act as the
//                               signed-in user.
//   handleMcp                   MCP transport and tools (./tools/index.ts).
//
// On Supabase Edge Functions the public URLs in the OAuth metadata are derived
// automatically, locally and hosted. Off Edge Functions, pass `resourceServer`
// and `authorizationServer` to withOAuthProtectedResource.

function readTextEnv(name: string, fallback: string): string {
  return Deno.env.get(name)?.trim() || fallback
}

const SERVER_NAME = readTextEnv('MCP_SERVER_NAME', 'supabase-mcp')
const SERVER_DESCRIPTION = readTextEnv(
  'MCP_SERVER_DESCRIPTION',
  'MCP access to this Supabase project for the signed-in user.'
)

const SERVER_INSTRUCTIONS = `Servidor do Portal de Pricing da Pronutrition. Cada ferramenta roda como o usuário logado e respeita as permissões da área dele.
Fluxo: use buscar_cliente para obter o client_id antes de consultar preços.
Mapeamento de campos:
- Preço bruto: gross_price (pricing_history), catalog_gross_price (catálogo), precobruto (preço mínimo)
- Preço líquido: net_price (pricing_history), catalog_price (catálogo)
- Margem bruta, ATENÇÃO À UNIDADE:
  margin_budget (pricing_history) vem em % (39.5 = 39,5%);
  catalog_margin (catálogo) e margem (preço mínimo) vêm em fração (0.25 = 25%).
  Sempre apresente ao usuário em %.
- Data de referência do preço: date. O campo month é só rótulo de exibição.
Convenções de cálculo, sempre:
- ROB = preço bruto x volume (sem decimais)
- MB absoluta = ROB x margem bruta em % (sem decimais)
- Reduções de preço: multiplicar por (1 - d/100), nunca ajuste inverso
- Custo: no catálogo, usar catalog_cost como está armazenado. Nos demais casos, não calcule custo; informe que o cálculo depende de confirmação da área de Data.
- vigencia_inferida = true significa que o preço vigente não está marcado no banco e foi deduzido pela data; avise o usuário quando isso ocorrer.
- Markup de ponta = retail_price (client_retail_prices) / preço bruto vigente, exibido como 1,85x. Use consultar_markup e consultar_preco_ponta; não calcule markup por conta própria.
- currency (BRL ou USD) indica a moeda do preço; nunca apresente USD como R$.
- Propostas (prices, da /new-business): status é a decisão do cliente (em_aberto = aguardando resposta, aprovado, reprovado); o motivo da reprovação vem em rejeicoes. sku é rótulo livre, sem code. margembruta e maco_pct em %. Em mercado exportacao, precoliquido e precobruto são o Preço BRL; o valor em dólar está em preco_usd, com ptax.
- Clientes de exportação: use listar_clientes_exportacao; o client_id serve para preco_vigente, historico_precos e consultar_markup.
- Calcule apenas as métricas definidas nestas convenções. MACO é o campo maco_pct; não rotule outros cálculos como MACO.
Inserção de preços aprovados (arquivo 'Aprovado ... - CLIENTE.xlsx'):
1. Leia o arquivo com código (openpyxl), nunca 'de olho'. Cabeçalho na linha 2, dados da linha 3 até a primeira linha vazia, colunas B a K ou B a L, conforme o arquivo tem ou não a coluna de volume. Coluna H com cabeçalho 'precoliq' = nacional; 'preço BRL' = exportação (PTAX na célula I1). Localize as colunas 'volume' e 'aprovador' pelo cabeçalho da linha 2. Arquivo sem coluna de volume tem o aprovador na K; arquivo com volume tem o volume na K e o aprovador na L. Se não houver volume, não envie volume. Se houver, envie o valor de cada linha, e célula em branco não envia volume naquela linha.
2. Confirme no chat: o cliente (texto após o último ' - ' do nome do arquivo), se é novo cliente ou novo SKU, e a categoria e subcategoria de CADA SKU, oferecendo apenas as opções válidas.
origin_type = novo_cliente indica prospect (sem client_id); novo_sku indica cliente existente com SKU novo.
3. Chame preparar_insercao_precos e mostre o preview em tabela: SKU, Pricing ID, preço líquido, preço bruto, margem bruta %, MACO %, volume (indique a origem pelo campo volume_origem: planilha, nome ou padrão (1.000)), categoria e subcategoria, seguido dos avisos.
4. Só chame confirmar_insercao_precos após confirmação explícita do usuário. Se ele pedir ajuste, cancele o lote e prepare outro.
5. Os números do arquivo são aprovados: não recalcule nem questione.
Terminologia: MB absoluta, ROB, margem bruta, volume de referência, SKU.`

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
}

function createServer(context: ToolContext): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS }
  )

  registerTools(server, context)
  return server
}

async function handleMcp(request: Request, ctx: SupabaseContext): Promise<Response> {
  // The server and its tools are bound to this caller for exactly one request.
  const handler = createMcpHandler(
    () =>
      createServer({
        supabase: ctx.supabase,
        // auth: 'user' guarantees both claim shapes before this handler runs.
        userClaims: ctx.userClaims!,
        jwtClaims: ctx.jwtClaims!,
      }),
    { onerror: (error) => console.error('MCP request failed', error) }
  )

  return handler.fetch(request)
}

// The handler is passed inline so TypeScript infers its context from the entries.
// Passing `handleMcp` directly collapses the inferred context to `object`.
Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase({ auth: 'user', cors: { headers: CORS_HEADERS } })],
    (request, ctx) => handleMcp(request, ctx)
  )
)
