const MATCH_LEVEL_ORDER = {
  exato: 0,
  similar: 1,
  referencia: 2,
} as const

const RUNIDADE_UNITS = new Set(['cápsulas', 'gomas', 'géis', 'sticks', 'sachês'])

type MatchLevel = 'exato' | 'similar' | 'referencia'
type Basis = 'r100g' | 'runidade'
type AgeBadgeValue = 'warn' | 'stale' | null

export type ComparisonAttrs = {
  pack_qty: number | null
  pack_unit: string | null
  pack_weight_g: number | null
}

export type ComparisonQuote = {
  volume: number
  gross_price: number
  quoted_at: string | null
}

export type ComparisonMatch = {
  competitor: string
  competitor_sku: string
  match_level: MatchLevel
  diff_reason: string | null
  note: string | null
  attrs: ComparisonAttrs
  quotes: ComparisonQuote[]
}

export type PickedQuote = ComparisonQuote & {
  outOfTier: boolean
}

export type ComparisonRow = ComparisonMatch & {
  quote: ComparisonQuote | null
  outOfTier: boolean
  basis: Basis | null
  mPro: number | null
  mConc: number | null
  delta: number | null
  ageBadge: AgeBadgeValue
}

export type ComparisonSummary = {
  preferredBasis: Basis
  n: number
  median: number | null
  medianProductEquivalent: number | null
  deltaVsMedian: number | null
  min: number | null
  cheapestCompetitor: string | null
  deltaVsMin: number | null
  position: number | null
  total: number | null
}

function parsePositiveNumber(value: unknown): number {
  if (typeof value !== 'number') return Number.NaN
  return Number.isFinite(value) && value > 0 ? value : Number.NaN
}

function normalizeUnit(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized === '' ? null : normalized
}

export function toTimestamp(value: unknown): number {
  if (!value) return Number.NaN
  const timestamp = value instanceof Date ? value.getTime() : new Date(value as string).getTime()
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

function compareQuoteForPick(a: ComparisonQuote, b: ComparisonQuote): number {
  const volumeDiff = a.volume - b.volume
  if (volumeDiff !== 0) return volumeDiff
  return toTimestamp(b.quoted_at) - toTimestamp(a.quoted_at)
}

function compareRows(a: ComparisonRow, b: ComparisonRow): number {
  const levelDiff =
    (MATCH_LEVEL_ORDER[a.match_level] ?? 99) - (MATCH_LEVEL_ORDER[b.match_level] ?? 99)
  if (levelDiff !== 0) return levelDiff

  const aDelta = a.delta
  const bDelta = b.delta
  if (aDelta == null && bDelta == null) {
    return String(a.competitor).localeCompare(String(b.competitor), 'pt-BR')
  }
  if (aDelta == null) return 1
  if (bDelta == null) return -1
  if (aDelta !== bDelta) return aDelta - bDelta

  return String(a.competitor).localeCompare(String(b.competitor), 'pt-BR')
}

function median(values: readonly number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

export function pickQuoteForTier(
  quotes: readonly ComparisonQuote[] | null | undefined,
  tier: number
): PickedQuote | null {
  if (!Array.isArray(quotes) || quotes.length === 0) return null

  const normalizedQuotes = quotes
    .filter((quote) => quote && Number.isFinite(quote.volume))
    .map((quote) => ({ ...quote }))

  if (normalizedQuotes.length === 0) return null

  const validTier = Number.isFinite(tier) ? tier : Number.NaN
  const withinTier = normalizedQuotes
    .filter((quote) => quote.volume <= validTier)
    .sort(
      (a, b) =>
        (b.volume - a.volume) || (toTimestamp(b.quoted_at) - toTimestamp(a.quoted_at))
    )

  if (withinTier.length > 0) {
    return { ...withinTier[0], outOfTier: false }
  }

  const fallback = [...normalizedQuotes].sort(compareQuoteForPick)[0]
  return fallback ? { ...fallback, outOfTier: true } : null
}

export function comparisonBasis(
  proAttrs: ComparisonAttrs | null | undefined,
  compAttrs: ComparisonAttrs | null | undefined
): Basis | null {
  const proWeight = parsePositiveNumber(proAttrs?.pack_weight_g)
  const compWeight = parsePositiveNumber(compAttrs?.pack_weight_g)
  if (Number.isFinite(proWeight) && Number.isFinite(compWeight)) return 'r100g'

  const proUnit = normalizeUnit(proAttrs?.pack_unit)
  const compUnit = normalizeUnit(compAttrs?.pack_unit)
  const proQty = parsePositiveNumber(proAttrs?.pack_qty)
  const compQty = parsePositiveNumber(compAttrs?.pack_qty)

  if (
    proUnit &&
    proUnit === compUnit &&
    RUNIDADE_UNITS.has(proUnit) &&
    Number.isFinite(proQty) &&
    Number.isFinite(compQty)
  ) {
    return 'runidade'
  }

  return null
}

export function metric(
  price: number | null | undefined,
  attrs: ComparisonAttrs | null | undefined,
  basis: Basis | null
): number | null {
  const numericPrice = parsePositiveNumber(price)
  if (!Number.isFinite(numericPrice)) return null

  if (basis === 'r100g') {
    const weight = parsePositiveNumber(attrs?.pack_weight_g)
    if (!Number.isFinite(weight)) return null
    return (numericPrice / weight) * 100
  }

  if (basis === 'runidade') {
    const qty = parsePositiveNumber(attrs?.pack_qty)
    if (!Number.isFinite(qty)) return null
    return numericPrice / qty
  }

  return null
}

export function ageBadge(quotedAt: string | Date | null | undefined, today: string | Date): AgeBadgeValue {
  const quotedAtTs = toTimestamp(quotedAt)
  const todayTs = toTimestamp(today)
  if (!Number.isFinite(quotedAtTs) || !Number.isFinite(todayTs)) return null

  const diffDays = Math.floor((todayTs - quotedAtTs) / 86400000)
  if (diffDays <= 183) return null
  if (diffDays <= 365) return 'warn'
  return 'stale'
}

export function formatDelta(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta)) return '–'

  const percent = Math.round(Math.abs(delta) * 100)
  if (percent === 0) return 'PRO em linha'
  if (delta > 0) return `PRO ${percent}% acima`
  return `PRO ${percent}% abaixo`
}

export function buildComparison({
  tier,
  proPrice,
  proAttrs,
  matches,
  today,
}: {
  tier: number
  proPrice: number | null
  proAttrs: ComparisonAttrs | null
  matches: ComparisonMatch[]
  today: string | Date
}): { rows: ComparisonRow[]; summary: ComparisonSummary } {
  const rows = Array.isArray(matches)
    ? matches
        .map((match) => {
          const pickedQuote = pickQuoteForTier(match?.quotes, tier)
          const basis = comparisonBasis(proAttrs, match?.attrs)
          const quote = pickedQuote
            ? {
                volume: pickedQuote.volume,
                gross_price: pickedQuote.gross_price,
                quoted_at: pickedQuote.quoted_at,
              }
            : null
          const mPro = metric(proPrice, proAttrs, basis)
          const mConc = metric(quote?.gross_price, match?.attrs, basis)
          const delta = mPro != null && mConc != null ? mPro / mConc - 1 : null

          return {
            ...match,
            quote,
            outOfTier: pickedQuote?.outOfTier ?? false,
            basis,
            mPro,
            mConc,
            delta,
            ageBadge: ageBadge(quote?.quoted_at, today),
          }
        })
        .sort(compareRows)
    : []

  const preferredBasis = parsePositiveNumber(proAttrs?.pack_weight_g) ? 'r100g' : 'runidade'
  const eligible = rows.filter(
    (row) =>
      (row.match_level === 'exato' || row.match_level === 'similar') &&
      row.basis === preferredBasis &&
      row.outOfTier === false &&
      row.delta != null
  )

  const n = eligible.length
  if (n === 0) {
    return {
      rows,
      summary: {
        preferredBasis,
        n: 0,
        median: null,
        medianProductEquivalent: null,
        deltaVsMedian: null,
        min: null,
        cheapestCompetitor: null,
        deltaVsMin: null,
        position: null,
        total: null,
      },
    }
  }

  const metrics = eligible.map((row) => row.mConc as number)
  const mPro = eligible[0].mPro as number
  const medianValue = median(metrics)
  const minValue = Math.min(...metrics)
  const cheapestRow = eligible.find((row) => row.mConc === minValue) ?? null
  const position = 1 + eligible.filter((row) => (row.mConc as number) < mPro).length
  const proWeight = parsePositiveNumber(proAttrs?.pack_weight_g)
  const proQty = parsePositiveNumber(proAttrs?.pack_qty)
  const medianProductEquivalent =
    preferredBasis === 'r100g' && Number.isFinite(proWeight)
      ? (medianValue as number) * proWeight / 100
      : preferredBasis === 'runidade' && Number.isFinite(proQty)
        ? (medianValue as number) * proQty
        : null

  return {
    rows,
    summary: {
      preferredBasis,
      n,
      median: medianValue,
      medianProductEquivalent,
      deltaVsMedian: medianValue != null ? mPro / medianValue - 1 : null,
      min: minValue,
      cheapestCompetitor: cheapestRow?.competitor ?? null,
      deltaVsMin: minValue != null ? mPro / minValue - 1 : null,
      position,
      total: n + 1,
    },
  }
}
