export const VINCULO_STATUS = {
  POR_CODIGO: 'vinculado_por_codigo',
  POR_ALIAS: 'vinculado_por_alias',
  PENDENTE: 'pendente',
};

export const VINCULO_MOTIVO = {
  SEM_CLIENTE: 'cliente_nao_identificado',
  CODIGO_INEXISTENTE: 'codigo_nao_encontrado_no_cliente',
  SEM_CODIGO_SEM_ALIAS: 'sem_codigo_e_sem_alias',
  SEM_NOME_SITE: 'nome_site_ausente',
};

export function normalizarNomeSite(nome) {
  if (nome == null) return '';
  if (typeof nome !== 'string') return '';
  const semAcentos = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return semAcentos
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function chaveCodigo(clientId, code) {
  const codeNorm = (code == null ? '' : String(code)).trim().toUpperCase();
  return `${clientId}|${codeNorm}`;
}

export function chaveAlias(clientId, nomeSite) {
  return `${clientId}|${normalizarNomeSite(nomeSite)}`;
}

function trimUpper(str) {
  if (str == null) return '';
  return String(str).trim().toUpperCase();
}

export function resolveRetailLink({ linha, codigosDaBase, aliases } = {}) {
  const { clientId, datasulCode, nomeSite } = linha || {};

  if (clientId == null || (typeof clientId === 'string' && clientId.trim() === '')) {
    return {
      status: VINCULO_STATUS.PENDENTE,
      datasulCode: null,
      motivo: VINCULO_MOTIVO.SEM_CLIENTE,
      origem: null,
    };
  }

  if (normalizarNomeSite(nomeSite) === '') {
    return {
      status: VINCULO_STATUS.PENDENTE,
      datasulCode: null,
      motivo: VINCULO_MOTIVO.SEM_NOME_SITE,
      origem: null,
    };
  }

  const codigoNorm = trimUpper(datasulCode);
  if (codigoNorm !== '') {
    const chave = chaveCodigo(clientId, codigoNorm);
    if (codigosDaBase && codigosDaBase.has(chave)) {
      return {
        status: VINCULO_STATUS.POR_CODIGO,
        datasulCode: codigoNorm,
        motivo: null,
        origem: 'planilha',
      };
    }
    return {
      status: VINCULO_STATUS.PENDENTE,
      datasulCode: null,
      motivo: VINCULO_MOTIVO.CODIGO_INEXISTENTE,
      origem: null,
    };
  }

  const chaveA = chaveAlias(clientId, nomeSite);
  if (aliases && aliases.has(chaveA)) {
    const codigoAlias = aliases.get(chaveA);
    const chaveAliasNaBase = chaveCodigo(clientId, codigoAlias);
    if (codigosDaBase && codigosDaBase.has(chaveAliasNaBase)) {
      return {
        status: VINCULO_STATUS.POR_ALIAS,
        datasulCode: trimUpper(codigoAlias),
        motivo: null,
        origem: 'alias',
      };
    }
    return {
      status: VINCULO_STATUS.PENDENTE,
      datasulCode: null,
      motivo: VINCULO_MOTIVO.CODIGO_INEXISTENTE,
      origem: null,
    };
  }

  return {
    status: VINCULO_STATUS.PENDENTE,
    datasulCode: null,
    motivo: VINCULO_MOTIVO.SEM_CODIGO_SEM_ALIAS,
    origem: null,
  };
}

export function resumirLote(resultados) {
  const arr = Array.isArray(resultados) ? resultados : [];
  const total = arr.length;
  let porCodigo = 0;
  let porAlias = 0;
  let pendentes = 0;
  let invalidos = 0;
  for (const r of arr) {
    const valido = r && typeof r === 'object' && 'status' in r;
    if (!valido) {
      invalidos++;
      continue;
    }
    switch (r.status) {
      case VINCULO_STATUS.POR_CODIGO:
        porCodigo++;
        break;
      case VINCULO_STATUS.POR_ALIAS:
        porAlias++;
        break;
      default:
        pendentes++;
        break;
    }
  }
  const podeCommitar = total > 0 && pendentes === 0 && invalidos === 0;
  return { total, porCodigo, porAlias, pendentes, invalidos, podeCommitar };
}
