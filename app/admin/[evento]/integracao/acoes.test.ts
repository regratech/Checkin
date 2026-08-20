import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acoes da integracao', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('reaproveita a mesma promocao do webhook', () => {
    // Reprocessar tem de seguir exatamente o caminho do webhook, senao os
    // dois divergem e o erro so aparece num deles.
    expect(codigo).toMatch(/from '@\/lib\/promocao'/)
    expect(codigo).toMatch(/promover\(/)
  })

  it('confere que a sincronizacao e do evento antes de reprocessar', () => {
    // Sem isto, um id de outro evento reprocessaria dado alheio.
    expect(codigo).toMatch(/eq\('evento_id'/)
  })

  it('atualiza a tela depois', () => {
    expect(codigo).toMatch(/revalidatePath\(/)
  })
})
