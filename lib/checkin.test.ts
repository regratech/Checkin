import { describe, it, expect } from 'vitest'
import {
  chaveDeResposta,
  proximoIndice,
  podeAvancar,
  respostasDoNucleo,
} from './checkin'
import { expandirRoteiro } from './roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

const cargo: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual sua função?', tipo: 'selecao_unica', escopo: 'participante',
  obrigatoria: true, ordem: 1,
  opcoes: [{ chave: 'faz_tudo', rotulo: 'Faço tudo' }], ajuda: null, ativa: true,
}

const opcional: Pergunta = {
  ...cargo, id: 'q2', chave: 'instagram', tipo: 'texto_curto',
  obrigatoria: false, opcoes: null,
}

describe('chaveDeResposta', () => {
  it('e a mesma chave do passo', () => {
    const doSegundo = expandirRoteiro([cargo], 2).find((p) => p.chave === 'p2.cargo')
    expect(chaveDeResposta(doSegundo!)).toBe('p2.cargo')
  })
})

describe('proximoIndice', () => {
  it('avanca um passo', () => {
    expect(proximoIndice(expandirRoteiro([], 1), 0)).toBe(1)
  })

  it('para no ultimo, em vez de estourar o fim', () => {
    const passos = expandirRoteiro([], 1)
    expect(proximoIndice(passos, passos.length - 1)).toBe(passos.length - 1)
  })
})

describe('podeAvancar', () => {
  function passoDe(pergunta: Pergunta) {
    return expandirRoteiro([pergunta], 1).find((p) => p.pergunta?.id === pergunta.id)!
  }

  it('aceita resposta valida', () => {
    expect(podeAvancar(passoDe(cargo), 'faz_tudo')).toEqual({ ok: true })
  })

  it('recusa resposta invalida', () => {
    expect(podeAvancar(passoDe(cargo), 'inventada').ok).toBe(false)
  })

  it('pergunta obrigatoria nao aceita vazio', () => {
    const r = podeAvancar(passoDe(cargo), '')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toMatch(/obrigat/i)
  })

  it('pergunta opcional aceita vazio', () => {
    expect(podeAvancar(passoDe(opcional), '')).toEqual({ ok: true })
  })

  it('passo fixo de abertura nao exige resposta', () => {
    expect(podeAvancar(expandirRoteiro([], 1)[0], undefined)).toEqual({ ok: true })
  })

  it('passo composto passa direto: quem valida e validarComposto', () => {
    // Os campos do acompanhante viram um bloco so, porque a linha em
    // `participantes` precisa de nome e email ao mesmo tempo para nascer.
    const bloco = expandirRoteiro([], 2).find((p) => p.chave === 'p2.dados_participante')!
    expect(bloco).toBeDefined()
    expect(podeAvancar(bloco, undefined)).toEqual({ ok: true })
  })
})

describe('respostasDoNucleo', () => {
  const participantes = [
    {
      id: 'a', inscricao_id: 'i1', pessoa_id: 'x', ordem: 1, titular: true,
      nome: 'Janaína', email: 'j@g.com', telefone: '51998128616',
      data_nascimento: '1978-10-05', nome_cracha: 'Janaina', cargo: null,
    },
    {
      id: 'b', inscricao_id: 'i1', pessoa_id: 'y', ordem: 2, titular: false,
      nome: 'Leonardo', email: 'l@g.com', telefone: null,
      data_nascimento: null, nome_cracha: null, cargo: null,
    },
  ]

  it('chaveia cada campo do nucleo pelo passo correspondente', () => {
    // A revisao lia so `respostas`, que traz apenas perguntas. Sem isto os
    // campos do nucleo apareciam "em branco" mesmo estando gravados.
    const r = respostasDoNucleo(participantes)
    expect(r['p1.nome']).toBe('Janaína')
    expect(r['p2.email']).toBe('l@g.com')
    expect(r['p1.data_nascimento']).toBe('1978-10-05')
  })

  it('omite campo nulo em vez de gravar a palavra null', () => {
    const r = respostasDoNucleo(participantes)
    expect(r['p2.telefone']).toBeUndefined()
    expect(r['p2.nome_cracha']).toBeUndefined()
  })

  it('lista vazia devolve objeto vazio', () => {
    expect(respostasDoNucleo([])).toEqual({})
  })
})
