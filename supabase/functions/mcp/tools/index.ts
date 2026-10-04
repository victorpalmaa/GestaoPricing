import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'

import type { ToolContext } from './types.ts'
import { registerBuscarClienteTool } from './buscar_cliente.ts'
import { registerPrecoVigenteTool } from './preco_vigente.ts'
import { registerHistoricoPrecosTool } from './historico_precos.ts'
import { registerConsultarCatalogoTool } from './consultar_catalogo.ts'
import { registerConsultarPrecoMinimoTool } from './consultar_preco_minimo.ts'
import { registerPrepararInsercaoPrecosTool } from './preparar_insercao_precos.ts'
import { registerConfirmarInsercaoPrecosTool } from './confirmar_insercao_precos.ts'
import { registerCancelarLotePrecosTool } from './cancelar_lote_precos.ts'

export type { ToolContext } from './types.ts'

export function registerTools(server: McpServer, context: ToolContext): void {
  registerBuscarClienteTool(server, context)
  registerPrecoVigenteTool(server, context)
  registerHistoricoPrecosTool(server, context)
  registerConsultarCatalogoTool(server, context)
  registerConsultarPrecoMinimoTool(server, context)
  registerPrepararInsercaoPrecosTool(server, context)
  registerConfirmarInsercaoPrecosTool(server, context)
  registerCancelarLotePrecosTool(server, context)
}
