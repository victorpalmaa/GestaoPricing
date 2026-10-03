import { montarPayloadPreco, validarMacoPct } from './montarPayloadPreco';

describe('montarPayloadPreco', () => {
  it('Nacional: preco_usd e ptax null, mercado "nacional"', () => {
    const payload = montarPayloadPreco({
      modo: 'nacional',
      cliente: 'Farmácia A',
      sku: 'SKU-001',
      category: 'Pó',
      subcategory: 'Proteína',
      pricingId: 'PRC-001',
      precoLiquido: '89.90',
      precoBruto: '129.90',
      margemBruta: '30.8',
      macoPct: '12',
      volume: '500',
      status: 'em_aberto',
      originType: 'novo_cliente',
    });
    expect(payload.mercado).toBe('nacional');
    expect(payload.preco_usd).toBeNull();
    expect(payload.ptax).toBeNull();
    expect(payload.precoliquido).toBeCloseTo(89.9, 2);
    expect(payload.precobruto).toBeCloseTo(129.9, 2);
    expect(payload.margembruta).toBeCloseTo(30.8, 1);
    expect(payload.maco_pct).toBeCloseTo(12, 2);
    expect(payload.volume).toBe(500);
    expect(payload.cliente).toBe('Farmácia A');
  });

  it('Exportação com BRL 100, USD 20, PTAX 5.0000: precoliquido 100, precobruto 100, preco_usd 20, ptax 5, mercado "exportacao"', () => {
    const payload = montarPayloadPreco({
      modo: 'exportacao',
      cliente: 'Client X',
      sku: 'SKU-EXP-01',
      category: 'Gel',
      subcategory: 'Creatina',
      pricingId: 'PRC-EXP-01',
      precoBRL: 100,
      precoUSD: 20,
      ptax: 5.0000,
      margemBruta: 35,
      macoPct: 10,
      volume: 1000,
      status: 'em_aberto',
      originType: 'novo_sku',
    });
    expect(payload.mercado).toBe('exportacao');
    expect(payload.precoliquido).toBe(100);
    expect(payload.precobruto).toBe(100);
    expect(payload.preco_usd).toBe(20);
    expect(payload.ptax).toBe(5);
  });

  it('MACO vazio → maco_pct null', () => {
    const payload = montarPayloadPreco({
      modo: 'nacional',
      precoLiquido: 10,
      precoBruto: 20,
      margemBruta: 50,
      macoPct: '',
      volume: 100,
    });
    expect(payload.maco_pct).toBeNull();
  });

  it('MACO null → maco_pct null', () => {
    const payload = montarPayloadPreco({
      modo: 'nacional',
      precoLiquido: 10,
      precoBruto: 20,
      margemBruta: 50,
      macoPct: null,
      volume: 100,
    });
    expect(payload.maco_pct).toBeNull();
  });

  it('MACO "12,5" → 12.5', () => {
    const payload = montarPayloadPreco({
      modo: 'nacional',
      precoLiquido: 10,
      precoBruto: 20,
      margemBruta: 50,
      macoPct: '12,5',
      volume: 100,
    });
    expect(payload.maco_pct).toBeCloseTo(12.5, 2);
  });

  it('MACO "-15,3" → -15.3', () => {
    const payload = montarPayloadPreco({
      modo: 'nacional',
      precoLiquido: 10,
      precoBruto: 20,
      margemBruta: 50,
      macoPct: '-15,3',
      volume: 100,
    });
    expect(payload.maco_pct).toBeCloseTo(-15.3, 2);
  });

  it('Exportação com vírgulas em decimal: "100,50" BRL, "18,75" USD, "4,9876" PTAX', () => {
    const payload = montarPayloadPreco({
      modo: 'exportacao',
      precoBRL: '100,50',
      precoUSD: '18,75',
      ptax: '4,9876',
      margemBruta: '40',
      volume: 500,
    });
    expect(payload.precoliquido).toBeCloseTo(100.5, 2);
    expect(payload.precobruto).toBeCloseTo(100.5, 2);
    expect(payload.preco_usd).toBeCloseTo(18.75, 2);
    expect(payload.ptax).toBeCloseTo(4.9876, 4);
  });

  it('origem_type vazio → null', () => {
    const payload = montarPayloadPreco({
      modo: 'nacional',
      precoLiquido: 10,
      precoBruto: 20,
      margemBruta: 50,
      macoPct: 10,
      volume: 10,
      originType: '',
    });
    expect(payload.origin_type).toBeNull();
  });
});

describe('validarMacoPct', () => {
  it('vazio em criação → inválido (obrigatório)', () => {
    const r = validarMacoPct('', false);
    expect(r.valido).toBe(false);
    expect(r.erro).toContain('obrigatório');
  });

  it('vazio em edição sem MACO anterior → válido', () => {
    const r = validarMacoPct('', true);
    expect(r.valido).toBe(true);
  });

  it('120 → inválido (acima de 100)', () => {
    const r = validarMacoPct(120, false);
    expect(r.valido).toBe(false);
    expect(r.erro).toContain('-100 e 100');
  });

  it('-150 → inválido (abaixo de -100)', () => {
    const r = validarMacoPct('-150', false);
    expect(r.valido).toBe(false);
  });

  it('0 → válido', () => {
    const r = validarMacoPct(0, false);
    expect(r.valido).toBe(true);
  });

  it('100 → válido', () => {
    const r = validarMacoPct(100, false);
    expect(r.valido).toBe(true);
  });

  it('-100 → válido', () => {
    const r = validarMacoPct(-100, false);
    expect(r.valido).toBe(true);
  });

  it('"25,5" → válido', () => {
    const r = validarMacoPct('25,5', false);
    expect(r.valido).toBe(true);
  });
});
