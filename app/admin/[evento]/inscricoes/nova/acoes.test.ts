import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acaoCriarInscricao', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('reaproveita criarInscricaoManual da Fatia A', () => {
    // Aquela funcao ja resolve pessoa por email+nome, pede o codigo ao
    // banco e numera a ordem. Refazer isso aqui duplicaria a regra.
    expect(codigo).toMatch(/from '@\/lib\/inscricoes'/)
    expect(codigo).toMatch(/criarInscricaoManual\(/)
  })

  it('monta a lista de participantes a partir de campos indexados do form', () => {
    expect(codigo).toMatch(/participantes\[/)
  })

  it('passa pela sessao do usuario, respeitando a RLS', () => {
    expect(codigo).toMatch(/criarClienteServidor/)
    expect(codigo).not.toMatch(/criarClienteAdmin/)
  })

  it('atualiza a tela do evento depois de gravar', () => {
    expect(codigo).toMatch(/revalidatePath\(/)
  })
})
