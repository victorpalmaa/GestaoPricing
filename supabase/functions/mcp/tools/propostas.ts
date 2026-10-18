// Lógica pura de anexação de rejeições às propostas. Sem imports de Deno/npm.

export type RejeicaoRow = {
  price_id?: string | null
  motivo?: string | null
  created_at?: string | null
}

export type RejeicaoItem = {
  motivo: string | null
  data: string | null
}

function compareCreatedDesc(a: RejeicaoRow, b: RejeicaoRow): number {
  const aCreated = a.created_at ? String(a.created_at) : ''
  const bCreated = b.created_at ? String(b.created_at) : ''
  if (aCreated < bCreated) return 1
  if (aCreated > bCreated) return -1
  return 0
}

/**
 * Para cada proposta (id), anexa suas rejeições como [{ motivo, data }] ordenadas
 * da mais recente para a mais antiga (data = created_at da rejeição). Propostas
 * sem rejeição recebem lista vazia.
 */
export function anexarRejeicoes<T extends { id: string }>(
  propostas: readonly T[],
  rejeicoes: readonly RejeicaoRow[]
): Array<T & { rejeicoes: RejeicaoItem[] }> {
  const porProposta = new Map<string, RejeicaoRow[]>()
  for (const rejeicao of rejeicoes) {
    const key = rejeicao.price_id ? String(rejeicao.price_id) : ''
    if (!key) continue
    if (!porProposta.has(key)) porProposta.set(key, [])
    porProposta.get(key)!.push(rejeicao)
  }

  return propostas.map((proposta) => {
    const grupo = porProposta.get(String(proposta.id)) ?? []
    const ordenadas = [...grupo].sort(compareCreatedDesc)
    const itens: RejeicaoItem[] = ordenadas.map((rejeicao) => ({
      motivo: rejeicao.motivo ?? null,
      data: rejeicao.created_at ?? null,
    }))
    return { ...proposta, rejeicoes: itens }
  })
}
