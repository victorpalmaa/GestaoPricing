import {
  ageBadge,
  buildComparison,
  comparisonBasis,
  formatDelta,
  pickQuoteForTier,
} from './competitorComparison';

describe('competitorComparison', () => {
  describe('pickQuoteForTier', () => {
    it('lista vazia -> null', () => {
      expect(pickQuoteForTier([], 1000)).toBeNull();
    });

    it('seleciona a maior faixa menor ou igual ao tier', () => {
      const picked = pickQuoteForTier([
        { volume: 100, gross_price: 50, quoted_at: '2026-01-01' },
        { volume: 1000, gross_price: 40, quoted_at: '2026-01-02' },
        { volume: 300, gross_price: 45, quoted_at: '2026-01-03' },
      ], 1000);

      expect(picked).toEqual({
        volume: 1000,
        gross_price: 40,
        quoted_at: '2026-01-02',
        outOfTier: false,
      });
    });

    it('sem faixa no tier usa a menor e marca outOfTier', () => {
      const picked = pickQuoteForTier([
        { volume: 2000, gross_price: 23.9, quoted_at: '2026-01-01' },
        { volume: 5000, gross_price: 20.9, quoted_at: '2026-01-02' },
      ], 1000);

      expect(picked).toEqual({
        volume: 2000,
        gross_price: 23.9,
        quoted_at: '2026-01-01',
        outOfTier: true,
      });
    });
  });

  describe('comparisonBasis', () => {
    it('gomas vs gomas -> runidade', () => {
      const basis = comparisonBasis(
        { pack_qty: 60, pack_unit: 'gomas', pack_weight_g: null },
        { pack_qty: 30, pack_unit: 'gomas', pack_weight_g: null }
      );

      expect(basis).toBe('runidade');
    });

    it('g vs gomas -> null', () => {
      const basis = comparisonBasis(
        { pack_qty: 300, pack_unit: 'g', pack_weight_g: null },
        { pack_qty: 60, pack_unit: 'gomas', pack_weight_g: null }
      );

      expect(basis).toBeNull();
    });
  });

  describe('ageBadge', () => {
    it('100 dias -> null', () => {
      expect(ageBadge('2026-07-19', '2026-10-27')).toBeNull();
    });

    it('200 dias -> warn', () => {
      expect(ageBadge('2026-04-10', '2026-10-27')).toBe('warn');
    });

    it('400 dias -> stale', () => {
      expect(ageBadge('2025-09-22', '2026-10-27')).toBe('stale');
    });
  });

  describe('formatDelta', () => {
    it('formata acima e abaixo', () => {
      expect(formatDelta(0.115)).toBe('PRO 12% acima');
      expect(formatDelta(-0.2533)).toBe('PRO 25% abaixo');
      expect(formatDelta(0)).toBe('PRO em linha');
    });
  });

  describe('buildComparison', () => {
    it('caso ancora creatina - pote 300g', () => {
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
            quotes: [
              { volume: 2000, gross_price: 23.9, quoted_at: '2026-09-01' },
            ],
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
            quotes: [
              { volume: 1000, gross_price: 37, quoted_at: '2026-09-01' },
            ],
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
            quotes: [
              { volume: 1000, gross_price: 26.62, quoted_at: '2026-09-01' },
            ],
          },
          {
            competitor: 'LivHealth',
            competitor_sku: 'Creatina 500g',
            match_level: 'similar',
            diff_reason: 'peso diferente',
            note: null,
            attrs: { pack_qty: 500, pack_unit: 'g', pack_weight_g: 500 },
            quotes: [
              { volume: 1000, gross_price: 37.9, quoted_at: '2026-09-01' },
            ],
          },
          {
            competitor: 'PROMEL',
            competitor_sku: 'Creatina 150g',
            match_level: 'similar',
            diff_reason: 'peso diferente',
            note: null,
            attrs: { pack_qty: 150, pack_unit: 'g', pack_weight_g: 150 },
            quotes: [
              { volume: 1000, gross_price: 30.18, quoted_at: '2026-09-01' },
            ],
          },
        ],
      });

      expect(result.summary.preferredBasis).toBe('r100g');
      expect(result.summary.n).toBe(8);
      expect(result.summary.position).toBe(4);
      expect(result.summary.total).toBe(9);
      expect(result.summary.cheapestCompetitor).toBe('Fitoway');
      expect(result.summary.deltaVsMedian).toBeCloseTo(-0.2533, 3);
      expect(result.summary.deltaVsMin).toBeCloseTo(0.1151, 3);

      const row3Life = result.rows.find((row) => row.competitor === '3Life');
      const rowBpm = result.rows.find((row) => row.competitor === 'BPM');
      expect(row3Life.outOfTier).toBe(true);
      expect(rowBpm.outOfTier).toBe(true);

      const eligibleCompetitors = result.rows
        .filter(
          (row) =>
            (row.match_level === 'exato' || row.match_level === 'similar') &&
            row.basis === result.summary.preferredBasis &&
            row.outOfTier === false &&
            row.delta != null
        )
        .map((row) => row.competitor);

      expect(eligibleCompetitors).not.toContain('3Life');
      expect(eligibleCompetitors).not.toContain('BPM');
    });
  });
});
