import { describe, it, expect } from 'vitest'
import { CAMPOS_COMPOSTOS, ehPassoComposto, validarComposto } from './composto'
import { expandirRoteiro } from './roteiro'

describe('ehPassoComposto', () => {
  it('reconhece a confirmacao do titular e o buffet', () => {
    const passos = expandirRoteiro([], 2)
    expect(ehPassoComposto(passos.find((p) => p.fixo === 'confirmar_titular')!)).toBe(true)
    expect(ehPassoComposto(passos.find((p) => p.fixo === 'buffet')!)).toBe(true)
  })

  it('nao reconhece abertura nem revisao', () => {
    const passos = expandirRoteiro([], 2)
    expect(ehPassoComposto(passos.find((p) => p.fixo === 'abertura')!)).toBe(false)
    expect(ehPassoComposto(passos.find((p) => p.fixo === 'revisao')!)).toBe(false)
    expect(ehPassoComposto(passos.find((p) => p.fixo === 'dados_participante')!)).toBe(true)
  })
})

describe('CAMPOS_COMPOSTOS', () => {
  it('a confirmacao do titular pede os cinco campos do nucleo', () => {
    expect(CAMPOS_COMPOSTOS.confirmar_titular.map((c) => c.nome)).toEqual([
      'nome',
      'email',
      'telefone',
      'data_nascimento',
      'nome_cracha',
    ])
  })

  it('o buffet pede nome, cidade e instagram', () => {
    expect(CAMPOS_COMPOSTOS.buffet.map((c) => c.nome)).toEqual([
      'empresa_nome',
      'empresa_cidade',
      'empresa_instagram',
    ])
  })
})

describe('validarComposto', () => {
  it('aceita o titular com nome e email', () => {
    const r = validarComposto('confirmar_titular', {
      nome: 'Janaína Garcia Guerrieri',
      email: 'laguerryeventos@gmail.com',
      telefone: '(51) 99812-8616',
      data_nascimento: '05/10/1978',
      nome_cracha: 'Janaina',
    })
    expect(r.ok).toBe(true)
    // Cada campo sai normalizado pelo validador do seu tipo.
    expect(r.ok && r.valores.telefone).toBe('51998128616')
    expect(r.ok && r.valores.data_nascimento).toBe('1978-10-05')
  })

  it('recusa o titular sem nome', () => {
    const r = validarComposto('confirmar_titular', { nome: '', email: 'a@b.com' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toMatch(/nome/i)
  })

  it('recusa o titular sem email', () => {
    const r = validarComposto('confirmar_titular', { nome: 'Janaína', email: '' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toMatch(/email/i)
  })

  it('recusa email malformado, dizendo qual campo', () => {
    const r = validarComposto('confirmar_titular', { nome: 'Janaína', email: 'nao-e-email' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toMatch(/email/i)
  })

  it('aceita telefone e aniversario vazios', () => {
    // Faltaram em varios acompanhantes na planilha real; travar aqui faria
    // o titular abandonar o check-in.
    const r = validarComposto('confirmar_titular', {
      nome: 'Janaína',
      email: 'a@b.com',
      telefone: '',
      data_nascimento: '',
    })
    expect(r.ok).toBe(true)
    expect(r.ok && r.valores.telefone).toBeNull()
  })

  it('aniversario preenchido ainda e validado', () => {
    const r = validarComposto('confirmar_titular', {
      nome: 'Janaína',
      email: 'a@b.com',
      data_nascimento: '00/00/0000',
    })
    expect(r.ok).toBe(false)
  })

  it('o buffet aceita tudo vazio', () => {
    const r = validarComposto('buffet', {})
    expect(r.ok).toBe(true)
    expect(r.ok && r.valores.empresa_nome).toBeNull()
  })

  it('o buffet guarda o que foi escrito', () => {
    const r = validarComposto('buffet', {
      empresa_nome: '  La Guerry Gastronomia ',
      empresa_cidade: 'Porto Alegre / RS',
      empresa_instagram: '@laguerrygastronomia',
    })
    expect(r.ok && r.valores.empresa_nome).toBe('La Guerry Gastronomia')
  })
})
