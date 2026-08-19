import { describe, it, expect } from 'vitest'
import { esquemaLogin } from './esquemas'

describe('esquemaLogin', () => {
  it('aceita email e senha validos', () => {
    const r = esquemaLogin.safeParse({ email: 'a@b.com', senha: 'segredo123' })
    expect(r.success).toBe(true)
  })

  it('normaliza o email para minusculas e sem espacos', () => {
    const r = esquemaLogin.safeParse({ email: '  A@B.COM ', senha: 'segredo123' })
    expect(r.success && r.data.email).toBe('a@b.com')
  })

  it('recusa email malformado com mensagem em portugues', () => {
    const r = esquemaLogin.safeParse({ email: 'nao-e-email', senha: 'segredo123' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0].message).toMatch(/email/i)
  })

  it('recusa senha vazia', () => {
    const r = esquemaLogin.safeParse({ email: 'a@b.com', senha: '' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0].message).toMatch(/senha/i)
  })
})
