export const PTAX = 4.63;

export const CANAL_REFERENCIA = 'Site próprio';

export const MARKUP_PONTA_FAIXA_MIN = 1.5;
export const MARKUP_PONTA_FAIXA_MAX = 15;

function parseNumero(valor) {
  if (valor === null || valor === undefined) return NaN;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  if (typeof valor === 'string') {
    const s = valor.trim();
    if (s === '') return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function normalizarMoeda(moeda) {
  if (moeda == null) return 'BRL';
  if (typeof moeda !== 'string') return null;
  const s = moeda.trim().toUpperCase();
  return s === '' ? 'BRL' : s;
}

function converterParaBRL(valor, moeda) {
  if (moeda === 'BRL') return valor;
  if (moeda === 'USD') return valor * PTAX;
  return null;
}

export function calcularMarkupPonta(precoPonta, precoBruto, moedaPonta, moedaBruto) {
  const pPonta = parseNumero(precoPonta);
  const pBruto = parseNumero(precoBruto);
  if (!Number.isFinite(pPonta) || pPonta <= 0) return null;
  if (!Number.isFinite(pBruto) || pBruto <= 0) return null;

  const mPonta = normalizarMoeda(moedaPonta);
  const mBruto = normalizarMoeda(moedaBruto);
  if (mPonta === null || mBruto === null) return null;

  const pontaBRL = converterParaBRL(pPonta, mPonta);
  const brutoBRL = converterParaBRL(pBruto, mBruto);
  if (pontaBRL == null || brutoBRL == null || !Number.isFinite(pontaBRL) || !Number.isFinite(brutoBRL) || brutoBRL <= 0) {
    return null;
  }

  return pontaBRL / brutoBRL;
}

export function moedasDivergem(moedaPonta, moedaBruto) {
  const mPonta = normalizarMoeda(moedaPonta);
  const mBruto = normalizarMoeda(moedaBruto);
  if (!mPonta || !mBruto) return false;
  return mPonta !== mBruto;
}

export function markupPontaForaDaFaixa(markup) {
  const m = parseNumero(markup);
  if (!Number.isFinite(m)) return false;
  return m < MARKUP_PONTA_FAIXA_MIN || m > MARKUP_PONTA_FAIXA_MAX;
}

function compararColetaDesc(a, b) {
  const ca = a.collected_at ? new Date(a.collected_at).getTime() : 0;
  const cb = b.collected_at ? new Date(b.collected_at).getTime() : 0;
  if (cb !== ca) return cb - ca;
  const ca2 = a.created_at ? new Date(a.created_at).getTime() : 0;
  const cb2 = b.created_at ? new Date(b.created_at).getTime() : 0;
  return cb2 - ca2;
}

export function selecionarColetaReferencia(coletas) {
  if (!Array.isArray(coletas) || coletas.length === 0) return null;
  const referenciais = coletas.filter(
    (c) => c && c.source && String(c.source).trim() === CANAL_REFERENCIA
  );
  if (referenciais.length === 0) return null;
  const ordenadas = [...referenciais].sort(compararColetaDesc);
  return ordenadas[0];
}

export function selecionarTodasColetasPorChave(coletas) {
  if (!Array.isArray(coletas) || coletas.length === 0) return new Map();
  const porChave = new Map();
  for (const c of coletas) {
    if (!c || !c.client_id || !c.datasul_code) continue;
    const chave = `${String(c.client_id)}::${String(c.datasul_code).trim().toUpperCase()}`;
    if (!porChave.has(chave)) porChave.set(chave, []);
    porChave.get(chave).push(c);
  }
  const resultado = new Map();
  for (const [chave, arr] of porChave.entries()) {
    resultado.set(chave, [...arr].sort(compararColetaDesc));
  }
  return resultado;
}

export function normalizarCategoria(categoria) {
  if (categoria === null || categoria === undefined) return { chave: 'SEM_CATEGORIA', rotulo: 'Sem categoria' };
  const str = String(categoria);
  const trim = str.trim();
  if (trim === '') return { chave: 'SEM_CATEGORIA', rotulo: 'Sem categoria' };
  return { chave: trim.toLowerCase(), rotulo: trim };
}

function calcularMediana(valores) {
  if (!Array.isArray(valores) || valores.length === 0) return null;
  const ordenados = [...valores].filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const n = ordenados.length;
  if (n === 0) return null;
  const meio = Math.floor(n / 2);
  if (n % 2 === 1) return ordenados[meio];
  return (ordenados[meio - 1] + ordenados[meio]) / 2;
}

export function agregarMarkupPontaPorCategoria(linhas) {
  if (!Array.isArray(linhas) || linhas.length === 0) return [];
  const porCategoria = new Map();
  for (const linha of linhas) {
    if (!linha) continue;
    const { chave, rotulo } = normalizarCategoria(linha.categoria);
    if (!porCategoria.has(chave)) {
      porCategoria.set(chave, {
        categoria: rotulo,
        skusComPonta: 0,
        skusTotal: 0,
        markupsValidos: [],
      });
    }
    const bucket = porCategoria.get(chave);
    bucket.skusTotal += 1;
    const markupNum = parseNumero(linha.markupPonta);
    if (Number.isFinite(markupNum) && markupNum > 0) {
      bucket.skusComPonta += 1;
      bucket.markupsValidos.push(markupNum);
    }
  }
  const resultado = [];
  for (const bucket of porCategoria.values()) {
    const n = bucket.markupsValidos.length;
    const soma = bucket.markupsValidos.reduce((acc, v) => acc + v, 0);
    resultado.push({
      categoria: bucket.categoria,
      skusComPonta: bucket.skusComPonta,
      skusTotal: bucket.skusTotal,
      markupMedio: n > 0 ? soma / n : null,
      markupMediano: calcularMediana(bucket.markupsValidos),
    });
  }
  return resultado;
}

export function formatarMarkupPonta(valor) {
  const n = parseNumero(valor);
  if (!Number.isFinite(n) || n <= 0) return '-';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
