import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/004_view_participantes.sql'),
  'utf-8',
)

describe('migration 004 - vw_participantes', () => {
  it('cria a view', () => {
    expect(sql).toMatch(/create view vw_participantes/i)
  })

  it('conta as pessoas preenchidas por inscricao com window function', () => {
    // O numero nunca e digitado: e a contagem real das linhas de
    // participantes. E a correcao dos checkboxes "N insc - mesmos dados".
    expect(sql).toMatch(
      /count\(\*\) over \(partition by p\.inscricao_id\) as pessoas_preenchidas/i,
    )
  })

  it('expoe vagas, que e o numero que define a aba de tamanho de grupo', () => {
    expect(sql).toMatch(/i\.vagas/)
  })

  it('monta o codigo do participante juntando o codigo da inscricao e a ordem', () => {
    expect(sql).toMatch(/i\.codigo \|\| '-' \|\| p\.ordem as codigo_participante/i)
  })

  it('roda com os privilegios de quem consulta, nao os do dono', () => {
    // Sem security_invoker a view ignoraria a RLS das tabelas de baixo.
    expect(sql).toMatch(/security_invoker\s*=\s*(on|true)/i)
  })
})
