import { describe, it, expect } from 'vitest'
import { chaveDePergunta, esquemaPergunta, moverPergunta } from './perguntas'

describe('chaveDePergunta', () => {
  it('deriva do rotulo, sem acento e em minusculas', () => {
    expect(chaveDePergunta('Faturamento médio mensal', [])).toBe('faturamento_medio_mensal')
  })

  it('desambigua quando a chave ja existe no evento', () => {
    // `unique (evento_id, chave)` recusaria a segunda; melhor resolver aqui
    // do que devolver erro de banco a quem esta cadastrando.
    expect(chaveDePergunta('Faturamento', ['faturamento'])).toBe('faturamento_2')
    expect(chaveDePergunta('Faturamento', ['faturamento', 'faturamento_2'])).toBe('faturamento_3')
  })

  it('rotulo so de pontuacao ainda gera chave valida', () => {
    expect(chaveDePergunta('???', [])).toMatch(/^pergunta/)
  })

  it('corta chave absurdamente longa', () => {
    expect(chaveDePergunta('a'.repeat(200), []).length).toBeLessThanOrEqual(60)
  })
})

describe('esquemaPergunta', () => {
  const valido = {
    rotulo: 'Faturamento',
    texto_chat: 'Quanto o buffet fatura por mês?',
    tipo: 'numero',
    escopo: 'inscricao',
    obrigatoria: 'on',
    opcoes: '',
    ajuda: '',
  }

  it('aceita uma pergunta valida', () => {
    const r = esquemaPergunta.safeParse(valido)
    expect(r.success).toBe(true)
    expect(r.success && r.data.obrigatoria).toBe(true)
  })

  it('checkbox ausente vira false', () => {
    // Checkbox desmarcado nao aparece no FormData. Um union com
    // z.undefined() NAO torna a chave opcional no Zod 4 — sem `.optional()`
    // toda pergunta nao obrigatoria seria recusada.
    const { obrigatoria: _ignorado, ...semCheckbox } = valido
    const r = esquemaPergunta.safeParse(semCheckbox)
    expect(r.success).toBe(true)
    expect(r.success && r.data.obrigatoria).toBe(false)
  })

  it('recusa tipo inventado', () => {
    expect(esquemaPergunta.safeParse({ ...valido, tipo: 'telepatia' }).success).toBe(false)
  })

  it('recusa escopo inventado', () => {
    expect(esquemaPergunta.safeParse({ ...valido, escopo: 'galaxia' }).success).toBe(false)
  })

  it('exige o texto que a Lara vai falar', () => {
    const r = esquemaPergunta.safeParse({ ...valido, texto_chat: '  ' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0].message).toMatch(/pergunta/i)
  })

  it('selecao sem opcoes e recusada, com mensagem clara', () => {
    const r = esquemaPergunta.safeParse({ ...valido, tipo: 'selecao_unica', opcoes: '' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0].message).toMatch(/opç/i)
  })

  it('selecao com opcoes passa', () => {
    const r = esquemaPergunta.safeParse({ ...valido, tipo: 'selecao_unica', opcoes: 'Sim\nNão' })
    expect(r.success).toBe(true)
  })
})

describe('moverPergunta', () => {
  function clienteComOrdem(lista: Array<{ id: string; ordem: number }>) {
    const atualizacoes: Array<{ id: string; ordem: number }> = []
    const cliente = {
      from: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: lista, error: null }) }) }),
        update: (valores: { ordem: number }) => ({
          eq: async (_c: string, id: string) => {
            atualizacoes.push({ id, ordem: valores.ordem })
            return { error: null }
          },
        }),
      }),
    } as never
    return { cliente, atualizacoes }
  }

  const duas = [
    { id: 'a', ordem: 1 },
    { id: 'b', ordem: 2 },
  ]

  it('trocar com o vizinho de cima escreve as duas ordens', async () => {
    // Reordenar mexendo em duas linhas evita reescrever a lista inteira a
    // cada clique.
    const { cliente, atualizacoes } = clienteComOrdem(duas)
    await moverPergunta(cliente, 'e1', 'b', 'cima')
    expect(atualizacoes).toHaveLength(2)
    expect(atualizacoes.find((u) => u.id === 'b')!.ordem).toBe(1)
    expect(atualizacoes.find((u) => u.id === 'a')!.ordem).toBe(2)
  })

  it('a primeira nao sobe', async () => {
    const { cliente, atualizacoes } = clienteComOrdem(duas)
    await moverPergunta(cliente, 'e1', 'a', 'cima')
    expect(atualizacoes).toHaveLength(0)
  })

  it('a ultima nao desce', async () => {
    const { cliente, atualizacoes } = clienteComOrdem(duas)
    await moverPergunta(cliente, 'e1', 'b', 'baixo')
    expect(atualizacoes).toHaveLength(0)
  })

  it('id que nao esta na lista nao escreve nada', async () => {
    const { cliente, atualizacoes } = clienteComOrdem([{ id: 'a', ordem: 1 }])
    await moverPergunta(cliente, 'e1', 'inexistente', 'cima')
    expect(atualizacoes).toHaveLength(0)
  })
})
