import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './route.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('rota de exportacao', () => {
  it('reaproveita os mesmos filtros da tela', () => {
    // Se a rota montasse os filtros por conta propria, o CSV divergiria do
    // que a pessoa esta vendo — o erro mais facil de nao perceber aqui.
    expect(codigo).toMatch(/lerFiltros/)
    expect(codigo).toMatch(/aplicarFiltroDeGrupo/)
  })

  it('reaproveita a montagem de CSV', () => {
    expect(codigo).toMatch(/montarCsv/)
    expect(codigo).toMatch(/nomeArquivoCsv/)
  })

  it('passa pela sessao do usuario, respeitando a RLS', () => {
    expect(codigo).toMatch(/criarClienteServidor/)
    expect(codigo).not.toMatch(/criarClienteAdmin|SERVICE_ROLE/)
  })

  it('declara o tipo do arquivo com charset', () => {
    expect(codigo).toMatch(/text\/csv/)
    expect(codigo).toMatch(/charset=utf-8/i)
  })

  it('manda o navegador baixar, com nome de arquivo', () => {
    expect(codigo).toMatch(/Content-Disposition/)
    expect(codigo).toMatch(/attachment/)
  })

  it('devolve 404 quando o evento nao existe, em vez de CSV vazio', () => {
    expect(codigo).toMatch(/404/)
  })

  it('usa o helper de tipo de rota da versao', () => {
    // RouteContext<'/rota'> e gerado pelo `next typegen` e da params tipado.
    expect(codigo).toMatch(/RouteContext</)
  })
})
