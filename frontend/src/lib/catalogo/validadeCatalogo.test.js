import { getValidadeCatalogo } from './validadeCatalogo';

describe('getValidadeCatalogo', () => {
  const expiryDate = new Date(2026, 10, 30);

  it('29/10/2026 -> 32 dias e fase vigente', () => {
    expect(getValidadeCatalogo('2026-10-29', expiryDate)).toEqual({
      days: 32,
      phase: 'vigente',
      description: 'Os preços deste catálogo são válidos até 30/11/2026.',
    });
  });

  it('31/10/2026 -> 30 dias e fase aviso', () => {
    expect(getValidadeCatalogo('2026-10-31', expiryDate)).toEqual({
      days: 30,
      phase: 'aviso',
      description: 'Faltam 30 dias para o vencimento dos preços deste catálogo (30/11/2026).',
    });
  });

  it('01/11/2026 -> 29 dias e fase aviso', () => {
    expect(getValidadeCatalogo('2026-11-01', expiryDate)).toEqual({
      days: 29,
      phase: 'aviso',
      description: 'Faltam 29 dias para o vencimento dos preços deste catálogo (30/11/2026).',
    });
  });

  it('29/11/2026 -> 1 dia e fase aviso', () => {
    expect(getValidadeCatalogo('2026-11-29', expiryDate)).toEqual({
      days: 1,
      phase: 'aviso',
      description: 'Falta 1 dia para o vencimento dos preços deste catálogo (30/11/2026).',
    });
  });

  it('30/11/2026 -> 0 dia e fase aviso', () => {
    expect(getValidadeCatalogo('2026-11-30', expiryDate)).toEqual({
      days: 0,
      phase: 'aviso',
      description: 'Os preços deste catálogo vencem hoje (30/11/2026).',
    });
  });

  it('01/12/2026 -> -1 dia e fase vencido', () => {
    expect(getValidadeCatalogo('2026-12-01', expiryDate)).toEqual({
      days: -1,
      phase: 'vencido',
      description: 'A validade dos preços foi encerrada em 30/11/2026. Para atualização, acesse o time de Data. O catálogo continua disponível para consulta.',
    });
  });

  it('23:59 conta igual ao mesmo dia às 00:00', () => {
    expect(getValidadeCatalogo(new Date(2026, 9, 31, 23, 59), expiryDate)).toEqual(
      getValidadeCatalogo(new Date(2026, 9, 31, 0, 0), expiryDate)
    );
  });
});
