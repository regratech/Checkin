import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// acoes.ts tem 'use server' e importa next/headers e next/navigation, que
// exigem contexto de requisicao. O fonte e lido como texto, no mesmo
// espirito dos testes de migration.
const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')

// Sem comentarios. As asserticoes negativas abaixo falam sobre o que a
// pessoa ve na tela; um comentario explicando a regra nao pode reprovar o
// codigo que a cumpre.
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acoes de autenticacao', () => {
  it('e um modulo de servidor', () => {
    expect(fonte).toMatch(/^'use server'/m)
  })

  it('valida a entrada com zod antes de chamar o supabase', () => {
    expect(fonte).toMatch(/esquemaLogin\.safeParse/)
    const posValidacao = fonte.indexOf('esquemaLogin.safeParse')
    const posLogin = fonte.indexOf('signInWithPassword')
    expect(posValidacao).toBeGreaterThan(-1)
    expect(posLogin).toBeGreaterThan(posValidacao)
  })

  it('nao revela se o email existe', () => {
    // "Email nao cadastrado" conta a um atacante quais enderecos tem conta.
    // A mensagem e a mesma para email errado e senha errada.
    expect(codigo).toMatch(/Email ou senha incorretos/)
    expect(codigo).not.toMatch(/não cadastrado|nao cadastrado|inexistente/i)
  })

  it('nao usa a chave de servico', () => {
    expect(codigo).not.toMatch(/criarClienteAdmin|SERVICE_ROLE/)
  })

  it('so aceita destino interno ao admin, nunca uma URL de fora', () => {
    // Sem essa checagem, /entrar?proximo=https://phishing.com redirecionaria
    // para fora do site depois de um login legitimo.
    expect(fonte).toMatch(/startsWith\('\/admin'\)/)
  })

  it('tem uma acao de sair que encerra a sessao', () => {
    expect(fonte).toMatch(/export async function sair\(/)
    expect(fonte).toMatch(/auth\.signOut\(\)/)
  })
})
