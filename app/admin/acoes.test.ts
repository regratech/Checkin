import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acaoCriarEvento', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('reaproveita criarEvento da Fatia A em vez de montar o insert de novo', () => {
    expect(codigo).toMatch(/from '@\/lib\/eventos'/)
    expect(codigo).toMatch(/criarEvento\(/)
    expect(codigo).not.toMatch(/\.from\(['"]eventos['"]\)\s*\n?\s*\.insert/)
  })

  it('valida a entrada com zod', () => {
    expect(codigo).toMatch(/safeParse/)
  })

  it('passa pela sessao do usuario, respeitando a RLS', () => {
    expect(codigo).toMatch(/criarClienteServidor/)
    expect(codigo).not.toMatch(/criarClienteAdmin/)
  })

  it('atualiza a lista depois de gravar', () => {
    // Sem revalidatePath a lista de eventos continua servindo o cache
    // antigo e o evento recem-criado nao aparece.
    expect(codigo).toMatch(/revalidatePath\(/)
  })

  it('devolve mensagem legivel quando o slug ja existe', () => {
    expect(codigo).toMatch(/duplicate key|23505/i)
    expect(codigo).toMatch(/já existe/i)
  })
})
