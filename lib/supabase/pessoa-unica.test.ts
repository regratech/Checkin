import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/006_pessoa_unica_por_inscricao.sql'),
  'utf-8',
)

describe('migration 006 - uma pessoa nao se leva duas vezes', () => {
  it('cria a restricao de unicidade em (inscricao_id, pessoa_id)', () => {
    expect(sql).toMatch(
      /alter table participantes\s+add constraint \w+\s+unique \(inscricao_id, pessoa_id\)/i,
    )
  })

  it('traz a consulta que mostra as violacoes antes de rodar', () => {
    // A restricao falha se ja existir dado que a viole, e a mensagem crua do
    // Postgres nao diz QUAL linha e a culpada. A consulta economiza esse
    // trabalho de garimpo.
    expect(sql).toMatch(/group by .*pessoa_id/i)
    expect(sql).toMatch(/having count\(\*\) > 1/i)
  })

  it('nao apaga dado nenhum por conta propria', () => {
    // Decidir qual das duas linhas some e do dono do dado, nao da migration.
    expect(sql).not.toMatch(/^\s*delete from/im)
    expect(sql).not.toMatch(/truncate/i)
  })
})
