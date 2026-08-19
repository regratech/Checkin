import { describe, it, expect } from 'vitest'
import { lerConfigSupabase, lerChaveServico } from './config'

const valido = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://vyjxyczbscdkfhdabrxk.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc123',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc123',
}

describe('lerConfigSupabase', () => {
  it('devolve url e chave quando esta tudo certo', () => {
    expect(lerConfigSupabase(valido)).toEqual({
      url: 'https://vyjxyczbscdkfhdabrxk.supabase.co',
      anon: 'sb_publishable_abc123',
    })
  })

  it('recusa a URL com /rest/v1 no fim, explicando o erro', () => {
    // Erro real cometido na configuracao: copiaram o endpoint REST do painel
    // em vez do Project URL. A biblioteca acrescenta /rest/v1 sozinha, e o
    // resultado eram consultas devolvendo null em silencio.
    expect(() =>
      lerConfigSupabase({
        ...valido,
        NEXT_PUBLIC_SUPABASE_URL: 'https://vyjxyczbscdkfhdabrxk.supabase.co/rest/v1/',
      }),
    ).toThrow(/Project URL/i)
  })

  it('recusa a URL do painel', () => {
    expect(() =>
      lerConfigSupabase({
        ...valido,
        NEXT_PUBLIC_SUPABASE_URL:
          'https://supabase.com/dashboard/project/vyjxyczbscdkfhdabrxk',
      }),
    ).toThrow(/supabase\.co/i)
  })

  it('recusa espaco sobrando, que passa despercebido ao colar', () => {
    expect(() =>
      lerConfigSupabase({ ...valido, NEXT_PUBLIC_SUPABASE_URL: ' ' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('diz qual variavel falta, em vez de estourar mais adiante', () => {
    expect(() =>
      lerConfigSupabase({ ...valido, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })
})

describe('lerChaveServico', () => {
  it('devolve a chave de servico', () => {
    expect(lerChaveServico(valido)).toBe('sb_secret_abc123')
  })

  it('reclama quando falta', () => {
    expect(() => lerChaveServico({ ...valido, SUPABASE_SERVICE_ROLE_KEY: '' })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    )
  })
})
