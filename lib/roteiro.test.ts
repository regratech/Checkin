import { describe, it, expect } from 'vitest'
import { expandirRoteiro, indiceDoPasso, type Passo } from './roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

function pergunta(p: Partial<Pergunta>): Pergunta {
  return {
    id: 'q1', evento_id: 'e1', chave: 'faturamento', rotulo: 'Faturamento',
    texto_chat: 'Quanto o buffet fatura por mês?', tipo: 'numero',
    escopo: 'inscricao', obrigatoria: false, ordem: 1, opcoes: null,
    ajuda: null, ativa: true, ...p,
  }
}

/** -1 para passo de inscrição, que não pertence a ninguém. */
const ordemDe = (p: Passo): number => (p.alvo.tipo === 'participante' ? p.alvo.ordem : -1)

describe('expandirRoteiro', () => {
  it('uma vaga gera um bloco de participante', () => {
    const passos = expandirRoteiro([], 1)
    const deParticipante = passos.filter((p) => p.alvo.tipo === 'participante')
    expect(new Set(deParticipante.map(ordemDe))).toEqual(new Set([1]))
  })

  it('tres vagas geram tres blocos, e o primeiro e o titular', () => {
    // Isto e o que substitui os quatro ramos copiados do Typebot: o numero
    // de blocos e consequencia de `vagas`, nao de codigo escrito a mao.
    const passos = expandirRoteiro([], 3)
    const doParticipante = passos.filter((p) => p.alvo.tipo === 'participante')
    expect(new Set(doParticipante.map(ordemDe))).toEqual(new Set([1, 2, 3]))
    expect(doParticipante.filter((p) => p.titular).every((p) => ordemDe(p) === 1)).toBe(true)
  })

  it('sete vagas funcionam sem ninguem tocar em nada', () => {
    const ordens = expandirRoteiro([], 7)
      .filter((p) => p.alvo.tipo === 'participante')
      .map(ordemDe)
    expect(Math.max(...ordens)).toBe(7)
  })

  it('comeca pela abertura e termina pela revisao', () => {
    const passos = expandirRoteiro([], 2)
    expect(passos[0].fixo).toBe('abertura')
    expect(passos[passos.length - 1].fixo).toBe('revisao')
  })

  it('o titular confirma os dados; o acompanhante nao', () => {
    // O unico momento com dado pre-existente e o titular, que vem do Guru.
    // Acompanhantes sao coleta em branco — nao ha o que confirmar.
    const confirmacoes = expandirRoteiro([], 2).filter((p) => p.fixo === 'confirmar_titular')
    expect(confirmacoes).toHaveLength(1)
    expect(confirmacoes[0].alvo).toEqual({ tipo: 'participante', ordem: 1 })
  })

  it('pergunta de escopo participante se repete uma vez por vaga', () => {
    const cargo = pergunta({ id: 'q-cargo', chave: 'cargo', escopo: 'participante' })
    const doCargo = expandirRoteiro([cargo], 3).filter((p) => p.pergunta?.chave === 'cargo')
    expect(doCargo).toHaveLength(3)
    expect(doCargo.map(ordemDe)).toEqual([1, 2, 3])
  })

  it('pergunta de escopo inscricao aparece uma vez so', () => {
    const passos = expandirRoteiro([pergunta({})], 4)
    expect(passos.filter((p) => p.pergunta?.chave === 'faturamento')).toHaveLength(1)
  })

  it('as perguntas do buffet vem depois de todos os participantes', () => {
    const cargo = pergunta({ id: 'q-cargo', chave: 'cargo', escopo: 'participante' })
    const passos = expandirRoteiro([cargo, pergunta({})], 2)
    const ultimoParticipante = passos.map((p) => p.alvo.tipo).lastIndexOf('participante')
    const doBuffet = passos.findIndex((p) => p.pergunta?.chave === 'faturamento')
    expect(doBuffet).toBeGreaterThan(ultimoParticipante)
  })

  it('respeita a ordem cadastrada', () => {
    const a = pergunta({ id: 'a', chave: 'segunda', ordem: 2 })
    const b = pergunta({ id: 'b', chave: 'primeira', ordem: 1 })
    const chaves = expandirRoteiro([a, b], 1)
      .filter((p) => p.pergunta)
      .map((p) => p.pergunta!.chave)
    expect(chaves).toEqual(['primeira', 'segunda'])
  })

  it('ignora pergunta desativada', () => {
    // Desativar preserva as respostas ja dadas; so tira do roteiro daqui
    // para a frente.
    expect(expandirRoteiro([pergunta({ ativa: false })], 1).some((p) => p.pergunta)).toBe(false)
  })

  it('cada passo tem chave unica, para servir de marcador de retomada', () => {
    const cargo = pergunta({ id: 'q-cargo', chave: 'cargo', escopo: 'participante' })
    const chaves = expandirRoteiro([cargo, pergunta({})], 3).map((p) => p.chave)
    expect(new Set(chaves).size).toBe(chaves.length)
  })

  it('a chave do passo diz a quem ele pertence', () => {
    const cargo = pergunta({ id: 'q-cargo', chave: 'cargo', escopo: 'participante' })
    const doSegundo = expandirRoteiro([cargo], 2).find(
      (p) => p.pergunta?.chave === 'cargo' && ordemDe(p) === 2,
    )
    expect(doSegundo!.chave).toContain('2')
  })

  it('vagas invalidas viram uma vaga, em vez de roteiro vazio', () => {
    // `vagas` vem do banco com check >= 1, mas a funcao e pura e pode ser
    // chamada de qualquer lugar. Melhor degradar do que devolver nada.
    expect(expandirRoteiro([], 0).some((p) => p.alvo.tipo === 'participante')).toBe(true)
    expect(expandirRoteiro([], -3).some((p) => p.alvo.tipo === 'participante')).toBe(true)
  })
})

describe('indiceDoPasso', () => {
  it('acha o passo pela chave', () => {
    const roteiro = expandirRoteiro([], 2)
    expect(indiceDoPasso(roteiro, roteiro[2].chave)).toBe(2)
  })

  it('chave desconhecida volta para o comeco', () => {
    // Uma retomada com marcador de um roteiro antigo — porque uma pergunta
    // foi removida — nao pode travar a conversa.
    expect(indiceDoPasso(expandirRoteiro([], 1), 'passo_que_nao_existe_mais')).toBe(0)
  })
})
