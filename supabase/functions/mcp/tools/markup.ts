// Lógica pura de cálculo de markup de ponta. Sem imports de Deno/npm.
// Nunca persiste markup; sempre derivado em tempo de leitura.

export type MarkupStatus =
  | 'sem_ponta'
  | 'preco_nao_vigente'
  | 'preco_bruto_invalido'
  | 'moeda_divergente'
  | 'ok'

export type MarkupInput = {
  precoBruto: number | string | null | undefined
  moedaBruto?: string | null
  precoPonta: number | string | null | undefined
  moedaPonta?: string | null
  vigenciaInferida?: boolean
}

export type MarkupResult = {
  markup: number | null
  markup_texto: string | null
  status: MarkupStatus
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizarMoeda(moeda: string | null | undefined): string {
  return typeof moeda === 'string' ? moeda.trim().toUpperCase() : ''
}

function formatarMarkup(valor: number): string {
  return `${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}x`
}

export function calcularMarkup(input: MarkupInput): MarkupResult {
  const precoPonta = toFiniteNumber(input.precoPonta)
  if (precoPonta === null) {
    return { markup: null, markup_texto: null, status: 'sem_ponta' }
  }

  if (input.vigenciaInferida === true) {
    return { markup: null, markup_texto: null, status: 'preco_nao_vigente' }
  }

  const precoBruto = toFiniteNumber(input.precoBruto)
  if (precoBruto === null || precoBruto <= 0) {
    return { markup: null, markup_texto: null, status: 'preco_bruto_invalido' }
  }

  const moedaBruto = normalizarMoeda(input.moedaBruto)
  const moedaPonta = normalizarMoeda(input.moedaPonta)
  if (moedaBruto !== moedaPonta) {
    return { markup: null, markup_texto: null, status: 'moeda_divergente' }
  }

  const markup = Math.round((precoPonta / precoBruto) * 10000) / 10000

  return {
    markup,
    markup_texto: formatarMarkup(markup),
    status: 'ok',
  }
}
