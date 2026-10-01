import {
  PTAX,
  CANAL_REFERENCIA,
  MARKUP_PONTA_FAIXA_MIN,
  MARKUP_PONTA_FAIXA_MAX,
  calcularMarkupPonta,
  moedasDivergem,
  markupPontaForaDaFaixa,
  selecionarColetaReferencia,
  selecionarTodasColetasPorChave,
  agregarMarkupPontaPorCategoria,
  formatarMarkupPonta,
} from './markupPonta';

describe('markupPonta', () => {
  describe('constantes', () => {
    it('PTAX é 4.63', () => {
      expect(PTAX).toBe(4.63);
    });
    it('CANAL_REFERENCIA é "Site próprio"', () => {
      expect(CANAL_REFERENCIA).toBe('Site próprio');
    });
    it('faixas min 1.5 max 15', () => {
      expect(MARKUP_PONTA_FAIXA_MIN).toBe(1.5);
      expect(MARKUP_PONTA_FAIXA_MAX).toBe(15);
    });
  });

  describe('calcularMarkupPonta', () => {
    it('140 / 20.88 BRL → ~6.70498 e formatado "6,7"', () => {
      const r = calcularMarkupPonta(140, 20.88, 'BRL', 'BRL');
      expect(typeof r).toBe('number');
      expect(r).toBeCloseTo(6.70498, 4);
      expect(formatarMarkupPonta(r)).toBe('6,7');
    });

    it('150 / 3.35 BRL → ~44.7761 (alto, não é null)', () => {
      const r = calcularMarkupPonta(150, 3.35, 'BRL', 'BRL');
      expect(typeof r).toBe('number');
      expect(r).toBeGreaterThan(15);
      expect(r).toBeCloseTo(44.7761, 3);
    });

    it('denominador 0 → null', () => {
      expect(calcularMarkupPonta(100, 0, 'BRL', 'BRL')).toBeNull();
    });

    it('denominador null → null', () => {
      expect(calcularMarkupPonta(100, null, 'BRL', 'BRL')).toBeNull();
    });

    it('numerador null → null', () => {
      expect(calcularMarkupPonta(null, 20, 'BRL', 'BRL')).toBeNull();
    });

    it('numerador 0 → null', () => {
      expect(calcularMarkupPonta(0, 20, 'BRL', 'BRL')).toBeNull();
    });

    it('numerador negativo → null', () => {
      expect(calcularMarkupPonta(-10, 20, 'BRL', 'BRL')).toBeNull();
    });

    it('denominador negativo → null', () => {
      expect(calcularMarkupPonta(100, -5, 'BRL', 'BRL')).toBeNull();
    });

    it('ambos USD → cálculo direto (5)', () => {
      expect(calcularMarkupPonta(150, 30, 'USD', 'USD')).toBeCloseTo(5, 6);
    });

    it('BRL 140 vs USD 4.51 (gross convertido por PTAX 4.63) → ~6,7', () => {
      const grossEmBRL = 4.51 * 4.63;
      expect(grossEmBRL).toBeCloseTo(20.8813, 3);
      const r = calcularMarkupPonta(140, 4.51, 'BRL', 'USD');
      expect(r).toBeCloseTo(140 / grossEmBRL, 4);
      expect(formatarMarkupPonta(r)).toBe('6,7');
    });

    it('USD 30.24 vs BRL 140 (ponta convertida) → ~1', () => {
      const pontaEmBRL = 30.24 * 4.63;
      const r = calcularMarkupPonta(30.24, 140, 'USD', 'BRL');
      expect(r).toBeCloseTo(pontaEmBRL / 140, 4);
    });

    it('valores string numéricos são parseados', () => {
      const r = calcularMarkupPonta('140', '20.88', 'BRL', 'BRL');
      expect(r).toBeCloseTo(6.70498, 4);
    });

    it('valores string inválidos → null', () => {
      expect(calcularMarkupPonta('abc', 20, 'BRL', 'BRL')).toBeNull();
      expect(calcularMarkupPonta(100, 'xyz', 'BRL', 'BRL')).toBeNull();
    });

    it('moeda vazia normaliza para BRL', () => {
      const r1 = calcularMarkupPonta(140, 20.88, '', null);
      expect(r1).toBeCloseTo(6.70498, 4);
    });

    it('moeda tipo inválido (number) → null', () => {
      expect(calcularMarkupPonta(140, 20.88, 123, 'BRL')).toBeNull();
    });
  });

  describe('moedasDivergem', () => {
    it('BRL vs BRL → false', () => expect(moedasDivergem('BRL', 'BRL')).toBe(false));
    it('USD vs BRL → true', () => expect(moedasDivergem('USD', 'BRL')).toBe(true));
    it('vazio vs BRL → false (ambos normalizam para BRL)', () => {
      expect(moedasDivergem('', null)).toBe(false);
    });
  });

  describe('markupPontaForaDaFaixa', () => {
    it('1.0 → fora (abaixo)', () => expect(markupPontaForaDaFaixa(1.0)).toBe(true));
    it('1.5 → limite dentro', () => expect(markupPontaForaDaFaixa(1.5)).toBe(false));
    it('10 → dentro', () => expect(markupPontaForaDaFaixa(10)).toBe(false));
    it('15 → limite dentro', () => expect(markupPontaForaDaFaixa(15)).toBe(false));
    it('44.8 → fora (acima)', () => expect(markupPontaForaDaFaixa(44.8)).toBe(true));
    it('null → false', () => expect(markupPontaForaDaFaixa(null)).toBe(false));
  });

  describe('selecionarColetaReferencia', () => {
    const coletaBase = (overrides) => ({
      id: 1,
      client_id: 'c1',
      datasul_code: '0001.0001.0001',
      retail_price: 100,
      currency: 'BRL',
      collected_at: '2026-01-10',
      created_at: '2026-01-10T12:00:00',
      source: CANAL_REFERENCIA,
      ...overrides,
    });

    it('array vazio → null', () => {
      expect(selecionarColetaReferencia([])).toBeNull();
    });

    it('apenas marketplace → null', () => {
      const r = selecionarColetaReferencia([
        coletaBase({ source: 'Marketplace X', id: 2 }),
      ]);
      expect(r).toBeNull();
    });

    it('site próprio e marketplace → retorna site próprio', () => {
      const sp = coletaBase({ id: 1, collected_at: '2026-01-05' });
      const mp = coletaBase({ id: 2, source: 'Marketplace', collected_at: '2026-01-20' });
      const r = selecionarColetaReferencia([mp, sp]);
      expect(r).not.toBeNull();
      expect(r.source).toBe(CANAL_REFERENCIA);
      expect(r.id).toBe(1);
    });

    it('duas coletas site próprio → mais recente por collected_at', () => {
      const antiga = coletaBase({ id: 1, collected_at: '2026-01-01', created_at: '2026-01-01' });
      const nova = coletaBase({ id: 2, collected_at: '2026-01-15', created_at: '2026-01-15' });
      expect(selecionarColetaReferencia([antiga, nova]).id).toBe(2);
      expect(selecionarColetaReferencia([nova, antiga]).id).toBe(2);
    });

    it('mesmo collected_at → desempate por created_at desc', () => {
      const a = coletaBase({ id: 1, collected_at: '2026-01-10', created_at: '2026-01-10T10:00:00' });
      const b = coletaBase({ id: 2, collected_at: '2026-01-10', created_at: '2026-01-10T18:00:00' });
      expect(selecionarColetaReferencia([a, b]).id).toBe(2);
    });
  });

  describe('selecionarTodasColetasPorChave', () => {
    it('agrupa por (client_id, datasul_code) uppercase', () => {
      const c1 = { client_id: 'c1', datasul_code: '0001.0001.0001', retail_price: 50, collected_at: '2026-01-01' };
      const c2 = { client_id: 'c1', datasul_code: '0001.0001.0001', retail_price: 55, collected_at: '2026-01-02' };
      const c3 = { client_id: 'c1', datasul_code: '0001.0001.0002', retail_price: 90, collected_at: '2026-01-03' };
      const r = selecionarTodasColetasPorChave([c1, c2, c3]);
      expect(r.size).toBe(2);
      const ch1 = 'c1::0001.0001.0001';
      expect(r.has(ch1)).toBe(true);
      expect(r.get(ch1)[0].retail_price).toBe(55);
      expect(r.get(ch1)[1].retail_price).toBe(50);
    });
  });

  describe('agregarMarkupPontaPorCategoria', () => {
    it('categoria normalizada: "Gel" e "gel" são a mesma', () => {
      const linhas = [
        { categoria: 'Gel', markupPonta: 5.0 },
        { categoria: '  gel  ', markupPonta: 6.0 },
        { categoria: 'GEL', markupPonta: null },
      ];
      const r = agregarMarkupPontaPorCategoria(linhas);
      expect(r.length).toBe(1);
      expect(r[0].categoria).toBe('Gel');
      expect(r[0].skusTotal).toBe(3);
      expect(r[0].skusComPonta).toBe(2);
      expect(r[0].markupMedio).toBeCloseTo(5.5, 6);
      expect(r[0].markupMediano).toBeCloseTo(5.5, 6);
    });

    it('categoria vazia vira "Sem categoria"', () => {
      const linhas = [
        { categoria: '', markupPonta: 4.0 },
        { categoria: null, markupPonta: 6.0 },
        { categoria: '   ', markupPonta: null },
      ];
      const r = agregarMarkupPontaPorCategoria(linhas);
      expect(r.length).toBe(1);
      expect(r[0].categoria).toBe('Sem categoria');
      expect(r[0].skusTotal).toBe(3);
      expect(r[0].skusComPonta).toBe(2);
      expect(r[0].markupMedio).toBe(5.0);
      expect(r[0].markupMediano).toBe(5.0);
    });

    it('mediana para array impar', () => {
      const linhas = [
        { categoria: 'Pó', markupPonta: 2 },
        { categoria: 'Pó', markupPonta: 4 },
        { categoria: 'Pó', markupPonta: 7 },
      ];
      const r = agregarMarkupPontaPorCategoria(linhas);
      expect(r[0].markupMediano).toBe(4);
    });

    it('mediana para array par', () => {
      const linhas = [
        { categoria: 'Pó', markupPonta: 2 },
        { categoria: 'Pó', markupPonta: 4 },
        { categoria: 'Pó', markupPonta: 6 },
        { categoria: 'Pó', markupPonta: 8 },
      ];
      const r = agregarMarkupPontaPorCategoria(linhas);
      expect(r[0].markupMediano).toBe(5);
    });

    it('sem markups válidos → medio/mediano null; cobertura 0 de N', () => {
      const linhas = [
        { categoria: 'Pastilha', markupPonta: null },
        { categoria: 'Pastilha', markupPonta: 0 },
      ];
      const r = agregarMarkupPontaPorCategoria(linhas);
      expect(r[0].skusComPonta).toBe(0);
      expect(r[0].skusTotal).toBe(2);
      expect(r[0].markupMedio).toBeNull();
      expect(r[0].markupMediano).toBeNull();
    });

    it('markup 44.8 não é filtrado do agregado', () => {
      const linhas = [
        { categoria: 'Gel', markupPonta: 5 },
        { categoria: 'Gel', markupPonta: 44.8 },
      ];
      const r = agregarMarkupPontaPorCategoria(linhas);
      expect(r[0].skusComPonta).toBe(2);
      expect(r[0].markupMedio).toBeCloseTo(24.9, 6);
    });
  });

  describe('formatarMarkupPonta', () => {
    it('6.7 → "6,7"', () => {
      expect(formatarMarkupPonta(6.7)).toBe('6,7');
    });
    it('44.776 → "44,8" (arredonda p/ cima 1 casa)', () => {
      expect(formatarMarkupPonta(44.776)).toBe('44,8');
    });
    it('6.70019 → "6,7"', () => {
      expect(formatarMarkupPonta(6.70019)).toBe('6,7');
    });
    it('5 → "5,0" (obrigatório 1 casa)', () => {
      expect(formatarMarkupPonta(5)).toBe('5,0');
    });
    it('null → "-"', () => {
      expect(formatarMarkupPonta(null)).toBe('-');
    });
    it('undefined → "-"', () => {
      expect(formatarMarkupPonta(undefined)).toBe('-');
    });
    it('0 → "-"', () => {
      expect(formatarMarkupPonta(0)).toBe('-');
    });
    it('-3 → "-"', () => {
      expect(formatarMarkupPonta(-3)).toBe('-');
    });
    it('NaN → "-"', () => {
      expect(formatarMarkupPonta(NaN)).toBe('-');
    });
    it('"abc" → "-"', () => {
      expect(formatarMarkupPonta('abc')).toBe('-');
    });
    it('string numérica "6.70019" → "6,7"', () => {
      expect(formatarMarkupPonta('6.70019')).toBe('6,7');
    });
  });
});
