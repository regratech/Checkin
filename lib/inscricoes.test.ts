import { describe, it, expect, vi } from 'vitest'
import { gerarToken, resolverPessoa, criarInscricaoManual } from './inscricoes'

describe('gerarToken', () => {
  it('tem pelo menos 32 caracteres', () => {
    // O token e a unica credencial do link de check-in. Curto demais e
    // adivinhavel, e adivinhar um token expoe os dados de um buffet inteiro.
    expect(gerarToken().length).toBeGreaterThanOrEqual(32)
  })

  it('nao repete', () => {
    const gerados = new Set(Array.from({ length: 200 }, () => gerarToken()))
    expect(gerados.size).toBe(200)
  })

  it('usa so caracteres seguros para URL', () => {
    expect(gerarToken()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('resolverPessoa', () => {
  function clientePessoas(existente: { id: string } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: existente, error: null })
    const eqNome = vi.fn().mockReturnValue({ maybeSingle })
    const eqEmail = vi.fn().mockReturnValue({ eq: eqNome })
    const select = vi.fn().mockReturnValue({ eq: eqEmail })

    const singleInsert = vi.fn().mockResolvedValue({ data: { id: 'nova' }, error: null })
    const selectInsert = vi.fn().mockReturnValue({ single: singleInsert })
    const insert = vi.fn().mockReturnValue({ select: selectInsert })

    const from = vi.fn().mockReturnValue({ select, insert })
    return { cliente: { from } as never, insert, eqEmail, eqNome }
  }

  it('reaproveita a ficha quando email e nome batem', async () => {
    const { cliente, insert } = clientePessoas({ id: 'p-existente' })

    const id = await resolverPessoa(cliente, ' Cenise@BOL.com.br ', 'Cenise  Jonsson')

    expect(id).toBe('p-existente')
    expect(insert).not.toHaveBeenCalled()
  })

  it('procura pela chave normalizada, nao pelo texto cru', async () => {
    const { cliente, eqEmail, eqNome } = clientePessoas({ id: 'p1' })

    await resolverPessoa(cliente, ' Cenise@BOL.com.br ', 'Cenise  Jonsson')

    expect(eqEmail).toHaveBeenCalledWith('email', 'cenise@bol.com.br')
    expect(eqNome).toHaveBeenCalledWith('nome_chave', 'cenise jonsson')
  })

  it('cria ficha nova quando o nome difere, mesmo com o email igual', async () => {
    // Caso real: Leonardo Guerrieri cadastrado sob laguerryeventos@gmail.com,
    // o email da Janaina. Sao duas pessoas.
    const { cliente, insert } = clientePessoas(null)

    const id = await resolverPessoa(
      cliente,
      'laguerryeventos@gmail.com',
      'Leonardo Guerrieri',
    )

    expect(id).toBe('nova')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'laguerryeventos@gmail.com',
        nome_chave: 'leonardo guerrieri',
        nome_recente: 'Leonardo Guerrieri',
      }),
    )
  })
})

describe('criarInscricaoManual', () => {
  function clienteCompleto() {
    const chamadas: Record<string, unknown[]> = { inscricoes: [], participantes: [] }

    const rpc = vi.fn().mockResolvedValue({ data: 'ENG26-0042', error: null })

    const from = vi.fn((tabela: string) => {
      if (tabela === 'pessoas') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
          insert: (linha: unknown) => ({
            select: () => ({
              single: async () => ({
                data: { id: `pessoa-${(linha as { nome_chave: string }).nome_chave}` },
                error: null,
              }),
            }),
          }),
        }
      }
      if (tabela === 'inscricoes') {
        return {
          insert: (linha: unknown) => {
            chamadas.inscricoes.push(linha)
            return {
              select: () => ({
                single: async () => ({
                  data: { id: 'insc-1', ...(linha as object) },
                  error: null,
                }),
              }),
            }
          },
        }
      }
      return {
        insert: (linhas: unknown) => {
          chamadas.participantes.push(linhas)
          return { select: async () => ({ data: linhas, error: null }) }
        },
      }
    })

    return { cliente: { from, rpc } as never, rpc, chamadas }
  }

  const entrada = {
    evento_id: 'ev-1',
    vagas: 2,
    empresa_nome: 'La Guerry Gastronomia',
    empresa_cidade: 'Porto Alegre / RS',
    participantes: [
      { nome: 'Janaína Garcia Guerrieri', email: 'laguerryeventos@gmail.com' },
      { nome: 'Leonardo Guerrieri', email: 'laguerryeventos@gmail.com' },
    ],
  }

  it('pede o codigo ao banco em vez de inventar um', async () => {
    const { cliente, rpc, chamadas } = clienteCompleto()

    await criarInscricaoManual(cliente, entrada)

    expect(rpc).toHaveBeenCalledWith('gerar_codigo_inscricao', { p_evento_id: 'ev-1' })
    expect(chamadas.inscricoes[0]).toMatchObject({
      codigo: 'ENG26-0042',
      origem: 'manual',
    })
  })

  it('marca so o primeiro como titular e numera a ordem a partir de 1', async () => {
    const { cliente, chamadas } = clienteCompleto()

    await criarInscricaoManual(cliente, entrada)

    const linhas = chamadas.participantes[0] as Array<Record<string, unknown>>
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toMatchObject({ ordem: 1, titular: true })
    expect(linhas[1]).toMatchObject({ ordem: 2, titular: false })
  })

  it('liga cada participante a uma pessoa diferente apesar do email igual', async () => {
    const { cliente, chamadas } = clienteCompleto()

    await criarInscricaoManual(cliente, entrada)

    const linhas = chamadas.participantes[0] as Array<Record<string, unknown>>
    expect(linhas[0].pessoa_id).not.toBe(linhas[1].pessoa_id)
  })

  it('recusa mais participantes do que vagas', async () => {
    const { cliente } = clienteCompleto()

    await expect(
      criarInscricaoManual(cliente, { ...entrada, vagas: 1 }),
    ).rejects.toThrow(/vagas/i)
  })

  it('recusa inscricao sem nenhum participante', async () => {
    const { cliente } = clienteCompleto()

    await expect(
      criarInscricaoManual(cliente, { ...entrada, participantes: [] }),
    ).rejects.toThrow(/participante/i)
  })
})
