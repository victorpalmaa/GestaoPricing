import { assertEquals } from 'jsr:@std/assert@1'

import { anexarRejeicoes } from './propostas.ts'

Deno.test('anexarRejeicoes: proposta sem rejeição recebe lista vazia', () => {
  const propostas = [{ id: 'p1', sku: 'SKU-1' }]
  const resultado = anexarRejeicoes(propostas, [])
  assertEquals(resultado, [{ id: 'p1', sku: 'SKU-1', rejeicoes: [] }])
})

Deno.test('anexarRejeicoes: proposta com uma rejeição', () => {
  const propostas = [{ id: 'p1' }]
  const rejeicoes = [
    { price_id: 'p1', motivo: 'preço alto', created_at: '2026-01-10T10:00:00Z' },
  ]
  const resultado = anexarRejeicoes(propostas, rejeicoes)
  assertEquals(resultado, [
    {
      id: 'p1',
      rejeicoes: [{ motivo: 'preço alto', data: '2026-01-10T10:00:00Z' }],
    },
  ])
})

Deno.test('anexarRejeicoes: várias rejeições ordenadas da mais recente para a mais antiga', () => {
  const propostas = [{ id: 'p1' }, { id: 'p2' }]
  const rejeicoes = [
    { price_id: 'p1', motivo: 'antiga', created_at: '2026-01-01T10:00:00Z' },
    { price_id: 'p1', motivo: 'recente', created_at: '2026-03-01T10:00:00Z' },
    { price_id: 'p1', motivo: 'meio', created_at: '2026-02-01T10:00:00Z' },
    { price_id: 'p2', motivo: 'outra', created_at: '2026-04-01T10:00:00Z' },
  ]
  const resultado = anexarRejeicoes(propostas, rejeicoes)
  assertEquals(resultado, [
    {
      id: 'p1',
      rejeicoes: [
        { motivo: 'recente', data: '2026-03-01T10:00:00Z' },
        { motivo: 'meio', data: '2026-02-01T10:00:00Z' },
        { motivo: 'antiga', data: '2026-01-01T10:00:00Z' },
      ],
    },
    {
      id: 'p2',
      rejeicoes: [{ motivo: 'outra', data: '2026-04-01T10:00:00Z' }],
    },
  ])
})
