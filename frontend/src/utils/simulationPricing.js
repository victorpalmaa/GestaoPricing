export const toRate = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric / 100;
};

export const normalizeMarginPercentInput = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric !== 0 && Math.abs(numeric) < 1) {
    return numeric * 100;
  }
  return numeric;
};

export const roundCurrency = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

export const truncateToDecimals = (value, decimals = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** decimals;
  if (numeric >= 0) {
    return Math.floor((numeric + Number.EPSILON) * factor) / factor;
  }
  return Math.ceil((numeric - Number.EPSILON) * factor) / factor;
};

export const normalizeDisplayedMarginPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;

  const nearestInteger = Math.round(numeric);
  if (Math.abs(numeric - nearestInteger) <= 0.005) {
    return nearestInteger;
  }

  return truncateToDecimals(numeric, 2);
};

export const formatMarginPercentInputValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  return normalizeMarginPercentInput(value).toFixed(2);
};

export const ceilCurrency = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.ceil((numeric - Number.EPSILON) * 100) / 100;
};

export const calculatePricingFactors = ({ pisRate, cofinsRate, icmsRate }) => {
  const pisLiq = pisRate * (1 - icmsRate);
  const cofinsLiq = cofinsRate * (1 - icmsRate);
  const fatorImp = 1 - pisLiq - cofinsLiq - icmsRate;
  return { pisLiq, cofinsLiq, fatorImp };
};

export const calculateReferenceContribution = ({
  referenceGrossPrice,
  referenceMarginPercent,
}) => {
  const grossNumeric = Number(referenceGrossPrice || 0);
  const marginRate = Number(referenceMarginPercent || 0) / 100;

  if (grossNumeric <= 0 || marginRate >= 1) {
    return { error: 'Referência de catálogo inválida para cálculo de margem.' };
  }

  return {
    referenceContribution: grossNumeric * (1 - marginRate),
  };
};

const buildMarginCurve = ({
  referenceGrossPrice,
  referenceMarginPercent,
  minimumGrossPrice,
  minimumMarginPercent,
}) => {
  const referenceGross = Number(referenceGrossPrice || 0);
  const referenceMargin = Number(referenceMarginPercent || 0);
  const minimumGross = Number(minimumGrossPrice || 0);
  const minimumMargin = Number(minimumMarginPercent || 0);

  const hasMinimumPair = minimumGross > 0 && Number.isFinite(minimumMargin);
  const canBuildCurve =
    hasMinimumPair &&
    referenceGross > 0 &&
    Number.isFinite(referenceMargin) &&
    Math.abs(referenceMargin - minimumMargin) > 0.0001;

  if (!canBuildCurve) {
    return null;
  }

  const slope = (referenceGross - minimumGross) / (referenceMargin - minimumMargin);
  return {
    referenceGross,
    referenceMargin,
    minimumGross,
    minimumMargin,
    slope,
  };
};

export const calculateGrossPriceFromMarginCurve = ({
  referenceGrossPrice,
  referenceMarginPercent,
  minimumGrossPrice,
  minimumMarginPercent,
  targetMarginPercent,
}) => {
  const targetMargin = Number(targetMarginPercent || 0);
  const curve = buildMarginCurve({
    referenceGrossPrice,
    referenceMarginPercent,
    minimumGrossPrice,
    minimumMarginPercent,
  });

  if (curve) {
    if (Math.abs(targetMargin - curve.referenceMargin) <= 0.0001) {
      return { grossPrice: curve.referenceGross, source: 'catalog_curve' };
    }
    if (Math.abs(targetMargin - curve.minimumMargin) <= 0.0001) {
      return { grossPrice: curve.minimumGross, source: 'minimum_curve' };
    }
    return {
      grossPrice: curve.minimumGross + ((targetMargin - curve.minimumMargin) * curve.slope),
      source: 'curve',
    };
  }

  return calculateGrossPriceFromReferenceMargin({
    referenceGrossPrice,
    referenceMarginPercent,
    targetMarginPercent,
  });
};

export const calculateMarginFromGrossCurve = ({
  referenceGrossPrice,
  referenceMarginPercent,
  minimumGrossPrice,
  minimumMarginPercent,
  simulatedGrossPrice,
}) => {
  const simulatedGross = Number(simulatedGrossPrice || 0);
  const curve = buildMarginCurve({
    referenceGrossPrice,
    referenceMarginPercent,
    minimumGrossPrice,
    minimumMarginPercent,
  });

  if (curve) {
    if (Math.abs(simulatedGross - curve.referenceGross) <= 0.0001) {
      return { marginPercent: curve.referenceMargin, source: 'catalog_curve' };
    }
    if (Math.abs(simulatedGross - curve.minimumGross) <= 0.0001) {
      return { marginPercent: curve.minimumMargin, source: 'minimum_curve' };
    }
    if (Math.abs(curve.slope) <= 0.0000001) {
      return { error: 'Curva de margem inválida para o SKU selecionado.' };
    }
    return {
      marginPercent: curve.minimumMargin + ((simulatedGross - curve.minimumGross) / curve.slope),
      source: 'curve',
    };
  }

  return calculateMarginFromReferenceGross({
    referenceGrossPrice,
    referenceMarginPercent,
    simulatedGrossPrice,
  });
};

export const calculateGrossPriceFromReferenceMargin = ({
  referenceGrossPrice,
  referenceMarginPercent,
  targetMarginPercent,
}) => {
  const targetMarginRate = Number(targetMarginPercent || 0) / 100;
  const referenceResult = calculateReferenceContribution({
    referenceGrossPrice,
    referenceMarginPercent,
  });

  if (referenceResult.error) {
    return referenceResult;
  }
  if (targetMarginRate >= 1) {
    return { error: 'Margem inviável para os parâmetros atuais.' };
  }

  return {
    grossPrice: referenceResult.referenceContribution / (1 - targetMarginRate),
    referenceContribution: referenceResult.referenceContribution,
  };
};

export const calculateMarginFromReferenceGross = ({
  referenceGrossPrice,
  referenceMarginPercent,
  simulatedGrossPrice,
}) => {
  const grossNumeric = Number(simulatedGrossPrice || 0);
  const referenceResult = calculateReferenceContribution({
    referenceGrossPrice,
    referenceMarginPercent,
  });

  if (referenceResult.error) {
    return referenceResult;
  }
  if (grossNumeric <= 0) {
    return { error: 'Preço bruto inválido para cálculo da margem.' };
  }

  const marginRate = 1 - (referenceResult.referenceContribution / grossNumeric);
  return {
    marginRate,
    marginPercent: marginRate * 100,
    referenceContribution: referenceResult.referenceContribution,
  };
};

export const solvePriceByMargin = ({
  custoTotal,
  margemRate,
  pisRate,
  cofinsRate,
  icmsRate,
  comissaoRate,
  freteRate,
  encargoRate,
  ipiRate,
}) => {
  const { pisLiq, cofinsLiq, fatorImp } = calculatePricingFactors({ pisRate, cofinsRate, icmsRate });
  const denominador = 1 - comissaoRate - freteRate - (margemRate * fatorImp) - pisLiq - cofinsLiq - icmsRate;
  if (denominador <= 0) {
    return { error: 'Margem inviável para as alíquotas configuradas.' };
  }

  const pbBase = custoTotal / denominador;
  const rolBase = pbBase * fatorImp;
  const denomEnc = 1 - pisLiq - cofinsLiq - icmsRate - comissaoRate - freteRate;
  if (denomEnc <= 0) {
    return { error: 'Parâmetros inviáveis para cálculo com encargo.' };
  }

  const pbSemIpi = ((margemRate * rolBase) + custoTotal + (encargoRate * pbBase)) / denomEnc;
  const pbComIpi = pbSemIpi * (1 + ipiRate);
  const rol = pbSemIpi * fatorImp;
  if (rol <= 0) {
    return { error: 'Parâmetros inviáveis para cálculo.' };
  }

  const margemReal = (rol - custoTotal) / rol;
  return {
    pbSemIpi,
    pbComIpi,
    rol,
    margemReal,
  };
};

export const solveDisplayedPriceByMargin = (params) => {
  const result = solvePriceByMargin(params);
  if (result.error) {
    return result;
  }

  const roundedNetPrice = ceilCurrency(result.rol);
  const grossResult = calculateGrossPriceFromNetPrice({
    netPrice: roundedNetPrice,
    pisRate: params.pisRate,
    cofinsRate: params.cofinsRate,
    icmsRate: params.icmsRate,
    ipiRate: params.ipiRate,
  });

  if (grossResult.error) {
    return grossResult;
  }

  return {
    ...result,
    roundedNetPrice,
    grossPrice: roundCurrency(grossResult.grossPrice),
  };
};

export const estimateMarginFromGrossPrice = ({
  grossPrice,
  custoTotal,
  pisRate,
  cofinsRate,
  icmsRate,
  comissaoRate,
  freteRate,
  encargoRate,
  ipiRate,
}) => {
  const targetGrossPrice = roundCurrency(grossPrice);
  if (targetGrossPrice <= 0) {
    return { error: 'Preço bruto inválido para cálculo da margem.' };
  }

  let low = 0;
  let high = 99.99;
  let bestResult = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let index = 0; index < 50; index += 1) {
    const marginPercent = (low + high) / 2;
    const exactSimulation = solvePriceByMargin({
      custoTotal,
      margemRate: marginPercent / 100,
      pisRate,
      cofinsRate,
      icmsRate,
      comissaoRate,
      freteRate,
      encargoRate,
      ipiRate,
    });

    if (exactSimulation.error) {
      high = marginPercent;
      continue;
    }

    const displayedSimulation = solveDisplayedPriceByMargin({
      custoTotal,
      margemRate: marginPercent / 100,
      pisRate,
      cofinsRate,
      icmsRate,
      comissaoRate,
      freteRate,
      encargoRate,
      ipiRate,
    });
    const exactDiff = Math.abs(exactSimulation.pbComIpi - targetGrossPrice);
    if (exactDiff < bestDiff) {
      bestDiff = exactDiff;
      bestResult = { ...displayedSimulation, marginPercent };
    }

    if (exactSimulation.pbComIpi < targetGrossPrice) {
      low = marginPercent;
    } else {
      high = marginPercent;
    }
  }

  if (!bestResult) {
    return { error: 'Não foi possível estimar a margem para o preço bruto informado.' };
  }

  return {
    ...bestResult,
    marginPercent: normalizeDisplayedMarginPercent(bestResult.marginPercent),
  };
};

export const calculateNetPriceFromGrossPrice = ({
  grossPrice,
  pisRate,
  cofinsRate,
  icmsRate,
  ipiRate = 0,
}) => {
  const grossNumeric = Number(grossPrice || 0);
  const grossWithoutIpi = grossNumeric / (1 + ipiRate);
  const { fatorImp } = calculatePricingFactors({ pisRate, cofinsRate, icmsRate });

  if (grossNumeric <= 0 || fatorImp <= 0 || grossWithoutIpi <= 0) {
    return { error: 'Não foi possível calcular com as alíquotas atuais.' };
  }

  const netPrice = grossWithoutIpi * fatorImp;
  return {
    grossWithoutIpi,
    netPrice,
  };
};

export const calculateGrossPriceFromNetPrice = ({
  netPrice,
  pisRate,
  cofinsRate,
  icmsRate,
  ipiRate = 0,
}) => {
  const netNumeric = Number(netPrice || 0);
  const { fatorImp } = calculatePricingFactors({ pisRate, cofinsRate, icmsRate });

  if (netNumeric <= 0 || fatorImp <= 0) {
    return { error: 'Não foi possível calcular com as alíquotas atuais.' };
  }

  const grossWithoutIpi = netNumeric / fatorImp;
  const grossPrice = grossWithoutIpi * (1 + ipiRate);
  return {
    grossWithoutIpi,
    grossPrice,
  };
};

export const calculateMarginFromGrossPrice = ({
  grossPrice,
  cost,
  pisRate,
  cofinsRate,
  icmsRate,
  ipiRate = 0,
}) => {
  const netResult = calculateNetPriceFromGrossPrice({
    grossPrice,
    pisRate,
    cofinsRate,
    icmsRate,
    ipiRate,
  });

  if (netResult.error) {
    return netResult;
  }

  const netPrice = netResult.netPrice;
  const costNumeric = Number(cost || 0);
  const marginRate = netPrice > 0 ? (netPrice - costNumeric) / netPrice : 0;

  return {
    ...netResult,
    marginRate,
    marginPercent: marginRate * 100,
  };
};
