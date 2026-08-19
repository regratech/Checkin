import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './recuperacao.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('clientes de recuperacao de senha', () => {
  it('usam flowType implicit, nunca pkce', () => {
    // pkce exige que o link seja aberto no MESMO navegador que pediu. O caso
    // comum e pedir no notebook e abrir no celular — e ai o Supabase recusa
    // com "link invalido", indistinguivel de link expirado.
    expect(codigo).toMatch(/flowType:\s*'implicit'/)
    expect(codigo).not.toMatch(/flowType:\s*'pkce'/)
  })

  it('o cliente de servidor nao guarda sessao', () => {
    expect(codigo).toMatch(/persistSession:\s*false/)
  })

  it('o cliente de navegador le o token do fragmento da URL', () => {
    expect(codigo).toMatch(/detectSessionInUrl:\s*true/)
  })

  it('valida a configuracao como os demais clientes', () => {
    expect(codigo).toMatch(/lerConfigSupabase/)
  })

  it('nunca usa a chave de servico', () => {
    expect(codigo).not.toMatch(/SERVICE_ROLE|lerChaveServico/)
  })
})
