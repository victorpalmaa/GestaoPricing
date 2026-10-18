// Lógica pura de seleção de preço vigente a partir de linhas do pricing_history.
// Sem imports de Deno/npm para que possa ser testada e reutilizada por outras tools.

export type PricingHistoryRow = {
  id: string
  client_id?: string | null
  sku?: string | null
  code?: string | null
  date?: string | null
  month?: string | null
  currency?: string | null
  created_at?: string | null
  is_current?: boolean | null
  size?: string | null
  manager?: string | null
  net_price?: unknown
  gross_price?: unknown
  margin_budget?: unknown
  category?: string | null
  subcategory?: string | null
  obs?: string | null
  readjustment_status?: string | null
  last_price_date?: string | null
  gate?: string | null
}

export type VigenciaResult = PricingHistoryRow & { vigencia_inferida: boolean }

function compareRowsByDateDesc(a: PricingHistoryRow, b: PricingHistoryRow): number {
  const aDate = a.date ? String(a.date) : ''
  const bDate = b.date ? String(b.date) : ''
  if (aDate < bDate) return 1
  if (aDate > bDate) return -1

  const aCreated = a.created_at ? String(a.created_at) : ''
  const bCreated = b.created_at ? String(b.created_at) : ''
  if (aCreated < bCreated) return 1
  if (aCreated > bCreated) return -1

  return String(b.id || '').localeCompare(String(a.id || ''))
}

/**
 * Agrupa as linhas por code e seleciona a vigente de cada grupo.
 * - Se houver linha com is_current=true, ela é a vigente (vigencia_inferida=false).
 * - Senão, a mais recente por (date, created_at, id) é selecionada com vigencia_inferida=true.
 * Linhas sem code ficam em grupo próprio (não se unem a outras).
 */
export function selecionarVigentes(rows: readonly PricingHistoryRow[]): VigenciaResult[] {
  const byCode = new Map<string, PricingHistoryRow[]>()
  for (const row of rows) {
    const key =
      row.code && String(row.code).trim() !== ''
        ? String(row.code).trim()
        : `__no_code__${String(row.id || '')}`
    if (!byCode.has(key)) byCode.set(key, [])
    byCode.get(key)!.push(row)
  }

  const resultados: VigenciaResult[] = []

  for (const groupRows of byCode.values()) {
    const flaggedCurrent = groupRows.find((r) => Boolean(r.is_current))
    if (flaggedCurrent) {
      resultados.push({ ...flaggedCurrent, vigencia_inferida: false })
      continue
    }

    const sorted = [...groupRows].sort(compareRowsByDateDesc)
    if (sorted[0]) {
      resultados.push({ ...sorted[0], vigencia_inferida: true })
    }
  }

  return resultados
}
