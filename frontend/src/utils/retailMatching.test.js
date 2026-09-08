import {
  VINCULO_STATUS,
  VINCULO_MOTIVO,
  normalizarNomeSite,
  chaveCodigo,
  chaveAlias,
  resolveRetailLink,
  resumirLote,
} from './retailMatching';

function montarFixture() {
  const codigosDaBase = new Set([
    chaveCodigo('CLIENTE_A', '42781'),
    chaveCodigo('CLIENTE_A', '39120'),
    chaveCodigo('CLIENTE_B', '42781'),
  ]);
  const aliases = new Map();
  aliases.set(
    chaveAlias('CLIENTE_A', 'Creatina Monohidratada Pote 300g'),
    '42781',
  );
  return { codigosDaBase, aliases };
}

describe('retailMatching', () => {
  describe('constantes', () => {
    it('VINCULO_STATUS tem os valores corretos', () => {
      expect(VINCULO_STATUS).toEqual({
        POR_CODIGO: 'vinculado_por_codigo',
        POR_ALIAS: 'vinculado_por_alias',
        PENDENTE: 'pendente',
      });
    });

    it('VINCULO_MOTIVO tem os valores corretos', () => {
      expect(VINCULO_MOTIVO).toEqual({
        SEM_CLIENTE: 'cliente_nao_identificado',
        CODIGO_INEXISTENTE: 'codigo_nao_encontrado_no_cliente',
        SEM_CODIGO_SEM_ALIAS: 'sem_codigo_e_sem_alias',
        SEM_NOME_SITE: 'nome_site_ausente',
      });
    });
  });

  describe('normalizarNomeSite', () => {
    it('remove acentos, lowercase e colapsa espaços', () => {
      expect(normalizarNomeSite('  Colágeno   VERISOL 250g ')).toBe(
        'colageno verisol 250g',
      );
    });

    it('null → string vazia', () => {
      expect(normalizarNomeSite(null)).toBe('');
    });

    it('undefined → string vazia', () => {
      expect(normalizarNomeSite(undefined)).toBe('');
    });

    it('string vazia e espaços → vazia', () => {
      expect(normalizarNomeSite('')).toBe('');
      expect(normalizarNomeSite('   ')).toBe('');
    });

    it('não-string → string vazia', () => {
      expect(normalizarNomeSite(123)).toBe('');
      expect(normalizarNomeSite({})).toBe('');
    });
  });

  describe('chaveCodigo', () => {
    it('formata clientId|CODE com trim e uppercase', () => {
      expect(chaveCodigo('CLIENTE_A', '  42781b ')).toBe('CLIENTE_A|42781B');
    });

    it('code null/undefined vira vazio', () => {
      expect(chaveCodigo('C1', null)).toBe('C1|');
      expect(chaveCodigo('C1', undefined)).toBe('C1|');
    });
  });

  describe('chaveAlias', () => {
    it('aplica normalizarNomeSite', () => {
      expect(
        chaveAlias('CLIENTE_A', '  CREATINA   Monohidratada PÓTE 300g '),
      ).toBe('CLIENTE_A|creatina monohidratada pote 300g');
    });
  });

  describe('resolveRetailLink', () => {
    const { codigosDaBase, aliases } = montarFixture();

    it('código válido do próprio cliente → POR_CODIGO / origem planilha', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: '42781',
          nomeSite: 'Creatina 300g',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.POR_CODIGO);
      expect(r.datasulCode).toBe('42781');
      expect(r.motivo).toBeNull();
      expect(r.origem).toBe('planilha');
    });

    it('código "99999" inexistente → PENDENTE / CODIGO_INEXISTENTE', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: '99999',
          nomeSite: 'Creatina 300g',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.PENDENTE);
      expect(r.datasulCode).toBeNull();
      expect(r.motivo).toBe(VINCULO_MOTIVO.CODIGO_INEXISTENTE);
      expect(r.origem).toBeNull();
    });

    it('código errado + nome que TEM alias → PENDENTE (não usa alias como fallback)', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: '99999',
          nomeSite: 'Creatina Monohidratada Pote 300g',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.PENDENTE);
      expect(r.motivo).toBe(VINCULO_MOTIVO.CODIGO_INEXISTENTE);
      expect(r.datasulCode).toBeNull();
    });

    it('sem código, nome exato do alias → POR_ALIAS, datasulCode "42781"', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: null,
          nomeSite: 'Creatina Monohidratada Pote 300g',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.POR_ALIAS);
      expect(r.datasulCode).toBe('42781');
      expect(r.motivo).toBeNull();
      expect(r.origem).toBe('alias');
    });

    it('sem código, nome com caixa/acentos/espaços → POR_ALIAS (normalização)', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: '',
          nomeSite: '  CREATINA   MONOHIDRATADA POTE 300G ',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.POR_ALIAS);
      expect(r.datasulCode).toBe('42781');
      expect(r.origem).toBe('alias');
    });

    it('alias do CLIENTE_A com clientId do CLIENTE_B → PENDENTE / SEM_CODIGO_SEM_ALIAS', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_B',
          datasulCode: null,
          nomeSite: 'Creatina Monohidratada Pote 300g',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.PENDENTE);
      expect(r.motivo).toBe(VINCULO_MOTIVO.SEM_CODIGO_SEM_ALIAS);
      expect(r.datasulCode).toBeNull();
    });

    it('nome parecido sem alias ("Creatina 300g") → PENDENTE / SEM_CODIGO_SEM_ALIAS, datasulCode null', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: null,
          nomeSite: 'Creatina 300g',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.PENDENTE);
      expect(r.motivo).toBe(VINCULO_MOTIVO.SEM_CODIGO_SEM_ALIAS);
      expect(r.datasulCode).toBeNull();
    });

    it('sem clientId → PENDENTE / SEM_CLIENTE', () => {
      const r = resolveRetailLink({
        linha: { datasulCode: '42781', nomeSite: 'Creatina 300g' },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.PENDENTE);
      expect(r.motivo).toBe(VINCULO_MOTIVO.SEM_CLIENTE);
      expect(r.datasulCode).toBeNull();
    });

    it('nomeSite "  " com código válido → PENDENTE / SEM_NOME_SITE (antes do código)', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: '42781',
          nomeSite: '  ',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.PENDENTE);
      expect(r.motivo).toBe(VINCULO_MOTIVO.SEM_NOME_SITE);
      expect(r.datasulCode).toBeNull();
    });

    it('sem argumentos → PENDENTE / SEM_CLIENTE', () => {
      const r = resolveRetailLink();
      expect(r.status).toBe(VINCULO_STATUS.PENDENTE);
      expect(r.motivo).toBe(VINCULO_MOTIVO.SEM_CLIENTE);
    });

    it('alias existe mas código do alias não está na base → CODIGO_INEXISTENTE', () => {
      const codigosVazios = new Set();
      const aliasesSozinho = new Map([
        [chaveAlias('CLIENTE_A', 'Creatina Monohidratada Pote 300g'), '42781'],
      ]);
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: null,
          nomeSite: 'Creatina Monohidratada Pote 300g',
        },
        codigosDaBase: codigosVazios,
        aliases: aliasesSozinho,
      });
      expect(r.status).toBe(VINCULO_STATUS.PENDENTE);
      expect(r.motivo).toBe(VINCULO_MOTIVO.CODIGO_INEXISTENTE);
    });

    it('datasulCode lowercase com espaços → normaliza antes de buscar', () => {
      const r = resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: '  42781 ',
          nomeSite: 'Creatina',
        },
        codigosDaBase,
        aliases,
      });
      expect(r.status).toBe(VINCULO_STATUS.POR_CODIGO);
      expect(r.datasulCode).toBe('42781');
    });
  });

  describe('resumirLote', () => {
    const { codigosDaBase, aliases } = montarFixture();
    const mk = (overrides = {}) =>
      resolveRetailLink({
        linha: {
          clientId: 'CLIENTE_A',
          datasulCode: '42781',
          nomeSite: 'Creatina',
          ...overrides,
        },
        codigosDaBase,
        aliases,
      });

    it('1 pendente → podeCommitar false, invalidos 0', () => {
      const resultados = [
        mk(),
        mk({ datasulCode: null, nomeSite: 'Qualquer Coisa Sem Alias' }),
      ];
      const res = resumirLote(resultados);
      expect(res).toEqual({
        total: 2,
        porCodigo: 1,
        porAlias: 0,
        pendentes: 1,
        invalidos: 0,
        podeCommitar: false,
      });
    });

    it('sem pendentes e sem inválidos → podeCommitar true', () => {
      const resultados = [
        mk(),
        mk({ datasulCode: '39120', nomeSite: 'Outro Produto' }),
        mk({
          datasulCode: null,
          nomeSite: 'Creatina Monohidratada Pote 300g',
        }),
      ];
      const res = resumirLote(resultados);
      expect(res.total).toBe(3);
      expect(res.porCodigo).toBe(2);
      expect(res.porAlias).toBe(1);
      expect(res.pendentes).toBe(0);
      expect(res.invalidos).toBe(0);
      expect(res.podeCommitar).toBe(true);
    });

    it('lote vazio → podeCommitar false, invalidos 0', () => {
      const res = resumirLote([]);
      expect(res).toEqual({
        total: 0,
        porCodigo: 0,
        porAlias: 0,
        pendentes: 0,
        invalidos: 0,
        podeCommitar: false,
      });
    });

    it('não-array é tratado como vazio', () => {
      const rn = resumirLote(null);
      expect(rn.podeCommitar).toBe(false);
      expect(rn.invalidos).toBe(0);
      const ru = resumirLote(undefined);
      expect(ru.podeCommitar).toBe(false);
      expect(ru.invalidos).toBe(0);
    });

    it('null no array → invalidos 1, pendentes 0, podeCommitar false', () => {
      const resultados = [
        mk(),
        null,
        mk({ datasulCode: '39120', nomeSite: 'Outro Produto' }),
      ];
      const res = resumirLote(resultados);
      expect(res.total).toBe(3);
      expect(res.porCodigo).toBe(2);
      expect(res.porAlias).toBe(0);
      expect(res.pendentes).toBe(0);
      expect(res.invalidos).toBe(1);
      expect(res.podeCommitar).toBe(false);
    });

    it('objeto sem chave status → inválido (não pendente)', () => {
      const resultados = [
        mk(),
        { foo: 'bar' },
        undefined,
      ];
      const res = resumirLote(resultados);
      expect(res.total).toBe(3);
      expect(res.porCodigo).toBe(1);
      expect(res.pendentes).toBe(0);
      expect(res.invalidos).toBe(2);
      expect(res.podeCommitar).toBe(false);
    });

    it('sem pendentes mas com inválido → podeCommitar false', () => {
      const resultados = [
        mk(),
        123,
      ];
      const res = resumirLote(resultados);
      expect(res.pendentes).toBe(0);
      expect(res.invalidos).toBe(1);
      expect(res.podeCommitar).toBe(false);
    });
  });
});
