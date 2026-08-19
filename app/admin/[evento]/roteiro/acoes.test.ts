import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acoes do roteiro', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('reaproveita as funcoes de lib/perguntas', () => {
    expect(codigo).toMatch(/from '@\/lib\/perguntas'/)
    expect(codigo).toMatch(/criarPergunta\(/)
    expect(codigo).toMatch(/atualizarPergunta\(/)
  })

  it('valida com o esquema antes de gravar', () => {
    expect(codigo).toMatch(/esquemaPergunta\.safeParse/)
  })

  it('passa pela sessao do usuario, respeitando a RLS', () => {
    expect(codigo).toMatch(/criarClienteServidor/)
    expect(codigo).not.toMatch(/criarClienteAdmin|SERVICE_ROLE/)
  })

  it('nunca escreve chave nem escopo na atualizacao', () => {
    // A chave amarra o historico e o CSV; o escopo e parte da FK composta
    // que valida as respostas ja gravadas. Os dois sao imutaveis.
    const trecho = codigo.slice(codigo.indexOf('acaoAtualizarPergunta'))
    expect(trecho).not.toMatch(/chave:/)
    expect(trecho).not.toMatch(/escopo:/)
  })

  it('atualiza a tela depois de cada mudanca', () => {
    expect(codigo).toMatch(/revalidatePath\(/)
  })
})
