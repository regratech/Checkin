import { describe, it, expect, vi } from 'vitest'
import { slugificar, prefixoPadrao, criarEvento } from './eventos'

describe('slugificar', () => {
  it('baixa a caixa, tira acento e troca espaco por hifen', () => {
    expect(slugificar('Engrenagem São Paulo 2026')).toBe('engrenagem-sao-paulo-2026')
  })

  it('remove pontuacao', () => {
    expect(slugificar('Check-in: Buffets & Cia.')).toBe('check-in-buffets-cia')
  })

  it('nao deixa hifen sobrando nas pontas', () => {
    expect(slugificar('  Engrenagem!  ')).toBe('engrenagem')
  })
})

describe('prefixoPadrao', () => {
  it('junta as tres primeiras letras com os dois digitos do ano', () => {
    expect(prefixoPadrao('Engrenagem', 2026)).toBe('ENG26')
  })

  it('ignora espacos e acentos ao montar as letras', () => {
    expect(prefixoPadrao('Só Buffet', 2027)).toBe('SOB27')
  })
})

function clienteFalso(retorno: unknown, erro: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: retorno, error: erro })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  const from = vi.fn().mockReturnValue({ insert })
  return { cliente: { from } as never, from, insert }
}

describe('criarEvento', () => {
  it('grava slug e prefixo derivados do nome quando nao sao informados', async () => {
    const { cliente, from, insert } = clienteFalso({ id: 'e1', nome: 'Engrenagem' })

    await criarEvento(cliente, { nome: 'Engrenagem', data: '2026-09-10' })

    expect(from).toHaveBeenCalledWith('eventos')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Engrenagem',
        slug: 'engrenagem',
        prefixo_codigo: 'ENG26',
        data: '2026-09-10',
      }),
    )
  })

  it('respeita o prefixo informado a mao', async () => {
    const { cliente, insert } = clienteFalso({ id: 'e1' })

    await criarEvento(cliente, {
      nome: 'Engrenagem',
      data: '2026-09-10',
      prefixo_codigo: 'ENGX',
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ prefixo_codigo: 'ENGX' }),
    )
  })

  it('propaga o erro do banco em vez de devolver dado vazio', async () => {
    const { cliente } = clienteFalso(null, { message: 'slug duplicado' })

    await expect(criarEvento(cliente, { nome: 'Engrenagem' })).rejects.toThrow(
      'slug duplicado',
    )
  })
})
