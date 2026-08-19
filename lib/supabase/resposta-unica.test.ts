import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/007_resposta_unica_com_nulo.sql'),
  'utf-8',
)

describe('migration 007 - resposta unica mesmo com participante nulo', () => {
  it('recria a unicidade com nulls not distinct', () => {
    // Sem isto, duas respostas da mesma pergunta de escopo `inscricao`
    // convivem: `NULL != NULL` para efeito de unique no Postgres.
    expect(sql).toMatch(/unique nulls not distinct/i)
    expect(sql).toMatch(/\(pergunta_id, inscricao_id, participante_id\)/i)
  })

  it('remove a restricao antiga achando o nome, em vez de chutar', () => {
    // O nome gerado automaticamente e longo e pode variar; procurar no
    // catalogo e mais seguro do que escrever o nome na mao.
    expect(sql).toMatch(/pg_constraint/i)
    expect(sql).toMatch(/drop constraint/i)
  })

  it('limpa duplicatas antes de criar, senao a restricao nao nasce', () => {
    expect(sql).toMatch(/delete from respostas/i)
    expect(sql).toMatch(/row_number\(\)/i)
  })
})
