const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isWithinTolerance = (left, right, tolerance) => (
  Math.abs(left - right) <= tolerance
);

const PIS_RATE_PADRAO = 0.0165;
const COFINS_RATE_PADRAO = 0.076;

export const parseVbaVersaoLabel = (versaoRaw, volumeColuna) => {
  const versao = String(versaoRaw || '').trim();
  const match = versao.match(/^(.*?)\s*\((\d+)\s*K\)\s*$/i);

  if (!match) {
    return {
      skuLimpo: versao,
      volumeExtraido: null,
      bateComVolume: null,
    };
  }

  const skuLimpo = String(match[1] || '').trim();
  const volumeExtraido = Number(match[2]) * 1000;

  return {
    skuLimpo,
    volumeExtraido,
    bateComVolume: volumeExtraido === Number(volumeColuna),
  };
};

export const reconcileVbaCatalogRow = ({
  custoMp,
  custoEmb,
  custoPerda,
  custoGgf,
  custoMod,
  freteValor,
  encargoValor,
  comissaoValor,
  impostosValor,
  custoTotal,
  precoLiq,
  precoBruto,
  margemInformada,
  tolerance = 0.01,
}) => {
  const values = {
    custoMp: toFiniteNumber(custoMp),
    custoEmb: toFiniteNumber(custoEmb),
    custoPerda: toFiniteNumber(custoPerda),
    custoGgf: toFiniteNumber(custoGgf),
    custoMod: toFiniteNumber(custoMod),
    freteValor: toFiniteNumber(freteValor),
    encargoValor: toFiniteNumber(encargoValor),
    comissaoValor: toFiniteNumber(comissaoValor),
    impostosValor: toFiniteNumber(impostosValor),
    custoTotal: toFiniteNumber(custoTotal),
    precoLiq: toFiniteNumber(precoLiq),
    precoBruto: toFiniteNumber(precoBruto),
    margemInformada: margemInformada === null || margemInformada === undefined || margemInformada === ''
      ? null
      : toFiniteNumber(margemInformada),
  };

  const errors = [];
  const blockingErrors = [];

  Object.entries(values).forEach(([key, value]) => {
    if (key === 'margemInformada') return;
    if (value === null) {
      blockingErrors.push(`${key} inválido para reconciliação.`);
    }
  });

  if (values.margemInformada === null && margemInformada !== null && margemInformada !== undefined && margemInformada !== '') {
    blockingErrors.push('margemInformada inválida para reconciliação.');
  }

  if (blockingErrors.length > 0) {
    return {
      ok: false,
      errors: blockingErrors,
      derived: null,
    };
  }

  const custoTotalCalc = values.custoMp
    + values.custoEmb
    + values.custoPerda
    + values.custoGgf
    + values.custoMod;

  if (!isWithinTolerance(custoTotalCalc, values.custoTotal, tolerance)) {
    blockingErrors.push(
      `custoTotal divergente: calculado ${custoTotalCalc} vs informado ${values.custoTotal}.`
    );
  }

  const precoLiqCalc = values.precoBruto - values.impostosValor;

  if (!isWithinTolerance(precoLiqCalc, values.precoLiq, tolerance)) {
    blockingErrors.push(
      `precoLiq divergente: calculado ${precoLiqCalc} vs informado ${values.precoLiq}.`
    );
  }

  if (values.precoBruto === 0) {
    blockingErrors.push('precoBruto deve ser diferente de zero para derivar taxas.');
  }

  const fatorImp = values.precoBruto === 0
    ? null
    : values.precoLiq / values.precoBruto;

  if (fatorImp === 0) {
    blockingErrors.push('fatorImp zerado impede o regrossamento do encargo.');
  }

  const precoBrutoBase = fatorImp === null || fatorImp === 0
    ? null
    : values.precoBruto - (values.encargoValor / fatorImp);

  if (precoBrutoBase !== null && !Number.isFinite(precoBrutoBase)) {
    blockingErrors.push('precoBrutoBase inválido após regrossamento do encargo.');
  }

  if (precoBrutoBase === 0) {
    blockingErrors.push('precoBrutoBase zerado impede o cálculo da margem.');
  }

  const comissaoRate = values.precoBruto === 0 ? null : values.comissaoValor / values.precoBruto;
  const freteRate = values.precoBruto === 0 ? null : values.freteValor / values.precoBruto;
  const encargoRate = precoBrutoBase === null || precoBrutoBase === 0
    ? null
    : values.encargoValor / precoBrutoBase;
  const pisRate = PIS_RATE_PADRAO;
  const cofinsRate = COFINS_RATE_PADRAO;
  const s = PIS_RATE_PADRAO + COFINS_RATE_PADRAO;
  const icmsRate = fatorImp === null ? null : (1 - s - fatorImp) / (1 - s);
  const margemCalc = fatorImp === null || fatorImp === 0 || precoBrutoBase === null || precoBrutoBase === 0
    ? null
    : 1 - ((comissaoRate + freteRate + (values.custoTotal / precoBrutoBase)) / fatorImp);

  if (values.margemInformada !== null && margemCalc !== null && !isWithinTolerance(margemCalc, values.margemInformada, 0.001)) {
    blockingErrors.push(
      `margem divergente: calculada ${margemCalc} vs informada ${values.margemInformada}.`
    );
  }

  if (encargoRate !== null && (encargoRate < -0.02 || encargoRate > 0.3)) {
    errors.push(`encargoRate fora da faixa esperada: ${encargoRate}.`);
  }

  if (icmsRate !== null && (icmsRate < 0 || icmsRate > 0.2)) {
    errors.push(`icmsRate fora da faixa esperada: ${icmsRate}.`);
  }

  errors.push(...blockingErrors);

  return {
    ok: blockingErrors.length === 0,
    errors,
    derived: {
      custoTotalCalc,
      precoLiqCalc,
      fatorImp,
      pisRate,
      cofinsRate,
      comissaoRate,
      freteRate,
      precoBrutoBase,
      encargoRate,
      icmsRate,
      margemCalc,
    },
  };
};
