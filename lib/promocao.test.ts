import { describe, it, expect, vi } from 'vitest'
import { promover } from './promocao'

const compra = {
  created_at: '2026-06-23 09:00:37',
  name: 'Diogo Rodrigues De Souza',
  doc: '7937761636',
  email: 'pallacebuffetptc@gmail.com',
  phone: '34993395999',
  quantity: 2,
  status: 'A',
  product: 'Engrenagem [PRÉ-VENDA - 2 INSCRIÇÕES]',
}

function cliente({ jaExiste = false }: { jaExiste?: boolean } = {}) {
  const gravadas: Record<string, unknown[]> = {
    inscricoes: [],
    participantes: [],
    sincronizacoes: [],
  }

  const from = vi.fn((tabela: string) => {
    if (tabela === 'inscricoes') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: jaExiste ? { id: 'insc-existente', codigo: 'ENG26-0001' } : null,
                error: null,
              }),
            }),
          }),
        }),
        insert: (linha: unknown) => {
          gravadas.inscricoes.push(linha)
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'insc-nova', ...(linha as object) },
                error: null,
              }),
            }),
          }
        },
      }
    }
    if (tabela === 'pessoas') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
        insert: () => ({
          select: () => ({ single: async () => ({ data: { id: 'pessoa-1' }, error: null }) }),
        }),
      }
    }
    if (tabela === 'sincronizacoes') {
      return {
        update: (linha: unknown) => {
          gravadas.sincronizacoes.push(linha)
          return { eq: async () => ({ error: null }) }
        },
      }
    }
    return {
      insert: async (linha: unknown) => {
        gravadas.participantes.push(linha)
        return { error: null }
      },
    }
  })

  const rpc = vi.fn().mockResolvedValue({ data: 'ENG26-0007', error: null })
  return { cliente: { from, rpc } as never, gravadas, rpc }
}

describe('promover', () => {
  it('cria a inscricao a partir de uma compra aprovada', async () => {
    const { cliente: c, gravadas, rpc } = cliente()

    const r = await promover(c, 'ev-1', 'sinc-1', compra)

    expect(r.estado).toBe('criada')
    expect(rpc).toHaveBeenCalledWith('gerar_codigo_inscricao', { p_evento_id: 'ev-1' })
    expect(gravadas.inscricoes[0]).toMatchObject({
      origem: 'webhook',
      vagas: 2,
      email_compra: 'pallacebuffetptc@gmail.com',
      documento_compra: '7937761636',
      codigo: 'ENG26-0007',
    })
  })

  it('guarda o payload inteiro, para conferencia depois', async () => {
    // A primeira venda real e a unica chance de ver o formato completo.
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(gravadas.inscricoes[0]).toHaveProperty('guru_payload')
  })

  it('gera o token do link de check-in', async () => {
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    const token = (gravadas.inscricoes[0] as { token: string }).token
    expect(String(token).length).toBeGreaterThanOrEqual(32)
  })

  it('cria o titular como participante de ordem 1', async () => {
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(gravadas.participantes[0]).toMatchObject({
      ordem: 1,
      titular: true,
      nome: 'Diogo Rodrigues De Souza',
    })
  })

  it('nao cria os acompanhantes: eles nascem na conversa', async () => {
    // A linha do acompanhante precisa de nome e email, que so o titular
    // informa durante o check-in.
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(gravadas.participantes).toHaveLength(1)
  })

  it('a mesma compra chegando de novo nao cria outra inscricao', async () => {
    // O webhook pode ser reenviado: falha de rede, retentativa do Guru.
    const { cliente: c, gravadas, rpc } = cliente({ jaExiste: true })

    const r = await promover(c, 'ev-1', 'sinc-1', compra)

    expect(r.estado).toBe('repetida')
    expect(gravadas.inscricoes).toHaveLength(0)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('compra nao aprovada fica guardada, sem virar inscricao', async () => {
    const { cliente: c, gravadas } = cliente()

    const r = await promover(c, 'ev-1', 'sinc-1', { ...compra, status: 'P' })

    expect(r.estado).toBe('aguardando')
    expect(gravadas.inscricoes).toHaveLength(0)
  })

  it('payload ilegivel devolve erro sem derrubar nada', async () => {
    const { cliente: c } = cliente()

    const r = await promover(c, 'ev-1', 'sinc-1', { name: 'Alguém', email: '' })

    expect(r.estado).toBe('erro')
    expect(r.estado === 'erro' && r.erro).toMatch(/email/i)
  })

  it('marca a sincronizacao com o desfecho', async () => {
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(gravadas.sincronizacoes[0]).toMatchObject({ status: 'promovida' })
  })

  it('a sincronizacao com erro guarda o motivo', async () => {
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', { name: 'Alguém', email: '' })
    expect(gravadas.sincronizacoes[0]).toMatchObject({ status: 'erro' })
    const erro = (gravadas.sincronizacoes[0] as { erro: string }).erro
    expect(String(erro)).toMatch(/email/i)
  })
})
