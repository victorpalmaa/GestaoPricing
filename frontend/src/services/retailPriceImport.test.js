import {
  parsePrecoPonta,
  parseDataColeta,
  prepararLote,
} from './retailPriceImport';
import {
  chaveCodigo,
  chaveAlias,
} from '../utils/retailMatching';

function fixtures() {
  const clientesPorNome = new Map([
    ['cliente a', 'CLIENTE_A'],
    ['cliente b', 'CLIENTE_B'],
  ]);
  const codigosDaBase = new Set([
    chaveCodigo('CLIENTE_A', '42781'),
    chaveCodigo('CLIENTE_A', '39120'),
  ]);
  const aliases = new Map([
    [chaveAlias('CLIENTE_A', 'Creatina Monohidratada Pote 300g'), '42781'],
  ]);
  return { clientesPorNome, codigosDaBase, aliases };
}

describe('retailPriceImport', () => {
  describe('parsePrecoPonta', () => {
    it('formato pt-BR com separador de milhar', () => {
      expect(parsePrecoPonta('1.234,56')).toBeCloseTo(1234.56, 2);
    });

    it('R$ prefixado com espaço e vírgula', () => {
      expect(parsePrecoPonta('R$ 89,90')).toBeCloseTo(89.9, 2);
    });

    it('formato en-US com ponto decimal (1-2 casas)', () => {
      expect(parsePrecoPonta('45.50')).toBeCloseTo(45.5, 2);
    });

    it('number puro', () => {
      expect(parsePrecoPonta(30)).toBe(30);
    });

    it('string inválida retorna NaN', () => {
      expect(Number.isNaN(parsePrecoPonta('abc'))).toBe(true);
    });

    it('null/undefined retornam NaN', () => {
      expect(Number.isNaN(parsePrecoPonta(null))).toBe(true);
      expect(Number.isNaN(parsePrecoPonta(undefined))).toBe(true);
    });

    it('símbolo US$ com espaço e 2 decimais', () => {
      expect(parsePrecoPonta('US$ 199.99')).toBeCloseTo(199.99, 2);
    });

    it('apenas separador decimal pt-BR, sem milhar', () => {
      expect(parsePrecoPonta('15,50')).toBeCloseTo(15.5, 2);
    });

    it('número com muitos separadores de milhar pt-BR', () => {
      expect(parsePrecoPonta('1.234.567,89')).toBeCloseTo(1234567.89, 2);
    });

    it('"R$ 1.234,56" continua válido após restrição', () => {
      expect(parsePrecoPonta('R$ 1.234,56')).toBeCloseTo(1234.56, 2);
    });

    it('"1,234.56" (vírgula antes do ponto = notação US) → NaN', () => {
      expect(Number.isNaN(parsePrecoPonta('1,234.56'))).toBe(true);
    });

    it('"1.234" (só ponto com 3 dígitos depois) ambíguo → NaN', () => {
      expect(Number.isNaN(parsePrecoPonta('1.234'))).toBe(true);
    });

    it('"1.234.567" só pontos múltiplos → NaN', () => {
      expect(Number.isNaN(parsePrecoPonta('1.234.567'))).toBe(true);
    });

    it('"1.2" e "1.23" único ponto com 1-2 decimais → válido', () => {
      expect(parsePrecoPonta('1.2')).toBeCloseTo(1.2, 2);
      expect(parsePrecoPonta('1.23')).toBeCloseTo(1.23, 2);
    });

    it('"12.345,67" milhar curto + decimal pt-BR → válido', () => {
      expect(parsePrecoPonta('12.345,67')).toBeCloseTo(12345.67, 2);
    });

    it('inteiro puro "30" → 30', () => {
      expect(parsePrecoPonta('30')).toBe(30);
    });

    it('"1,5" única vírgula com 1 casa → válido', () => {
      expect(parsePrecoPonta('1,5')).toBeCloseTo(1.5, 2);
    });

    it('múltiplas vírgulas sem ponto → NaN', () => {
      expect(Number.isNaN(parsePrecoPonta('1,23,45'))).toBe(true);
    });

    it('"1,234.567,89" mais de uma vírgula + ponto → NaN', () => {
      expect(Number.isNaN(parsePrecoPonta('1,234.567,89'))).toBe(true);
    });

    it('"45.500" (ponto com 3+ decimais, sem vírgula) → NaN', () => {
      expect(Number.isNaN(parsePrecoPonta('45.500'))).toBe(true);
    });
  });

  describe('parseDataColeta', () => {
    it('Date', () => {
      expect(parseDataColeta(new Date(2026, 7, 12))).toBe('2026-08-12');
    });

    it('string ISO aaaa-mm-dd', () => {
      expect(parseDataColeta('2026-08-12')).toBe('2026-08-12');
    });

    it('string ISO com horário retorna só a data', () => {
      expect(parseDataColeta('2026-08-12T15:30:00Z')).toBe('2026-08-12');
    });

    it('dd/mm/aaaa', () => {
      expect(parseDataColeta('12/08/2026')).toBe('2026-08-12');
    });

    it('string inválida retorna null', () => {
      expect(parseDataColeta('xx')).toBeNull();
    });

    it('null/undefined/empty → null', () => {
      expect(parseDataColeta(null)).toBeNull();
      expect(parseDataColeta(undefined)).toBeNull();
      expect(parseDataColeta('')).toBeNull();
    });

    it('data inválida de calendário → null', () => {
      expect(parseDataColeta('31/02/2026')).toBeNull();
    });

    it('dd-mm-aaaa também aceito', () => {
      expect(parseDataColeta('01-03-2026')).toBe('2026-03-01');
    });
  });

  describe('prepararLote', () => {
    const { clientesPorNome, codigosDaBase, aliases } = fixtures();

    const linha1Ok = {
      linhaArquivo: 2,
      cliente: 'Cliente A',
      codigo_datasul: '42781',
      nome_site: 'Creatina Monohidratada Pote 300g',
      preco_ponta: 'R$ 159,90',
      moeda: 'BRL',
      data_coleta: '12/08/2026',
      fonte: 'Google Shopping',
    };

    const linha2OkSemCodigo = {
      linhaArquivo: 3,
      cliente: 'Cliente A',
      codigo_datasul: '',
      nome_site: 'Creatina Monohidratada Pote 300g',
      preco_ponta: 150,
      moeda: '',
      data_coleta: '2026-08-12',
    };

    const linhaPrecoInvalido = {
      linhaArquivo: 4,
      cliente: 'Cliente A',
      codigo_datasul: '39120',
      nome_site: 'Produto X',
      preco_ponta: 'n/d',
      moeda: 'BRL',
      data_coleta: '2026-08-12',
    };

    const linhaClienteInexistente = {
      linhaArquivo: 5,
      cliente: 'Cliente Desconhecido',
      codigo_datasul: '42781',
      nome_site: 'Algum Produto',
      preco_ponta: '89,90',
      moeda: 'BRL',
      data_coleta: '12/08/2026',
    };

    const baseArgs = {
      codigosDaBase,
      aliases,
      clientesPorNome,
    };

    it('2 linhas válidas: uma por código, outra por alias', () => {
      const r = prepararLote({
        linhas: [linha1Ok, linha2OkSemCodigo],
        ...baseArgs,
      });
      expect(r).toHaveLength(2);

      expect(r[0].clienteNome).toBe('Cliente A');
      expect(r[0].clientId).toBe('CLIENTE_A');
      expect(r[0].precoPonta).toBeCloseTo(159.9, 1);
      expect(r[0].moeda).toBe('BRL');
      expect(r[0].dataColeta).toBe('2026-08-12');
      expect(r[0].fonte).toBe('Google Shopping');
      expect(r[0].errosLinha).toEqual([]);
      expect(r[0].vinculo.status).toBe('vinculado_por_codigo');
      expect(r[0].vinculo.datasulCode).toBe('42781');
      expect(r[0].vinculo.origem).toBe('planilha');

      expect(r[1].datasulCodeInformado).toBe('');
      expect(r[1].precoPonta).toBe(150);
      expect(r[1].moeda).toBe('BRL');
      expect(r[1].errosLinha).toEqual([]);
      expect(r[1].vinculo.status).toBe('vinculado_por_alias');
      expect(r[1].vinculo.datasulCode).toBe('42781');
      expect(r[1].vinculo.origem).toBe('alias');
    });

    it('1 linha com preço ilegível → errosLinha preenchido, vínculo processado mesmo assim', () => {
      const r = prepararLote({
        linhas: [linhaPrecoInvalido],
        ...baseArgs,
      });
      expect(r).toHaveLength(1);
      expect(r[0].precoPonta).toBeNull();
      expect(r[0].errosLinha.length).toBeGreaterThanOrEqual(1);
      expect(r[0].errosLinha.some((e) => /preço/i.test(e) || /preco/i.test(e))).toBe(true);
      expect(r[0].vinculo.status).toBe('vinculado_por_codigo');
      expect(r[0].vinculo.datasulCode).toBe('39120');
    });

    it('1 linha com cliente inexistente → errosLinha e vínculo SEM_CLIENTE', () => {
      const r = prepararLote({
        linhas: [linhaClienteInexistente],
        ...baseArgs,
      });
      expect(r).toHaveLength(1);
      expect(r[0].clientId).toBeNull();
      expect(r[0].errosLinha.length).toBeGreaterThanOrEqual(1);
      expect(
        r[0].errosLinha.some((e) => /cliente não encontrado/i.test(e) || /cliente/i.test(e)),
      ).toBe(true);
      expect(r[0].precoPonta).toBeCloseTo(89.9, 1);
      expect(r[0].vinculo.status).toBe('pendente');
      expect(r[0].vinculo.motivo).toBe('cliente_nao_identificado');
    });

    it('lote misto com os 4 casos', () => {
      const r = prepararLote({
        linhas: [
          linha1Ok,
          linha2OkSemCodigo,
          linhaPrecoInvalido,
          linhaClienteInexistente,
        ],
        ...baseArgs,
      });
      expect(r).toHaveLength(4);
      const [ok1, ok2, errPreco, errCliente] = r;
      expect(ok1.errosLinha).toEqual([]);
      expect(ok2.errosLinha).toEqual([]);
      expect(errPreco.errosLinha.length).toBeGreaterThan(0);
      expect(errCliente.errosLinha.length).toBeGreaterThan(0);
      expect(ok1.linhaArquivo).toBe(2);
      expect(ok2.linhaArquivo).toBe(3);
      expect(errPreco.linhaArquivo).toBe(4);
      expect(errCliente.linhaArquivo).toBe(5);
    });

    it('sem argumentos retorna array vazio', () => {
      expect(prepararLote()).toEqual([]);
      expect(prepararLote({ linhas: null })).toEqual([]);
    });

    it('linha sem linhaArquivo assume idx+2 (simula cabeçalho +1)', () => {
      const r = prepararLote({
        linhas: [{ ...linha1Ok, linhaArquivo: undefined }],
        ...baseArgs,
      });
      expect(r[0].linhaArquivo).toBe(2);
    });

    it('fonte null/empty → null no resultado', () => {
      const r = prepararLote({
        linhas: [{ ...linha2OkSemCodigo, fonte: '   ' }],
        ...baseArgs,
      });
      expect(r[0].fonte).toBeNull();
    });

    it('moeda em lowercase → uppercase no resultado, ausente → BRL', () => {
      const r = prepararLote({
        linhas: [
          { ...linha1Ok, moeda: 'usd' },
          { ...linha2OkSemCodigo, moeda: null },
        ],
        ...baseArgs,
      });
      expect(r[0].moeda).toBe('USD');
      expect(r[1].moeda).toBe('BRL');
    });

    it('data ilegível → erro de linha + dataColeta null', () => {
      const r = prepararLote({
        linhas: [{ ...linha1Ok, data_coleta: 'hoje' }],
        ...baseArgs,
      });
      expect(r[0].dataColeta).toBeNull();
      expect(r[0].errosLinha.some((e) => /data/i.test(e))).toBe(true);
    });
  });
});
