const EXCEL_EPOCH_ANO = 1899;
const EXCEL_EPOCH_MES = 11;
const EXCEL_EPOCH_DIA = 30;
const EXCEL_BISSEXTO_1900_BUG_LIMITE = 60;

function bissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function diasPorMes(ano, mes) {
  const arr = [31, bissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return arr[mes];
}

function dataValida(ano, mes, dia) {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return false;
  if (mes < 1 || mes > 12) return false;
  if (dia < 1 || dia > diasPorMes(ano, mes - 1)) return false;
  return true;
}

function formatarSaida(ano, mes, dia) {
  if (!dataValida(ano, mes, dia)) return null;
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${ano}-${mm}-${dd}`;
}

function parseSerialExcel(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  let dias = Math.floor(serial);
  if (dias < 1) return null;
  if (dias >= EXCEL_BISSEXTO_1900_BUG_LIMITE) {
    dias = dias - 1;
  }
  const msMin = Date.UTC(EXCEL_EPOCH_ANO, EXCEL_EPOCH_MES, EXCEL_EPOCH_DIA);
  const data = new Date(msMin + dias * 86400 * 1000);
  if (Number.isNaN(data.getTime())) return null;
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + 1;
  const dia = data.getUTCDate();
  return formatarSaida(ano, mes, dia);
}

function parseDateNativo(valor) {
  if (!(valor instanceof Date)) return null;
  if (Number.isNaN(valor.getTime())) return null;
  const ano = valor.getFullYear();
  const mes = valor.getMonth() + 1;
  const dia = valor.getDate();
  return formatarSaida(ano, mes, dia);
}

function parseIso(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]|$)/.exec(s);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  return formatarSaida(ano, mes, dia);
}

function expandirAno(yy) {
  if (!Number.isInteger(yy)) return null;
  if (yy < 0) return null;
  if (yy >= 100) return yy;
  return 2000 + yy;
}

function parseSlashPontosHifen(s) {
  if (typeof s !== 'string') return null;
  const trim = s.trim();
  if (trim === '') return null;
  const m = /^(\d{1,4})([\/\-\.])(\d{1,2})\2(\d{1,4})$/.exec(trim);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  const cStr = m[4];
  const c = Number(cStr);
  let dia;
  let mes;
  let ano;
  if (m[1].length === 4 && cStr.length !== 4) {
    ano = a;
    mes = b;
    dia = c;
  } else if (cStr.length === 4) {
    if (a > 12 && b <= 12) {
      dia = a;
      mes = b;
    } else if (b > 12 && a <= 12) {
      dia = b;
      mes = a;
    } else {
      dia = a;
      mes = b;
    }
    ano = expandirAno(c);
  } else {
    if (a > 12 && b <= 12) {
      dia = a;
      mes = b;
    } else if (b > 12 && a <= 12) {
      dia = b;
      mes = a;
    } else {
      dia = a;
      mes = b;
    }
    ano = expandirAno(c);
  }
  if (ano == null) return null;
  return formatarSaida(ano, mes, dia);
}

export function parseDataColeta(valor) {
  if (valor == null) return null;
  if (valor instanceof Date) return parseDateNativo(valor);
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null;
    const serial = parseSerialExcel(valor);
    if (serial != null) return serial;
    const d = new Date(valor);
    if (!Number.isNaN(d.getTime())) return parseDateNativo(d);
    return null;
  }
  if (typeof valor !== 'string') return null;
  const s = valor.trim();
  if (s === '') return null;
  const iso = parseIso(s);
  if (iso != null) return iso;
  const slash = parseSlashPontosHifen(s);
  if (slash != null) return slash;
  return null;
}

export function formatarDataColetaBr(dataIso) {
  if (!dataIso || typeof dataIso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
