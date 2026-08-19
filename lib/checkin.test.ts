import { describe, it, expect } from 'vitest'
import { chaveDeResposta, proximoIndice, podeAvancar } from './checkin'
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

  it('nome do participante e sempre obrigatorio', () => {
    // Os campos do nucleo nao sao configuraveis: sem nome, o cracha nao sai.
    const passoNome = expandirRoteiro([], 2).find((p) => p.chave === 'p2.nome')!
    expect(podeAvancar(passoNome, '').ok).toBe(false)
    expect(podeAvancar(passoNome, 'Leonardo Guerrieri')).toEqual({ ok: true })
  })

  it('email do participante e validado como email', () => {
    const passoEmail = expandirRoteiro([], 2).find((p) => p.chave === 'p2.email')!
    expect(podeAvancar(passoEmail, 'nao-e-email').ok).toBe(false)
    expect(podeAvancar(passoEmail, 'leo@guerry.com')).toEqual({ ok: true })
  })

  it('telefone e aniversario do participante sao opcionais', () => {
    // Na planilha real varios acompanhantes vieram sem um ou outro. Travar
    // a conversa por isso faria o titular abandonar o check-in.
    const passos = expandirRoteiro([], 2)
    expect(podeAvancar(passos.find((p) => p.chave === 'p2.telefone')!, '')).toEqual({ ok: true })
    expect(podeAvancar(passos.find((p) => p.chave === 'p2.data_nascimento')!, '')).toEqual({
      ok: true,
    })
  })

  it('aniversario preenchido ainda precisa ser data valida', () => {
    const passo = expandirRoteiro([], 2).find((p) => p.chave === 'p2.data_nascimento')!
    expect(podeAvancar(passo, '00/00/0000').ok).toBe(false)
  })
})
