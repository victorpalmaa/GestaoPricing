import { assertEquals, assertAlmostEquals } from 'jsr:@std/assert@1'

import {
  ageBadge,
  buildComparison,
  comparisonBasis,
  formatDelta,
  pickQuoteForTier,
} from './competitorComparison.ts'

Deno.test('competitorComparison: pickQuoteForTier retorna null para lista vazia', () => {
  assertEquals(pickQuoteForTier([], 1000), null)
})

Deno.test('competitorComparison: pickQuoteForTier seleciona a maior faixa menor ou igual ao tier', () => {
  const picked = pickQuoteForTier(
    [
      { volume: 100, gross_price: 50, quoted_at: '2026-01-01' },
      { volume: 1000, gross_price: 40, quoted_at: '2026-01-02' },
      { volume: 300, gross_price: 45, quoted_at: '2026-01-03' },
    ],
    1000
  )

  assertEquals(picked, {
    volume: 1000,
    gross_price: 40,
    quoted_at: '2026-01-02',
    outOfTier: false,
  })
})

Deno.test('competitorComparison: pickQuoteForTier usa a cotação mais recente no empate dentro do tier', () => {
  const picked = pickQuoteForTier(
    [
      { volume: 1000, gross_price: 41, quoted_at: '2026-01-10' },
      { volume: 1000, gross_price: 40, quoted_at: '2026-03-15' },
      { volume: 300, gross_price: 45, quoted_at: '2026-04-01' },
    ],
    1000
  )

  assertEquals(picked, {
    volume: 1000,
    gross_price: 40,
    quoted_at: '2026-03-15',
    outOfTier: false,
  })
})

Deno.test('competitorComparison: pickQuoteForTier sem faixa no tier usa a menor e marca outOfTier', () => {
  const picked = pickQuoteForTier(
    [
      { volume: 2000, gross_price: 23.9, quoted_at: '2026-01-01' },
      { volume: 5000, gross_price: 20.9, quoted_at: '2026-01-02' },
    ],
    1000
  )

  assertEquals(picked, {
    volume: 2000,
    gross_price: 23.9,
    quoted_at: '2026-01-01',
    outOfTier: true,
  })
})

Deno.test('competitorComparison: comparisonBasis retorna runidade para gomas vs gomas', () => {
  const basis = comparisonBasis(
    { pack_qty: 60, pack_unit: 'gomas', pack_weight_g: null },
    { pack_qty: 30, pack_unit: 'gomas', pack_weight_g: null }
  )

  assertEquals(basis, 'runidade')
})

Deno.test('competitorComparison: comparisonBasis retorna null para g vs gomas', () => {
  const basis = comparisonBasis(
    { pack_qty: 300, pack_unit: 'g', pack_weight_g: null },
    { pack_qty: 60, pack_unit: 'gomas', pack_weight_g: null }
  )

  assertEquals(basis, null)
})

Deno.test('competitorComparison: ageBadge retorna null para 100 dias', () => {
  assertEquals(ageBadge('2026-07-19', '2026-10-27'), null)
})

Deno.test('competitorComparison: ageBadge retorna warn para 200 dias', () => {
  assertEquals(ageBadge('2026-04-10', '2026-10-27'), 'warn')
})

Deno.test('competitorComparison: ageBadge retorna stale para 400 dias', () => {
  assertEquals(ageBadge('2025-09-22', '2026-10-27'), 'stale')
})

Deno.test('competitorComparison: formatDelta formata acima, abaixo e em linha', () => {
  assertEquals(formatDelta(0.115), 'PRO 12% acima')
  assertEquals(formatDelta(-0.2533), 'PRO 25% abaixo')
  assertEquals(formatDelta(0), 'PRO em linha')
})

Deno.test('competitorComparison: buildComparison no caso ancora creatina - pote 300g', () => {
  const result = buildComparison({
    tier: 1000,
    proPrice: 23.7518880638086,
    proAttrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
    today: '2026-10-27',
    matches: [
      {
        competitor: '3Life',
        competitor_sku: 'Creatina 300g',
        match_level: 'exato',
        diff_reason: null,
        note: null,
        attrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
        quotes: [{ volume: 2000, gross_price: 23.9, quoted_at: '2026-09-01' }],
      },
      {
        competitor: 'BPM',
        competitor_sku: 'Creatina 300g',
        match_level: 'exato',
        diff_reason: null,
        note: null,
        attrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
        quotes: [
          { volume: 10000, gross_price: 17.21, quoted_at: '2026-09-01' },
          { volume: 20000, gross_price: 16.7, quoted_at: '2026-09-01' },
        ],
      },
      {
        competitor: 'CapsExpress',
        competitor_sku: 'Creatina 300g',
        match_level: 'exato',
        diff_reason: null,
        note: null,
        attrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
        quotes: [
          { volume: 100, gross_price: 46.9, quoted_at: '2026-09-01' },
          { volume: 1000, gross_price: 40.9, quoted_at: '2026-09-01' },
        ],
      },
      {
        competitor: 'Fitoway',
        competitor_sku: 'Creatina 300g',
        match_level: 'exato',
        diff_reason: null,
        note: null,
        attrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
        quotes: [
          { volume: 300, gross_price: 26.75, quoted_at: '2026-09-01' },
          { volume: 1000, gross_price: 21.3, quoted_at: '2026-09-01' },
          { volume: 3000, gross_price: 19.3, quoted_at: '2026-09-01' },
        ],
      },
      {
        competitor: 'LivHealth',
        competitor_sku: 'Creatina 300g',
        match_level: 'exato',
        diff_reason: null,
        note: null,
        attrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
        quotes: [
          { volume: 1000, gross_price: 22.5, quoted_at: '2026-09-01' },
          { volume: 3000, gross_price: 20.5, quoted_at: '2026-09-01' },
        ],
      },
      {
        competitor: 'New Millen',
        competitor_sku: 'Creatina 300g',
        match_level: 'exato',
        diff_reason: null,
        note: null,
        attrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
        quotes: [{ volume: 1000, gross_price: 37, quoted_at: '2026-09-01' }],
      },
      {
        competitor: 'PROMEL',
        competitor_sku: 'Creatina 300g',
        match_level: 'exato',
        diff_reason: null,
        note: null,
        attrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
        quotes: [
          { volume: 1000, gross_price: 43.68, quoted_at: '2026-09-01' },
          { volume: 5000, gross_price: 36.4, quoted_at: '2026-09-01' },
        ],
      },
      {
        competitor: 'Unilife',
        competitor_sku: 'Creatina 300g',
        match_level: 'exato',
        diff_reason: null,
        note: null,
        attrs: { pack_qty: 300, pack_unit: 'g', pack_weight_g: 300 },
        quotes: [{ volume: 1000, gross_price: 26.62, quoted_at: '2026-09-01' }],
      },
      {
        competitor: 'LivHealth',
        competitor_sku: 'Creatina 500g',
        match_level: 'similar',
        diff_reason: 'peso diferente',
        note: null,
        attrs: { pack_qty: 500, pack_unit: 'g', pack_weight_g: 500 },
        quotes: [{ volume: 1000, gross_price: 37.9, quoted_at: '2026-09-01' }],
      },
      {
        competitor: 'PROMEL',
        competitor_sku: 'Creatina 150g',
        match_level: 'similar',
        diff_reason: 'peso diferente',
        note: null,
        attrs: { pack_qty: 150, pack_unit: 'g', pack_weight_g: 150 },
        quotes: [{ volume: 1000, gross_price: 30.18, quoted_at: '2026-09-01' }],
      },
    ],
  })

  assertEquals(result.summary.preferredBasis, 'r100g')
  assertEquals(result.summary.n, 8)
  assertEquals(result.summary.position, 4)
  assertEquals(result.summary.total, 9)
  assertEquals(result.summary.cheapestCompetitor, 'Fitoway')
  assertAlmostEquals(result.summary.deltaVsMedian ?? 0, -0.2533, 0.001)
  assertAlmostEquals(result.summary.medianProductEquivalent ?? 0, 31.81, 0.01)
  assertAlmostEquals(result.summary.deltaVsMin ?? 0, 0.1151, 0.001)

  const row3Life = result.rows.find((row) => row.competitor === '3Life') ?? null
  const rowBpm = result.rows.find((row) => row.competitor === 'BPM') ?? null
  assertEquals(row3Life?.outOfTier, true)
  assertEquals(rowBpm?.outOfTier, true)

  const eligibleCompetitors = result.rows
    .filter(
      (row) =>
        (row.match_level === 'exato' || row.match_level === 'similar') &&
        row.basis === result.summary.preferredBasis &&
        row.outOfTier === false &&
        row.delta != null
    )
    .map((row) => row.competitor)

  assertEquals(eligibleCompetitors.includes('3Life'), false)
  assertEquals(eligibleCompetitors.includes('BPM'), false)
})
