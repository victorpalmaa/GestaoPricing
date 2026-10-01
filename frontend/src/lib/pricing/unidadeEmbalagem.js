import {
  calcularMarkupPonta,
  markupPontaForaDaFaixa,
  MARKUP_PONTA_FAIXA_MIN,
  MARKUP_PONTA_FAIXA_MAX,
} from './markupPonta';

function extrairQuantidadePorEmbalagem(sku) {
  if (sku === null || sku === undefined) return null;
  const s = String(sku).trim();
  if (s === '') return null;

  const padroes = [
    /DISPLAY\s+C\/\s*(\d+)/i,
    /DISPLAY\s+COM\s+(\d+)/i,
    /DISPLAY\s*\(\s*(\d+)\s*UNI?\s*\)/i,
    /-\s*(\d+)\s*UNI?\s*$/i,
  ];

  for (const re of padroes) {
    const m = s.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isInteger(n) && n >= 1) return n;
    }
  }

  return null;
}

function avaliarConversaoPonta({
  precoPontaColetado,
  moedaPonta,
  precoBruto,
  moedaBruto,
  nomeSku,
}) {
  const resultado = {
    precoColetado:
      precoPontaColetado != null && Number.isFinite(Number(precoPontaColetado))
        ? Number(precoPontaColetado)
        : null,
    precoConvertido: null,
    fatorAplicado: null,
    qtdExtraida: null,
    markupInicial: null,
    markupFinal: null,
    markupForaFaixa: false,
    bloquear: false,
    motivoBloqueio: null,
    avisoForaFaixa: false,
  };

  if (
    resultado.precoColetado == null ||
    precoBruto == null ||
    !Number.isFinite(Number(precoBruto)) ||
    Number(precoBruto) <= 0
  ) {
    return resultado;
  }

  const precoBrutoNum = Number(precoBruto);
  resultado.markupInicial = calcularMarkupPonta(
    resultado.precoColetado,
    precoBrutoNum,
    moedaPonta,
    moedaBruto,
  );

  if (
    resultado.markupInicial != null &&
    Number.isFinite(resultado.markupInicial) &&
    resultado.markupInicial < 1
  ) {
    const qtd = extrairQuantidadePorEmbalagem(nomeSku);
    resultado.qtdExtraida = qtd;

    if (qtd != null && qtd > 1) {
      resultado.fatorAplicado = qtd;
      resultado.precoConvertido = resultado.precoColetado * qtd;
      resultado.markupFinal = calcularMarkupPonta(
        resultado.precoConvertido,
        precoBrutoNum,
        moedaPonta,
        moedaBruto,
      );
      resultado.markupForaFaixa = markupPontaForaDaFaixa(resultado.markupFinal);
      resultado.avisoForaFaixa = resultado.markupForaFaixa;
    } else {
      resultado.bloquear = true;
      resultado.motivoBloqueio =
        'Markup impossível (<1), verificar unidade de embalagem';
    }
  } else {
    resultado.precoConvertido = resultado.precoColetado;
    resultado.markupFinal = resultado.markupInicial;
    resultado.markupForaFaixa = markupPontaForaDaFaixa(resultado.markupFinal);
    resultado.avisoForaFaixa = resultado.markupForaFaixa;
  }

  return resultado;
}

export {
  extrairQuantidadePorEmbalagem,
  avaliarConversaoPonta,
  MARKUP_PONTA_FAIXA_MIN,
  MARKUP_PONTA_FAIXA_MAX,
};
