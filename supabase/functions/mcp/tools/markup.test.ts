import { assertEquals } from 'jsr:@std/assert@1'

import { calcularMarkup } from './markup.ts'

Deno.test('calcularMarkup: precoPonta nulo retorna sem_ponta', () => {
  const result = calcularMarkup({
    precoBruto: 100,
    moedaBruto: 'BRL',
    precoPonta: null,
    moedaPonta: 'BRL',
    vigenciaInferida: false,
  })
  assertEquals(result, { markup: null, markup_texto: null, status: 'sem_ponta' })
})

Deno.test('calcularMarkup: vigenciaInferida true retorna preco_nao_vigente', () => {
  const result = calcularMarkup({
    precoBruto: 100,
    moedaBruto: 'BRL',
    precoPonta: 185,
    moedaPonta: 'BRL',
    vigenciaInferida: true,
  })
  assertEquals(result, { markup: null, markup_texto: null, status: 'preco_nao_vigente' })
})

Deno.test('calcularMarkup: precoBruto invalido (nulo, zero, negativo, NaN) retorna preco_bruto_invalido', () => {
  const casos = [null, 0, -5, 'abc']
  for (const bruto of casos) {
    const result = calcularMarkup({
      precoBruto: bruto as number | string | null,
      moedaBruto: 'BRL',
      precoPonta: 185,
      moedaPonta: 'BRL',
      vigenciaInferida: false,
    })
    assertEquals(result.status, 'preco_bruto_invalido')
    assertEquals(result.markup, null)
  }
})

Deno.test('calcularMarkup: moedas divergentes retorna moeda_divergente', () => {
  const result = calcularMarkup({
    precoBruto: 100,
    moedaBruto: 'BRL',
    precoPonta: 185,
    moedaPonta: 'USD',
    vigenciaInferida: false,
  })
  assertEquals(result, { markup: null, markup_texto: null, status: 'moeda_divergente' })
})

Deno.test('calcularMarkup: bruto 100 e ponta 185 geram markup 1.85 e texto "1,85x"', () => {
  const result = calcularMarkup({
    precoBruto: 100,
    moedaBruto: 'BRL',
    precoPonta: 185,
    moedaPonta: 'BRL',
    vigenciaInferida: false,
  })
  assertEquals(result.status, 'ok')
  assertEquals(result.markup, 1.85)
  assertEquals(result.markup_texto, '1,85x')
})
