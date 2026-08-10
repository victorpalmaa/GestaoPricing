import {
  parseVbaVersaoLabel,
  reconcileVbaCatalogRow,
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
