export const MOEDA_PADRAO = 'BRL';

export const MARKUP_TIERS = [
  { min: 4.1, tier: 'alto'  },
  { min: 2.6, tier: 'medio' },
  { min: 0.0, tier: 'baixo' },
];

export const MARKUP_STATUS = {
  OK: 'ok',
  SEM_PONTA: 'sem_ponta',
  PONTA_INVALIDA: 'ponta_invalida',
  PRO_INVALIDO: 'pro_invalido',
  MOEDA_INVALIDA: 'moeda_invalida',
  MOEDA_DIVERGENTE: 'moeda_divergente',
};

function parseNumero(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : NaN;
  }
  if (typeof valor === 'string') {
    const parseado = Number(valor);
    return Number.isFinite(parseado) ? parseado : NaN;
  }
  return NaN;
}

function analisarMoeda(moeda) {
  if (moeda == null) {
    return { valida: true, normalizada: MOEDA_PADRAO };
  }
  if (typeof moeda === 'string') {
    const tratada = moeda.trim().toUpperCase();
    return {
      valida: true,
      normalizada: tratada === '' ? MOEDA_PADRAO : tratada,
    };
  }
  return { valida: false };
}

export function resolveMarkupTier(markup) {
  const m = parseNumero(markup);
  if (!Number.isFinite(m) || m <= 0) return null;
  for (const tier of MARKUP_TIERS) {
    if (m >= tier.min) return tier.tier;
  }
  return null;
}

export function formatMarkup(markup) {
  const m = parseNumero(markup);
  if (!Number.isFinite(m) || m <= 0) return null;
  return m.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + 'x';
}

export function calculateMarkup(args = {}) {
  const { precoPro, moedaPro, precoPonta, moedaPonta } = args;

  if (precoPonta == null || (typeof precoPonta === 'string' && precoPonta.trim() === '')) {
    return {
      status: MARKUP_STATUS.SEM_PONTA,
      markup: null,
      tier: null,
      moeda: null,
      detalhe: null,
    };
  }

  const pontaNum = parseNumero(precoPonta);
  if (!Number.isFinite(pontaNum) || pontaNum <= 0) {
    return {
      status: MARKUP_STATUS.PONTA_INVALIDA,
      markup: null,
      tier: null,
      moeda: null,
      detalhe: { precoPonta },
    };
  }

  const proNum = parseNumero(precoPro);
  if (!Number.isFinite(proNum) || proNum <= 0) {
    return {
      status: MARKUP_STATUS.PRO_INVALIDO,
      markup: null,
      tier: null,
      moeda: null,
      detalhe: { precoPro },
    };
  }

  const analisePro = analisarMoeda(moedaPro);
  const analisePonta = analisarMoeda(moedaPonta);
  if (!analisePro.valida || !analisePonta.valida) {
    return {
      status: MARKUP_STATUS.MOEDA_INVALIDA,
      markup: null,
      tier: null,
      moeda: null,
      detalhe: { moedaPro, moedaPonta },
    };
  }

  const moedaProNorm = analisePro.normalizada;
  const moedaPontaNorm = analisePonta.normalizada;
  if (moedaProNorm !== moedaPontaNorm) {
    return {
      status: MARKUP_STATUS.MOEDA_DIVERGENTE,
      markup: null,
      tier: null,
      moeda: null,
      detalhe: { moedaPro: moedaProNorm, moedaPonta: moedaPontaNorm },
    };
  }

  const markup = pontaNum / proNum;
  return {
    status: MARKUP_STATUS.OK,
    markup,
    tier: resolveMarkupTier(markup),
    moeda: moedaProNorm,
    detalhe: null,
  };
}
