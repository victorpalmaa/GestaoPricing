import { extrairQuantidadePorEmbalagem } from './unidadeEmbalagem';

describe('extrairQuantidadePorEmbalagem', () => {
  it('"GEL X - DISPLAY C/10 400G" -> 10', () => {
    expect(extrairQuantidadePorEmbalagem('GEL X - DISPLAY C/10 400G')).toBe(10);
  });

  it('"GEL X - DISPLAY COM 10" -> 10', () => {
    expect(extrairQuantidadePorEmbalagem('GEL X - DISPLAY COM 10')).toBe(10);
  });

  it('"GEL X - DISPLAY C/ 10 - 130G" -> 10', () => {
    expect(extrairQuantidadePorEmbalagem('GEL X - DISPLAY C/ 10 - 130G')).toBe(10);
  });

  it('"FEPASE - WE ON ACAI - DISPLAY (10UNI) - 350G" -> 10', () => {
    expect(
      extrairQuantidadePorEmbalagem(
        'FEPASE - WE ON ACAI - DISPLAY (10UNI) - 350G',
      ),
    ).toBe(10);
  });

  it('"PRODUTO - DISPLAY C/14" -> 14', () => {
    expect(extrairQuantidadePorEmbalagem('PRODUTO - DISPLAY C/14')).toBe(14);
  });

  it('"HIVE - DISPLAY LOOSEIT ABACAXI 150G - 30UN" -> 30', () => {
    expect(
      extrairQuantidadePorEmbalagem(
        'HIVE - DISPLAY LOOSEIT ABACAXI 150G - 30UN',
      ),
    ).toBe(30);
  });

  it('"PRODUTO - DISPLAY 400" -> null (gramatura, sem separador)', () => {
    expect(extrairQuantidadePorEmbalagem('PRODUTO - DISPLAY 400')).toBeNull();
  });

  it('"PRODUTO - DISPLAY 210" -> null (gramatura, sem separador)', () => {
    expect(extrairQuantidadePorEmbalagem('PRODUTO - DISPLAY 210')).toBeNull();
  });

  it('"PRODUTO - DISPLAY 50" -> null (gramatura, sem separador)', () => {
    expect(extrairQuantidadePorEmbalagem('PRODUTO - DISPLAY 50')).toBeNull();
  });

  it('"PRODUTO SEM DISPLAY" -> null', () => {
    expect(extrairQuantidadePorEmbalagem('PRODUTO SEM DISPLAY')).toBeNull();
  });

  it('case-insensitive: "gel - display c/14 200g" -> 14', () => {
    expect(extrairQuantidadePorEmbalagem('gel - display c/14 200g')).toBe(14);
  });

  it('"display com 14" -> 14', () => {
    expect(extrairQuantidadePorEmbalagem('display com 14')).toBe(14);
  });

  it('"DISPLAY C/ 14" (espaco apos C/) -> 14', () => {
    expect(extrairQuantidadePorEmbalagem('DISPLAY C/ 14')).toBe(14);
  });

  it('"DISPLAY (14 UNI)" com espaco dentro dos parenteses -> 14', () => {
    expect(extrairQuantidadePorEmbalagem('DISPLAY (14 UNI)')).toBe(14);
  });

  it('null/undefined/empty -> null', () => {
    expect(extrairQuantidadePorEmbalagem(null)).toBeNull();
    expect(extrairQuantidadePorEmbalagem(undefined)).toBeNull();
    expect(extrairQuantidadePorEmbalagem('')).toBeNull();
    expect(extrairQuantidadePorEmbalagem('   ')).toBeNull();
  });
});
