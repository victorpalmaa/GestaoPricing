import {
  MOEDA_PADRAO,
  MARKUP_TIERS,
  MARKUP_STATUS,
  calculateMarkup,
  resolveMarkupTier,
  formatMarkup,
} from './markup';

describe('markup', () => {
  describe('constantes', () => {
    it('MOEDA_PADRAO é BRL', () => {
      expect(MOEDA_PADRAO).toBe('BRL');
    });

    it('MARKUP_TIERS está ordenado do maior para o menor', () => {
      expect(MARKUP_TIERS).toEqual([
        { min: 5.0, tier: 'alto' },
        { min: 4.0, tier: 'medio' },
        { min: 0.0, tier: 'baixo' },
      ]);
    });

    it('MARKUP_STATUS tem as chaves e valores corretos', () => {
      expect(MARKUP_STATUS).toEqual({
        OK: 'ok',
        SEM_PONTA: 'sem_ponta',
        PONTA_INVALIDA: 'ponta_invalida',
        PRO_INVALIDO: 'pro_invalido',
        MOEDA_INVALIDA: 'moeda_invalida',
        MOEDA_DIVERGENTE: 'moeda_divergente',
      });
    });
  });

  describe('calculateMarkup', () => {
    it('precoPro: 30, precoPonta: 150 → ok, markup 5, tier alto', () => {
      const r = calculateMarkup({ precoPro: 30, precoPonta: 150 });
      expect(r.status).toBe('ok');
      expect(r.markup).toBe(5);
      expect(r.tier).toBe('alto');
      expect(r.moeda).toBe('BRL');
      expect(r.detalhe).toBeNull();
      expect(r).not.toBeNull();
    });

    it('precoPro: "31.90", precoPonta: "159.90" → ok, markup ≈ 5.0125', () => {
      const r = calculateMarkup({ precoPro: '31.90', precoPonta: '159.90' });
      expect(r.status).toBe('ok');
      expect(r.markup).toBeCloseTo(5.0125, 4);
      expect(r.moeda).toBe('BRL');
    });

    it('precoPro: 30, sem ponta → sem_ponta, markup null, objeto não é null', () => {
      const r = calculateMarkup({ precoPro: 30 });
      expect(r.status).toBe('sem_ponta');
      expect(r.markup).toBeNull();
      expect(r.tier).toBeNull();
      expect(r.moeda).toBeNull();
      expect(r).not.toBeNull();
    });

    it('precoPonta: null → sem_ponta', () => {
      const r = calculateMarkup({ precoPro: 30, precoPonta: null });
      expect(r.status).toBe('sem_ponta');
    });

    it('precoPonta: "" → sem_ponta', () => {
      const r = calculateMarkup({ precoPro: 30, precoPonta: '' });
      expect(r.status).toBe('sem_ponta');
    });

    it('precoPro: 30, precoPonta: 0 → ponta_invalida (zero não é ausência)', () => {
      const r = calculateMarkup({ precoPro: 30, precoPonta: 0 });
      expect(r.status).toBe('ponta_invalida');
      expect(r.detalhe).toEqual({ precoPonta: 0 });
    });

    it('precoPro: 0, precoPonta: 150 → pro_invalido (sem divisão por zero)', () => {
      const r = calculateMarkup({ precoPro: 0, precoPonta: 150 });
      expect(r.status).toBe('pro_invalido');
      expect(r.detalhe).toEqual({ precoPro: 0 });
    });

    it('precoPro: "n/d", precoPonta: 150 → pro_invalido', () => {
      const r = calculateMarkup({ precoPro: 'n/d', precoPonta: 150 });
      expect(r.status).toBe('pro_invalido');
      expect(r.detalhe).toEqual({ precoPro: 'n/d' });
    });

    it('PRO USD × ponta BRL → moeda_divergente, markup null', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: 'USD',
        precoPonta: 150,
        moedaPonta: 'BRL',
      });
      expect(r.status).toBe('moeda_divergente');
      expect(r.markup).toBeNull();
      expect(r.detalhe).toEqual({ moedaPro: 'USD', moedaPonta: 'BRL' });
    });

    it('ambos USD → ok, moeda: USD', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: 'USD',
        precoPonta: 150,
        moedaPonta: 'USD',
      });
      expect(r.status).toBe('ok');
      expect(r.moeda).toBe('USD');
      expect(r.markup).toBe(5);
    });

    it('moedaPro: " usd " × "USD" → ok (normalização)', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: ' usd ',
        precoPonta: 150,
        moedaPonta: 'USD',
      });
      expect(r.status).toBe('ok');
      expect(r.moeda).toBe('USD');
    });

    it('sem argumentos → sem_ponta', () => {
      const r = calculateMarkup();
      expect(r.status).toBe('sem_ponta');
      expect(r).not.toBeNull();
    });

    it('precoPonta negativo → ponta_invalida', () => {
      const r = calculateMarkup({ precoPro: 30, precoPonta: -10 });
      expect(r.status).toBe('ponta_invalida');
    });

    it('precoPro negativo → pro_invalido', () => {
      const r = calculateMarkup({ precoPro: -5, precoPonta: 150 });
      expect(r.status).toBe('pro_invalido');
    });

    it('precoPonta string com espaço vazio → sem_ponta', () => {
      const r = calculateMarkup({ precoPro: 30, precoPonta: '   ' });
      expect(r.status).toBe('sem_ponta');
    });

    it('moeda vazia assume MOEDA_PADRAO', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: '',
        precoPonta: 150,
        moedaPonta: null,
      });
      expect(r.status).toBe('ok');
      expect(r.moeda).toBe('BRL');
      expect(r.detalhe).toBeNull();
    });

    it('sem_ponta tem detalhe null (não undefined)', () => {
      const r = calculateMarkup({ precoPro: 30 });
      expect(r.status).toBe('sem_ponta');
      expect('detalhe' in r).toBe(true);
      expect(r.detalhe).toBeNull();
    });

    it('sucesso tem detalhe null (não undefined)', () => {
      const r = calculateMarkup({ precoPro: 10, precoPonta: 40 });
      expect(r.status).toBe('ok');
      expect('detalhe' in r).toBe(true);
      expect(r.detalhe).toBeNull();
    });

    it('moedaPro number × moedaPonta BRL → moeda_invalida (corrupção de dado)', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: 123,
        precoPonta: 150,
        moedaPonta: 'BRL',
      });
      expect(r.status).toBe('moeda_invalida');
      expect(r.markup).toBeNull();
      expect(r.detalhe).toEqual({ moedaPro: 123, moedaPonta: 'BRL' });
    });

    it('moedaPro boolean × moedaPonta USD → moeda_invalida', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: true,
        precoPonta: 150,
        moedaPonta: 'USD',
      });
      expect(r.status).toBe('moeda_invalida');
      expect(r.detalhe.moedaPro).toBe(true);
    });

    it('moedaPro object × moedaPonta BRL → moeda_invalida', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: {},
        precoPonta: 150,
        moedaPonta: 'BRL',
      });
      expect(r.status).toBe('moeda_invalida');
      expect(r.detalhe.moedaPro).toEqual({});
    });

    it('moedaPonta array × moedaPro USD → moeda_invalida', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: 'USD',
        precoPonta: 150,
        moedaPonta: ['BRL'],
      });
      expect(r.status).toBe('moeda_invalida');
      expect(r.detalhe.moedaPonta).toEqual(['BRL']);
    });

    it('MOEDA_INVALIDA não contém string de sentinela no detalhe', () => {
      const r = calculateMarkup({
        precoPro: 30,
        moedaPro: 42,
        precoPonta: 150,
        moedaPonta: null,
      });
      expect(r.status).toBe('moeda_invalida');
      const json = JSON.stringify(r.detalhe);
      expect(json).not.toContain('__TIPO_INVALIDO');
      expect(json).not.toContain('SENTINEL');
      expect(r.detalhe.moedaPro).toBe(42);
      expect(r.detalhe.moedaPonta).toBeNull();
    });
  });

  describe('resolveMarkupTier', () => {
    it('5.0 → alto', () => {
      expect(resolveMarkupTier(5.0)).toBe('alto');
    });

    it('4.99 → medio', () => {
      expect(resolveMarkupTier(4.99)).toBe('medio');
    });

    it('4.0 → medio', () => {
      expect(resolveMarkupTier(4.0)).toBe('medio');
    });

    it('3.99 → baixo', () => {
      expect(resolveMarkupTier(3.99)).toBe('baixo');
    });

    it('0 → null', () => {
      expect(resolveMarkupTier(0)).toBeNull();
    });

    it('-1 → null', () => {
      expect(resolveMarkupTier(-1)).toBeNull();
    });

    it('null → null', () => {
      expect(resolveMarkupTier(null)).toBeNull();
    });

    it('"abc" → null', () => {
      expect(resolveMarkupTier('abc')).toBeNull();
    });

    it('0.5 → baixo', () => {
      expect(resolveMarkupTier(0.5)).toBe('baixo');
    });
  });

  describe('formatMarkup', () => {
    it('5.0125 → "5,01x"', () => {
      expect(formatMarkup(5.0125)).toBe('5,01x');
    });

    it('7 → "7,00x"', () => {
      expect(formatMarkup(7)).toBe('7,00x');
    });

    it('null → null', () => {
      expect(formatMarkup(null)).toBeNull();
    });

    it('0 → null', () => {
      expect(formatMarkup(0)).toBeNull();
    });

    it('undefined → null', () => {
      expect(formatMarkup(undefined)).toBeNull();
    });

    it('-5 → null', () => {
      expect(formatMarkup(-5)).toBeNull();
    });

    it('"inválido" → null', () => {
      expect(formatMarkup('inválido')).toBeNull();
    });

    it('4.5 → "4,50x"', () => {
      expect(formatMarkup(4.5)).toBe('4,50x');
    });
  });
});
