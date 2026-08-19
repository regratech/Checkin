import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('pedirRecuperacao', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('usa o cliente de recuperacao, nao o normal', () => {
    expect(codigo).toMatch(/criarClienteRecuperacaoServidor/)
    expect(codigo).not.toMatch(/criarClienteServidor\(/)
  })

  it('manda o link de volta para /nova-senha', () => {
    expect(codigo).toMatch(/redirectTo/)
    expect(codigo).toMatch(/\/nova-senha/)
  })

  it('responde igual exista ou nao a conta', () => {
    // Dizer "email nao encontrado" entrega a lista de contas a quem estiver
    // sondando. A confirmacao e a mesma nos dois casos.
    expect(codigo).toMatch(/Se existir/i)
  })

  it('registra a causa real no servidor', () => {
    expect(codigo).toMatch(/console\.error\(/)
  })
})
