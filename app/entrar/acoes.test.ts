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

  it('registra a causa real no servidor antes de generalizar a mensagem', () => {
    // A mensagem na tela e generica de proposito. Mas jogar fora a causa
    // torna a falha indiagnosticavel: senha errada, email nao confirmado,
    // limite de tentativas e configuracao quebrada viravam a mesma frase, e
    // um login que nunca funcionou custou minutos de investigacao as cegas.
    expect(codigo).toMatch(/console\.error\(/)
    const posLog = codigo.indexOf('console.error(')
    const posRetorno = codigo.indexOf('Email ou senha incorretos')
    expect(posLog).toBeGreaterThan(-1)
    expect(posLog).toBeLessThan(posRetorno)
  })

  it('nao coloca a senha no log', () => {
    // O objeto de erro do Supabase e seguro; a senha digitada nao.
    // O trecho e delimitado a chamada em si — fatiar por numero de
    // caracteres escorrega para o `return` seguinte, que contem a palavra
    // "senha" na mensagem da tela e reprovaria codigo correto.
    const inicio = codigo.indexOf('console.error(')
    const chamadaLog = codigo.slice(inicio, codigo.indexOf('})', inicio))
    expect(chamadaLog).not.toMatch(/\bsenha\b|password|analise\.data/i)
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
