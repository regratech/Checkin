import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './layout.tsx'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('layout do admin', () => {
  it('confere o papel no servidor, nao no navegador', () => {
    // O proxy so garante que existe sessao. Quem e `publico` continua
    // autenticado — a checagem de papel precisa acontecer aqui.
    expect(codigo).toMatch(/from\('perfis'\)/)
    expect(codigo).toMatch(/papel/)
  })

  it('expulsa quem nao tem sessao', () => {
    expect(codigo).toMatch(/redirect\(/)
  })

  it('nao usa a chave de servico', () => {
    expect(codigo).not.toMatch(/criarClienteAdmin|SERVICE_ROLE/)
  })

  it('oferece o botao de sair', () => {
    expect(codigo).toMatch(/sair/)
  })
})
