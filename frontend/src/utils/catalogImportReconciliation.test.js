import {
  parseVbaVersaoLabel,
  reconcileVbaCatalogRow,
  parseExcelDate,
  parsePercent,
} from './catalogImportReconciliation';

describe('catalogImportReconciliation', () => {
  describe('parseVbaVersaoLabel', () => {
    it('extrai SKU e volume quando a versão termina com sufixo em K', () => {
      expect(parseVbaVersaoLabel('Pré-Treino - pote 300g (5K)', 5000)).toEqual({
        skuLimpo: 'Pré-Treino - pote 300g',
        volumeExtraido: 5000,
        bateComVolume: true,
      });
    });

    it('retorna a versão inteira quando não existe sufixo em K', () => {
      expect(parseVbaVersaoLabel('Pré-Treino - pote 300g', 5000)).toEqual({
        skuLimpo: 'Pré-Treino - pote 300g',
        volumeExtraido: null,
        bateComVolume: null,
      });
    });

    it('sinaliza quando o volume extraído não bate com a coluna volume', () => {
      expect(parseVbaVersaoLabel('Pré-Treino - pote 300g (3K)', 5000)).toEqual({
        skuLimpo: 'Pré-Treino - pote 300g',
        volumeExtraido: 3000,
        bateComVolume: false,
      });
    });
  });

  describe('parseExcelDate', () => {
    it('converte serial 46234 do Excel para 2026-07-31 (valor real confirmado no XLSX)', () => {
      const result = parseExcelDate(46234);
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(6);
      expect(result.getUTCDate()).toBe(31);
    });

    it('converte serial 46244 do Excel para 2026-08-10', () => {
      const result = parseExcelDate(46244);
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(7);
      expect(result.getUTCDate()).toBe(10);
    });

    it('converte serial 46265 do Excel para 2026-08-31 (valor do serial verificado em runtime)', () => {
      const result = parseExcelDate(46265);
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(7);
      expect(result.getUTCDate()).toBe(31);
    });

    it('converte serial 46268 do Excel para 2026-09-03 (3 dias após 46265)', () => {
      const result = parseExcelDate(46268);
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(8);
      expect(result.getUTCDate()).toBe(3);
    });

    it('retorna null para string vazia sem lançar erro', () => {
      expect(() => parseExcelDate('')).not.toThrow();
      expect(parseExcelDate('')).toBe(null);
    });

    it('retorna null para valor inválido sem lançar erro', () => {
      expect(() => parseExcelDate('xyz')).not.toThrow();
      expect(parseExcelDate('xyz')).toBe(null);
    });

    it('retorna null para null e undefined sem lançar erro', () => {
      expect(() => parseExcelDate(null)).not.toThrow();
      expect(parseExcelDate(null)).toBe(null);
      expect(() => parseExcelDate(undefined)).not.toThrow();
      expect(parseExcelDate(undefined)).toBe(null);
    });

    it('retorna Date com componentes UTC iguais quando recebe Date válido', () => {
      const input = new Date(Date.UTC(2026, 7, 10, 12, 30, 45, 123));
      const result = parseExcelDate(input);
      expect(result).toBeInstanceOf(Date);
      expect(result).not.toBe(input);
      expect(result.getUTCFullYear()).toBe(input.getUTCFullYear());
      expect(result.getUTCMonth()).toBe(input.getUTCMonth());
      expect(result.getUTCDate()).toBe(input.getUTCDate());
      expect(result.getUTCHours()).toBe(input.getUTCHours());
      expect(result.getUTCMinutes()).toBe(input.getUTCMinutes());
      expect(result.getUTCSeconds()).toBe(input.getUTCSeconds());
      expect(result.getUTCMilliseconds()).toBe(input.getUTCMilliseconds());
    });

    it('retorna null para Date inválido', () => {
      const result = parseExcelDate(new Date('invalid'));
      expect(result).toBe(null);
    });

    it('parseia string ISO "2026-09-03" -> 03/09/2026 em UTC', () => {
      const result = parseExcelDate('2026-09-03');
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(8);
      expect(result.getUTCDate()).toBe(3);
    });

    it('parseia string ISO "2026-08-10" -> 10/08/2026 em UTC', () => {
      const result = parseExcelDate('2026-08-10');
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(7);
      expect(result.getUTCDate()).toBe(10);
    });

    it('parseia string "03/09/2026" (dd/mm/yyyy) -> 03/09/2026 em UTC', () => {
      const result = parseExcelDate('03/09/2026');
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(8);
      expect(result.getUTCDate()).toBe(3);
    });

    it('parseia string "09-03-26" (mm-dd-yy, originária do number_format Excel) -> 03/09/2026 em UTC', () => {
      const result = parseExcelDate('09-03-26');
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(8);
      expect(result.getUTCDate()).toBe(3);
    });

    it('parseia string "09.03.26" (separador ponto, mm-dd-yy) -> 03/09/2026 em UTC', () => {
      const result = parseExcelDate('09.03.26');
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(8);
      expect(result.getUTCDate()).toBe(3);
    });

    it('ano curto >= 50 vira século XX (09-03-99 -> 03/09/1999)', () => {
      const result = parseExcelDate('09-03-99');
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCFullYear()).toBe(1999);
      expect(result.getUTCMonth()).toBe(8);
      expect(result.getUTCDate()).toBe(3);
    });

    it('rejeita formato ambíguo não mapeado ("3 de set de 2026") retornando null', () => {
      expect(parseExcelDate('3 de set de 2026')).toBe(null);
    });
  });

  describe('parsePercent', () => {
    it('converte " 25,00% " para 0.25 (espaços + vírgula + %)', () => {
      expect(parsePercent(' 25,00% ')).toBe(0.25);
    });

    it('converte "52%" para 0.52', () => {
      expect(parsePercent('52%')).toBe(0.52);
    });

    it('converte "25.00%" para 0.25', () => {
      expect(parsePercent('25.00%')).toBe(0.25);
    });

    it('retorna 0.25 inalterado quando recebe number 0.25 (leitura bruta decimal)', () => {
      expect(parsePercent(0.25)).toBe(0.25);
    });

    it('converte "0,25" para 0.25 (SEM %, vírgula decimal)', () => {
      expect(parsePercent('0,25')).toBe(0.25);
    });

    it('retorna null para string vazia', () => {
      expect(parsePercent('')).toBe(null);
    });

    it('retorna null para valor inválido "abc"', () => {
      expect(parsePercent('abc')).toBe(null);
    });

    it('retorna null para null', () => {
      expect(parsePercent(null)).toBe(null);
    });

    it('"25" SEM % retorna 25 (NÃO divide por 100 — regra estrita)', () => {
      expect(parsePercent('25')).toBe(25);
    });
  });

  describe('reconcileVbaCatalogRow', () => {
    it('não bloqueia sozinho quando apenas o encargo derivado sai da faixa esperada', () => {
      const result = reconcileVbaCatalogRow({
        custoMp: 20,
        custoEmb: 5,
        custoPerda: 2,
        custoGgf: 1,
        custoMod: 2,
        freteValor: 4,
        encargoValor: 30,
        comissaoValor: 1,
        impostosValor: 10,
        custoTotal: 30,
        precoLiq: 90,
        precoBruto: 100,
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([
        expect.stringContaining('encargoRate fora da faixa esperada'),
      ]);
      expect(result.derived.encargoRate).toBeGreaterThan(0.3);
    });

    it('reproduz o caso real sem encargo usando os valores validados do VBA', () => {
      const result = reconcileVbaCatalogRow({
        custoMp: 0,
        custoEmb: 10.3561979710334,
        custoPerda: 0.517809898551672,
        custoGgf: 0.01230012300123,
        custoMod: 0.00033130331303313,
        freteValor: 0.747057120224762,
        encargoValor: 0,
        comissaoValor: 0,
        impostosValor: 3.76143260033167,
        custoTotal: 10.8866392958994,
        precoLiq: 14.9149954052874,
        precoBruto: 18.676428005619,
        margemInformada: 0.22,
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.derived.margemCalc).toBeCloseTo(0.22, 12);
    });

    it('reproduz o caso real com encargo de 1,5% usando os valores validados do VBA', () => {
      const result = reconcileVbaCatalogRow({
        custoMp: 2.39224397448381,
        custoEmb: 4.40977642363724,
        custoPerda: 0.204060611943631,
        custoGgf: 3.41666666666667,
        custoMod: 1.10433333333333,
        freteValor: 0,
        encargoValor: 0.451065967398599,
        comissaoValor: 0,
        impostosValor: 6.17006731735585,
        custoTotal: 11.5270810100647,
        precoLiq: 24.4658180717,
        precoBruto: 30.6358853890559,
        margemInformada: 0.52,
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.derived.margemCalc).toBeCloseTo(0.52, 12);
      expect(result.derived.encargoRate).toBeCloseTo(0.015, 12);
    });

    it('reproduz o caso real com impostosValor zerado usando os valores validados do VBA', () => {
      const result = reconcileVbaCatalogRow({
        custoMp: 12.963,
        custoEmb: 4.01177497767423,
        custoPerda: 0.254621624665113,
        custoGgf: 1.17142857142857,
        custoMod: 0.378628571428571,
        freteValor: 0,
        encargoValor: 0,
        comissaoValor: 1.76057378861217,
        impostosValor: 0,
        custoTotal: 18.7794537451965,
        precoLiq: 29.3428964768695,
        precoBruto: 29.3428964768695,
        margemInformada: 0.3,
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([
        expect.stringContaining('icmsRate fora da faixa esperada'),
      ]);
      expect(result.derived.fatorImp).toBeCloseTo(1, 12);
      expect(result.derived.icmsRate).toBeCloseTo(-0.10192837465564739, 12);
      expect(result.derived.margemCalc).toBeCloseTo(0.3, 12);
    });
  });
});
