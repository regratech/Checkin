import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/003_codigo_inscricao.sql'),
  'utf-8',
)

describe('migration 003 - codigo legivel da inscricao', () => {
  it('cria a funcao que recebe o evento e devolve texto', () => {
    expect(sql).toMatch(
      /create function gerar_codigo_inscricao\(p_evento_id uuid\)\s*returns text/i,
    )
  })

  it('incrementa o contador do evento na mesma instrucao que le', () => {
    // Um `select` seguido de `update` permite que duas transacoes leiam o
    // mesmo numero e gerem codigos iguais. `update ... returning` trava a
    // linha do evento e resolve leitura e escrita de uma vez.
    expect(sql).toMatch(
      /update eventos[\s\S]*set proximo_codigo = proximo_codigo \+ 1[\s\S]*returning/i,
    )
  })

  it('formata com quatro digitos e zero a esquerda', () => {
    expect(sql).toMatch(/lpad\(/i)
    expect(sql).toMatch(/'0'/)
    expect(sql).toMatch(/, 4, /)
  })

  it('junta prefixo e numero com hifen', () => {
    expect(sql).toMatch(/\|\| '-' \|\|/)
  })

  it('a funcao e volatile, nunca stable ou immutable', () => {
    // Ela escreve: marcar como stable faria o planejador cachear o
    // resultado e devolver o mesmo codigo duas vezes na mesma query.
    expect(sql).not.toMatch(/language plpgsql\s+stable/i)
    expect(sql).not.toMatch(/language plpgsql\s+immutable/i)
  })
})
