import * as XLSX from 'xlsx';
import {
  resolveRetailLink,
  chaveCodigo,
  chaveAlias,
  normalizarNomeSite,
} from '../utils/retailMatching';
import {
  parseDataColeta as parseDataColetaFromLib,
  formatarDataColetaBr,
} from '../lib/importRetail/parseDataColeta';

const MOEDA_DEFAULT = 'BRL';

const COLUNAS_OBRIGATORIAS = ['cliente', 'nome_site', 'preco_ponta', 'data_coleta'];

const COLUNAS_ESPERADAS = [
  'cliente',
  'codigo_datasul',
  'nome_site',
  'preco_ponta',
  'moeda',
  'data_coleta',
  'fonte',
];

function normalizarCabecalho(chave) {
  if (chave == null) return '';
  return normalizarNomeSite(String(chave)).replace(/\s+/g, '_');
}

function mapearColunas(headerRow) {
  const mapa = {};
  if (!Array.isArray(headerRow)) return mapa;
  for (let i = 0; i < headerRow.length; i++) {
    const original = headerRow[i];
    const norm = normalizarCabecalho(original);
    if (!norm) continue;
    if (COLUNAS_ESPERADAS.includes(norm)) {
      mapa[norm] = i;
    }
  }
  return mapa;
}

function colunasObrigatoriasAusentes(mapa) {
  return COLUNAS_OBRIGATORIAS.filter((c) => !(c in mapa));
}

export function parsePrecoPonta(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : NaN;
  }
  if (valor == null) return NaN;
  if (typeof valor !== 'string') return NaN;

  let s = valor;
  s = s.replace(/[^\d.,-]/g, '');
  if (s === '') return NaN;

  const qtdVirgulas = (s.match(/,/g) || []).length;
  const qtdPontos = (s.match(/\./g) || []).length;
  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');

  if (qtdVirgulas > 1 && qtdPontos === 0) {
    return NaN;
  }

  if (qtdVirgulas > 0 && qtdPontos > 0) {
    if (ultimaVirgula > ultimoPonto) {
      const partes = s.split(',');
      if (partes.length !== 2) return NaN;
      const aposVirgula = partes[1];
      if (aposVirgula.length === 0 || aposVirgula.length > 2) return NaN;
      if (!/^\d{3}$/.test(partes[0].split('.').slice(-1)[0]) || partes[0].split('.').some((p, i) => i > 0 && p.length !== 3)) return NaN;
      const antesVirgula = partes[0].replace(/\./g, '');
      if (antesVirgula === '') return NaN;
      const limpo = antesVirgula + '.' + aposVirgula;
      const n = Number(limpo);
      return Number.isFinite(n) ? n : NaN;
    }
    return NaN;
  }

  if (qtdVirgulas === 1 && qtdPontos === 0) {
    const [antes, depois] = s.split(',');
    if (depois.length === 0 || depois.length > 2) return NaN;
    if (antes === '') {
      const n = Number('0.' + depois);
      return Number.isFinite(n) ? n : NaN;
    }
    const n = Number(antes + '.' + depois);
    return Number.isFinite(n) ? n : NaN;
  }

  if (qtdVirgulas === 0 && qtdPontos >= 1) {
    if (qtdPontos > 1) return NaN;
    const [antes, depois] = s.split('.');
    if (depois.length === 0) return NaN;
    if (depois.length >= 3) return NaN;
    const n = Number(antes + '.' + depois);
    return Number.isFinite(n) ? n : NaN;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function parseDataColeta(valor) {
  return parseDataColetaFromLib(valor);
}

export async function lerArquivoPonta(file) {
  if (!file) {
    return {
      linhas: [],
      erros: ['Arquivo não fornecido'],
    };
  }

  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (e) {
    return {
      linhas: [],
      erros: [`Formato ilegível: ${e && e.message ? e.message : String(e)}`],
    };
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch (e) {
    return {
      linhas: [],
      erros: [`Formato ilegível: ${e && e.message ? e.message : String(e)}`],
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { linhas: [], erros: ['Arquivo vazio (sem planilhas)'] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (!rows || rows.length === 0) {
    return { linhas: [], erros: ['Arquivo vazio'] };
  }

  const headerRow = rows[0];
  const mapa = mapearColunas(headerRow);
  const ausentes = colunasObrigatoriasAusentes(mapa);
  if (ausentes.length > 0) {
    return {
      linhas: [],
      erros: [`Cabeçalho obrigatório ausente: ${ausentes.join(', ')}`],
    };
  }

  const linhas = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const obj = {};
    for (const colNorm of Object.keys(mapa)) {
      const idx = mapa[colNorm];
      obj[colNorm] = row[idx] ?? null;
    }
    const temConteudo = Object.values(obj).some(
      (v) => v != null && (v instanceof Date ? true : String(v).trim() !== ''),
    );
    if (!temConteudo) continue;
    linhas.push({
      ...obj,
      linhaArquivo: i + 1,
    });
  }

  if (linhas.length === 0) {
    return { linhas: [], erros: ['Arquivo sem linhas de dados (apenas cabeçalho)'] };
  }

  return { linhas, erros: [] };
}

function normalizarMoedaCampo(moeda) {
  if (moeda == null) return MOEDA_DEFAULT;
  const s = String(moeda).trim().toUpperCase();
  return s === '' ? MOEDA_DEFAULT : s;
}

function obterHojeIso() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function dataAnterior2020(dataIso) {
  if (!dataIso) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso);
  if (!m) return false;
  return Number(m[1]) < 2020;
}

function dataFuturaRelativa(dataIso, hojeIso) {
  if (!dataIso || !hojeIso) return false;
  return dataIso > hojeIso;
}

export function prepararLote({
  linhas,
  codigosDaBase,
  aliases,
  clientesPorNome,
  hojeIso,
} = {}) {
  const arr = Array.isArray(linhas) ? linhas : [];
  const clientesMap = clientesPorNome instanceof Map ? clientesPorNome : new Map();
  const codigosSet = codigosDaBase instanceof Set ? codigosDaBase : new Set();
  const aliasesMap = aliases instanceof Map ? aliases : new Map();
  const referenciaHoje = typeof hojeIso === 'string' && hojeIso.length > 0
    ? hojeIso
    : obterHojeIso();

  return arr.map((linha, idx) => {
    const linhaArquivo =
      linha && typeof linha.linhaArquivo === 'number' ? linha.linhaArquivo : idx + 2;
    const clienteNome = linha ? linha.cliente : null;
    const nomeSite = linha ? linha.nome_site : null;
    const datasulCodeInformado = linha ? linha.codigo_datasul : null;
    const moeda = normalizarMoedaCampo(linha ? linha.moeda : null);
    const fonte = linha ? linha.fonte : null;

    const errosLinha = [];
    const avisosLinha = [];

    const clienteNorm = normalizarNomeSite(clienteNome);
    let clientId = null;
    if (clienteNorm === '' || !clientesMap.has(clienteNorm)) {
      if (clienteNorm !== '') {
        errosLinha.push(`Cliente não encontrado: ${String(clienteNome)}`);
      } else {
        errosLinha.push('Cliente não informado');
      }
    } else {
      clientId = clientesMap.get(clienteNorm);
    }

    const precoPonta = parsePrecoPonta(linha ? linha.preco_ponta : null);
    if (!Number.isFinite(precoPonta) || precoPonta <= 0) {
      errosLinha.push(`Preço de ponta inválido: ${String(linha ? linha.preco_ponta : '')}`);
    }

    const dataColeta = parseDataColeta(linha ? linha.data_coleta : null);
    if (dataColeta == null) {
      errosLinha.push(`Data de coleta inválida: ${String(linha ? linha.data_coleta : '')}`);
    } else {
      if (dataAnterior2020(dataColeta)) {
        errosLinha.push(
          `Data de coleta anterior a 2020 (${formatarDataColetaBr(dataColeta)}). Verifique se não houve erro de digitação.`,
        );
      } else if (dataFuturaRelativa(dataColeta, referenciaHoje)) {
        avisosLinha.push(
          `Data de coleta futura (${formatarDataColetaBr(dataColeta)}). Importação permitida; confira antes de confirmar.`,
        );
      }
    }

    const vinculo = resolveRetailLink({
      linha: {
        clientId,
        datasulCode: datasulCodeInformado,
        nomeSite,
      },
      codigosDaBase: codigosSet,
      aliases: aliasesMap,
    });

    return {
      linhaArquivo,
      clienteNome: clienteNome == null ? null : String(clienteNome).trim(),
      clientId,
      nomeSite: nomeSite == null ? null : String(nomeSite),
      datasulCodeInformado:
        datasulCodeInformado == null ? null : String(datasulCodeInformado).trim(),
      precoPonta: Number.isFinite(precoPonta) && precoPonta > 0 ? precoPonta : null,
      moeda,
      dataColeta,
      dataColetaBr: formatarDataColetaBr(dataColeta),
      fonte: fonte == null || String(fonte).trim() === '' ? null : String(fonte).trim(),
      vinculo,
      errosLinha,
      avisosLinha,
    };
  });
}

