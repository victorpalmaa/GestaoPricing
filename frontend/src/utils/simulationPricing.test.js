import {
  estimateMarginFromGrossPrice,
  formatMarginPercentInputValue,
  normalizeMarginPercentInput,
  solveDisplayedPriceByMargin,
  toRate,
} from './simulationPricing';

const DEFAULT_RATES = {
  pisRate: toRate(1.65),
  cofinsRate: toRate(7.6),
  icmsRate: toRate(12),
  comissaoRate: 0,
  freteRate: 0,
  encargoRate: toRate(1.5),
  ipiRate: 0,
};

describe('simulationPricing', () => {
  it('aceita margem digitada como 23 e como 0,23', () => {
    expect(normalizeMarginPercentInput(23)).toBe(23);
    expect(normalizeMarginPercentInput(0.23)).toBe(23);
    expect(formatMarginPercentInputValue(0.27)).toBe('27.00');
  });

  it('reproduz o caso reportado do Balance Pro: custo 29,95, 23% -> 49,62', () => {
    const result = solveDisplayedPriceByMargin({
      custoTotal: 29.95,
      margemRate: normalizeMarginPercentInput(23) / 100,
      ...DEFAULT_RATES,
    });

    expect(result.error).toBeUndefined();
    expect(result.roundedNetPrice).toBeCloseTo(39.63, 2);
    expect(result.grossPrice).toBeCloseTo(49.62, 2);
  });

  it('reproduz o preço de catálogo do Balance Pro: custo 29,95, 25% -> 50,95', () => {
    const result = solveDisplayedPriceByMargin({
      custoTotal: 29.95,
      margemRate: normalizeMarginPercentInput(25) / 100,
      ...DEFAULT_RATES,
    });

    expect(result.error).toBeUndefined();
    expect(result.roundedNetPrice).toBeCloseTo(40.69, 2);
    expect(result.grossPrice).toBeCloseTo(50.95, 2);
  });

  it('reproduz o arredondamento esperado da Glutamina 5k: custo 18,30, 22% -> 29,94', () => {
    const result = solveDisplayedPriceByMargin({
      custoTotal: 18.3,
      margemRate: normalizeMarginPercentInput(22) / 100,
      ...DEFAULT_RATES,
    });

    expect(result.error).toBeUndefined();
    expect(result.roundedNetPrice).toBeCloseTo(23.91, 2);
    expect(result.grossPrice).toBeCloseTo(29.94, 2);
  });

  it('estima a margem correta a partir do preço bruto do Balance Pro', () => {
    const result = estimateMarginFromGrossPrice({
      grossPrice: 49.62,
      custoTotal: 29.95,
      ...DEFAULT_RATES,
    });

    expect(result.error).toBeUndefined();
    expect(result.marginPercent).toBeCloseTo(23, 2);
  });

  it('usa a mesma regra de margem exibida da ferramenta oficial para bruto 19,00 com custo 12,00', () => {
    const result = estimateMarginFromGrossPrice({
      grossPrice: 19,
      custoTotal: 12,
      ...DEFAULT_RATES,
    });

    expect(result.error).toBeUndefined();
    expect(result.marginPercent).toBe(19.42);
  });

});
