import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/008_guru.sql'), 'utf-8')

describe('migration 008 - integracao com o guru', () => {
  it('cada evento tem o proprio segredo de webhook', () => {
    // Um segredo global vazaria o acesso a todos os eventos de uma vez.
    expect(sql).toMatch(/alter table eventos\s+add column webhook_segredo text/i)
  })

  it('o segredo nasce aleatorio, nao em branco', () => {
    expect(sql).toMatch(/gen_random_uuid\(\)|gen_random_bytes/i)
  })

  it('nao depende da extensao pgcrypto', () => {
    // `gen_random_bytes` exigiria pgcrypto, que pode nao estar habilitada —
    // e a migration falharia por um detalhe evitavel.
    expect(sql).not.toMatch(/gen_random_bytes/i)
  })

  it('guarda o documento da compra, que pode ser CPF ou CNPJ', () => {
    // A inscricao da Janaina Guerrieri usa CNPJ de 14 digitos. Modelar como
    // CPF de 11 recusaria dado real.
    expect(sql).toMatch(/add column documento_compra text/i)
    expect(sql).not.toMatch(/char\(11\)|varchar\(11\)/i)
  })

  it('a sincronizacao guarda a chave de idempotencia', () => {
    expect(sql).toMatch(/add column chave text/i)
  })

  it('a mesma chave nao entra duas vezes no mesmo evento', () => {
    // O webhook pode ser reenviado: falha de rede, retentativa do Guru.
    // Sem isto, a mesma compra viraria duas inscricoes.
    expect(sql).toMatch(/unique.*\(evento_id, chave\)/is)
  })

  it('a unicidade vale mesmo com chave nula', () => {
    // NULL nunca e igual a NULL num unique do Postgres — foi o defeito que
    // a migration 007 corrigiu em `respostas`. Nao repetir aqui.
    expect(sql).toMatch(/nulls not distinct/i)
  })
})
