import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { limpar } from '@/lib/formato'

describe('esqueleto do projeto', () => {
  it('o alias @ resolve para a raiz do projeto', () => {
    expect(limpar('  a   b  ')).toBe('a b')
  })

  it('o exemplo de ambiente tem as tres chaves e nenhuma preenchida', () => {
    const exemplo = readFileSync(resolve(__dirname, '../.env.local.example'), 'utf-8')
    expect(exemplo).toMatch(/^NEXT_PUBLIC_SUPABASE_URL=\s*$/m)
    expect(exemplo).toMatch(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=\s*$/m)
    expect(exemplo).toMatch(/^SUPABASE_SERVICE_ROLE_KEY=\s*$/m)
  })

  it('o gitignore protege o arquivo de ambiente real', () => {
    const ignore = readFileSync(resolve(__dirname, '../.gitignore'), 'utf-8')
    expect(ignore).toMatch(/\.env\*?\.local|\.env\*/)
  })
})
