import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acoes do check-in', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('resolve tudo pelo token, nunca por id vindo do cliente', () => {
    // O token e a unica credencial. Aceitar um inscricao_id do cliente
    // deixaria qualquer um escrever na inscricao de outro buffet.
    expect(codigo).toMatch(/carregarPorToken\(/)
    expect(codigo).not.toMatch(/inscricao_id:\s*(form|entrada|dados)\./)
  })

  it('re-expande o roteiro no servidor antes de gravar', () => {
    // Nao confiar no cliente sobre qual e o passo atual: um cliente
    // adulterado pularia a validacao de um campo obrigatorio.
    expect(codigo).toMatch(/podeAvancar\(/)
  })

  it('recusa responder um passo que nao e o atual', () => {
    expect(codigo).toMatch(/passo\.chave !== chavePasso/)
  })

  it('grava a resposta e avanca o marcador', () => {
    expect(codigo).toMatch(/passo_atual:/)
  })

  it('marca em_andamento ao primeiro passo e concluido no fim', () => {
    expect(codigo).toMatch(/em_andamento/)
    expect(codigo).toMatch(/concluido/)
  })

  it('recusa escrever numa inscricao ja concluida', () => {
    // Sem isso, o link continua editavel para sempre depois de fechado.
    expect(codigo).toMatch(/estado\.concluida/)
  })

  it('so grava nas colunas do nucleo, nunca no nome cru do passo fixo', () => {
    // `confirmar_titular`, `abertura`, `buffet` e `revisao` tambem tem
    // `fixo`, e usa-los como nome de coluna quebraria a gravacao.
    expect(codigo).toMatch(/COLUNAS_DO_NUCLEO/)
  })

  it('usa o cliente de servico, que ignora RLS — e por isso filtra por token', () => {
    expect(codigo).toMatch(/criarClienteAdmin/)
  })
})
