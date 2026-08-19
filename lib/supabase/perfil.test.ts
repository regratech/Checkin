import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/005_perfil_automatico.sql'),
  'utf-8',
)

describe('migration 005 - perfil automatico', () => {
  it('dispara depois de inserir em auth.users', () => {
    expect(sql).toMatch(/after insert on auth\.users/i)
  })

  it('a funcao do trigger e security definer com search_path fixo', () => {
    expect(sql).toMatch(/security definer/i)
    expect(sql).toMatch(/set search_path = public/i)
  })

  it('insere em perfis a partir do novo usuario', () => {
    expect(sql).toMatch(/insert into perfis/i)
    expect(sql).toMatch(/new\.id/)
    expect(sql).toMatch(/new\.email/)
  })

  it('fixa o papel em publico literal, nunca vindo dos metadados', () => {
    // raw_user_meta_data e controlado por quem se cadastra. Se `papel` for
    // lido de la, o trigger security definer vira caminho de escalada de
    // privilegio que passa por cima da RLS de perfis.
    expect(sql).not.toMatch(/raw_user_meta_data->>'papel'/i)
    expect(sql).not.toMatch(/new\.papel/i)
    const valores = sql.match(/values\s*\(([\s\S]*?)\);/i)?.[1] ?? ''
    expect(valores).toMatch(/'publico'/)
  })

  it('tem nome mesmo quando o cadastro nao mandou metadados', () => {
    // perfis.nome e not null. Conta criada pelo painel do Supabase nao
    // manda metadado nenhum; sem fallback o trigger derruba o cadastro.
    expect(sql).toMatch(/coalesce\(/i)
    expect(sql).toMatch(/split_part\(new\.email/i)
  })
})
