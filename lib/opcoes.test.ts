import { describe, it, expect } from 'vitest'
import {
  lerOpcoes,
  rotuloDaOpcao,
  opcoesDeTexto,
  textoDeOpcoes,
  precisaDeOpcoes,
} from './opcoes'

describe('lerOpcoes', () => {
  it('le a forma completa', () => {
    expect(
      lerOpcoes([{ chave: 'faz_tudo', rotulo: 'Faço tudo', rotulo_acompanhante: 'Faz tudo' }]),
    ).toEqual([{ chave: 'faz_tudo', rotulo: 'Faço tudo', rotulo_acompanhante: 'Faz tudo' }])
  })

  it('aceita opcao sem voz de acompanhante', () => {
    expect(lerOpcoes([{ chave: 'sim', rotulo: 'Sim' }])).toEqual([
      { chave: 'sim', rotulo: 'Sim' },
    ])
  })

  it('devolve lista vazia para nulo, em vez de quebrar', () => {
    // `opcoes` e jsonb e pode estar nulo em pergunta de texto.
    expect(lerOpcoes(null)).toEqual([])
    expect(lerOpcoes(undefined)).toEqual([])
  })

  it('descarta entrada malformada em vez de derrubar a tela', () => {
    expect(lerOpcoes([{ rotulo: 'sem chave' }, 'nao e objeto', null])).toEqual([])
  })
})

describe('rotuloDaOpcao', () => {
  const opcao = {
    chave: 'faz_tudo',
    rotulo: 'Eu que planejo, organizo, coordeno e faço a comida.',
    rotulo_acompanhante: 'Planeja, organiza, coordena e faz a comida.',
  }

  it('usa a primeira pessoa para o titular', () => {
    expect(rotuloDaOpcao(opcao, true)).toMatch(/^Eu que planejo/)
  })

  it('usa a terceira pessoa para o acompanhante', () => {
    expect(rotuloDaOpcao(opcao, false)).toMatch(/^Planeja/)
  })

  it('cai no rotulo unico quando nao ha voz de acompanhante', () => {
    const simples = { chave: 'sim', rotulo: 'Sim' }
    expect(rotuloDaOpcao(simples, false)).toBe('Sim')
    expect(rotuloDaOpcao(simples, true)).toBe('Sim')
  })
})

describe('opcoesDeTexto', () => {
  it('uma opcao por linha', () => {
    expect(opcoesDeTexto('Sim\nNão')).toEqual([
      { chave: 'sim', rotulo: 'Sim' },
      { chave: 'nao', rotulo: 'Não' },
    ])
  })

  it('separa as duas vozes por barra vertical', () => {
    const [opcao] = opcoesDeTexto('Faço a comida | Faz a comida')
    expect(opcao).toEqual({
      chave: 'faco_a_comida',
      rotulo: 'Faço a comida',
      rotulo_acompanhante: 'Faz a comida',
    })
  })

  it('ignora linhas em branco', () => {
    expect(opcoesDeTexto('Sim\n\n  \nNão')).toHaveLength(2)
  })

  it('desambigua chave repetida em vez de gerar duas iguais', () => {
    // Duas opcoes com a mesma chave quebrariam a leitura da resposta.
    const opcoes = opcoesDeTexto('Outros\nOutros')
    expect(opcoes.map((o) => o.chave)).toEqual(['outros', 'outros_2'])
  })

  it('gera chave estavel a partir do texto, sem acento', () => {
    expect(opcoesDeTexto('Ilha gastronômica')[0].chave).toBe('ilha_gastronomica')
  })
})

describe('textoDeOpcoes', () => {
  it('desfaz o que opcoesDeTexto fez', () => {
    const original = 'Faço a comida | Faz a comida\nSó administro'
    expect(textoDeOpcoes(opcoesDeTexto(original))).toBe(original)
  })
})

describe('precisaDeOpcoes', () => {
  it('selecao unica e multipla precisam', () => {
    expect(precisaDeOpcoes('selecao_unica')).toBe(true)
    expect(precisaDeOpcoes('selecao_multipla')).toBe(true)
  })

  it('os demais tipos nao', () => {
    for (const tipo of ['texto_curto', 'numero', 'data', 'nota_estrela', 'sim_nao'] as const) {
      expect(precisaDeOpcoes(tipo)).toBe(false)
    }
  })
})
