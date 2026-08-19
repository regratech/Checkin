import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/002_rls.sql'),
  'utf-8',
)

const tabelas = [
  'perfis',
  'eventos',
  'pessoas',
  'inscricoes',
  'participantes',
  'perguntas',
  'respostas',
  'sincronizacoes',
]

describe('migration 002 - row level security', () => {
  it.each(tabelas)('liga RLS na tabela %s', (tabela) => {
    expect(sql).toMatch(
      new RegExp(`alter table ${tabela} enable row level security`, 'i'),
    )
  })

  it.each(tabelas)('a tabela %s tem ao menos uma politica', (tabela) => {
    expect(sql).toMatch(new RegExp(`create policy "[^"]+" on ${tabela}`, 'i'))
  })

  it('eh_admin e security definer com search_path fixo', () => {
    // Sem `set search_path`, uma funcao security definer pode ser enganada
    // por uma tabela homonima criada num schema que venha antes no caminho.
    expect(sql).toMatch(/create function eh_admin\(\) returns boolean/i)
    expect(sql).toMatch(/security definer/i)
    expect(sql).toMatch(/set search_path = public/i)
  })

  it('nao existe politica que libere leitura para quem nao esta autenticado', () => {
    // Os dados das inscricoes sao pessoais. O participante nunca le tabela:
    // chega pelo token e as rotas de servidor devolvem so o passo dele.
    expect(sql).not.toMatch(/using \(true\)/i)
  })

  it('perfil nao pode se auto-promover a admin', () => {
    expect(sql).toMatch(/papel = 'publico'/i)
  })
})
