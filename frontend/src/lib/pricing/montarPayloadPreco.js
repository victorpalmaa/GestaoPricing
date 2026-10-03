function parseNumero(valor, casasDecimais = null) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null;
    if (casasDecimais != null) {
      return Number(valor.toFixed(casasDecimais));
    }
    return valor;
  }
  if (typeof valor === 'string') {
    const s = valor.trim();
    if (s === '') return null;
    const normalizado = s.replace(',', '.');
    const n = Number(normalizado);
    if (!Number.isFinite(n)) return null;
    if (casasDecimais != null) {
      return Number(n.toFixed(casasDecimais));
    }
    return n;
  }
  return null;
}

function parseMacoPct(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string' && valor.trim() === '') return null;
  const n = parseNumero(valor, 2);
  if (n === null) return null;
  if (n < -100 || n > 100) return n;
  return n;
}

export function montarPayloadPreco(params = {}) {
  const {
    modo = 'nacional',
    cliente = '',
    sku = '',
    category = '',
    subcategory = '',
    pricingId = '',
    precoLiquido = null,
    precoBruto = null,
    precoBRL = null,
    precoUSD = null,
    ptax = null,
    margemBruta = null,
    macoPct = null,
    volume = null,
    status = null,
    originType = null,
  } = params;

  const mercado = modo === 'exportacao' ? 'exportacao' : 'nacional';

  let precoliquido = null;
  let precobruto = null;
  let preco_usd = null;
  let ptax_valor = null;

  if (mercado === 'exportacao') {
    const brl = parseNumero(precoBRL, 2);
    const usd = parseNumero(precoUSD, 2);
    const tx = parseNumero(ptax, 4);
    precoliquido = brl;
    precobruto = brl;
    preco_usd = usd;
    ptax_valor = tx;
  } else {
    precoliquido = parseNumero(precoLiquido, 2);
    precobruto = parseNumero(precoBruto, 2);
    preco_usd = null;
    ptax_valor = null;
  }

  return {
    cliente: cliente == null ? '' : String(cliente),
    sku: sku == null ? '' : String(sku),
    category: category == null ? '' : String(category),
    subcategory: subcategory == null ? '' : String(subcategory),
    pricingid: pricingId == null ? '' : String(pricingId),
    precoliquido,
    precobruto,
    margembruta: parseNumero(margemBruta, 1),
    maco_pct: parseMacoPct(macoPct),
    volume: parseNumero(volume) != null ? Math.trunc(parseNumero(volume)) : null,
    status: status || null,
    origin_type: (originType && String(originType).trim() !== '') ? String(originType) : null,
    mercado,
    preco_usd,
    ptax: ptax_valor,
  };
}

export function validarMacoPct(macoPct, isEditSemMacoAnterior = false) {
  const n = parseMacoPct(macoPct);
  if (n === null) {
    if (isEditSemMacoAnterior) return { valido: true, erro: null };
    return { valido: false, erro: 'MACO % é obrigatório.' };
  }
  if (n < -100 || n > 100) {
    return { valido: false, erro: 'MACO % deve estar entre -100 e 100.' };
  }
  return { valido: true, erro: null };
}
