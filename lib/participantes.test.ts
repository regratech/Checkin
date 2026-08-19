import { describe, it, expect, vi } from 'vitest'
import {
  lerFiltros,
  aplicarFiltroDeGrupo,
  agruparPorInscricao,
  type LinhaParticipante,
} from './participantes'

describe('lerFiltros', () => {
  it('sem nada na URL, mostra tudo', () => {
    expect(lerFiltros({})).toEqual({ grupo: 'todos', status: 'todos', busca: '' })
  })

  it('le grupo, status e busca', () => {
    expect(lerFiltros({ grupo: '2', status: 'pendente', busca: ' guerry ' })).toEqual({
      grupo: '2',
      status: 'pendente',
      busca: 'guerry',
    })
  })

  it('ignora valor de grupo que nao existe, em vez de quebrar', () => {
    // A URL e digitavel: ?grupo=99 nao pode derrubar a pagina.
    expect(lerFiltros({ grupo: '99' }).grupo).toBe('todos')
    expect(lerFiltros({ grupo: 'DROP TABLE' }).grupo).toBe('todos')
  })

  it('ignora status que nao existe', () => {
    expect(lerFiltros({ status: 'inventado' }).status).toBe('todos')
  })

  it('aceita 4+ como grupo', () => {
    expect(lerFiltros({ grupo: '4+' }).grupo).toBe('4+')
  })

  it('usa o primeiro valor quando o parametro vem repetido', () => {
    expect(lerFiltros({ grupo: ['2', '3'] }).grupo).toBe('2')
  })
})

describe('aplicarFiltroDeGrupo', () => {
  function consultaFalsa() {
    const eq = vi.fn()
    const gte = vi.fn()
    const alvo = { eq, gte }
    eq.mockReturnValue(alvo)
    gte.mockReturnValue(alvo)
    return alvo
  }

  it('filtra por igualdade exata de 1 a 3', () => {
    const c = consultaFalsa()
    aplicarFiltroDeGrupo(c, '2')
    expect(c.eq).toHaveBeenCalledWith('vagas', 2)
  })

  it('4+ e maior ou igual a 4, para nenhum lote grande sumir', () => {
    // Se o Guru passar a vender 6 vagas, essas inscricoes precisam aparecer
    // em algum lugar. Sem o >=, ficariam invisiveis.
    const c = consultaFalsa()
    aplicarFiltroDeGrupo(c, '4+')
    expect(c.gte).toHaveBeenCalledWith('vagas', 4)
  })

  it('todos nao filtra nada', () => {
    const c = consultaFalsa()
    aplicarFiltroDeGrupo(c, 'todos')
    expect(c.eq).not.toHaveBeenCalled()
    expect(c.gte).not.toHaveBeenCalled()
  })

  it('filtra por vagas, nunca por pessoas_preenchidas', () => {
    // pessoas_preenchidas muda durante o check-in e faria a linha pular de
    // aba enquanto o titular digita. Ver spec 6.1.
    const c = consultaFalsa()
    aplicarFiltroDeGrupo(c, '3')
    expect(c.eq).not.toHaveBeenCalledWith('pessoas_preenchidas', expect.anything())
  })
})

function linha(p: Partial<LinhaParticipante>): LinhaParticipante {
  return {
    id: 'x',
    inscricao_id: 'i1',
    pessoa_id: 'p1',
    ordem: 1,
    titular: false,
    nome: 'Alguem',
    email: null,
    telefone: null,
    data_nascimento: null,
    nome_cracha: null,
    cargo: null,
    evento_id: 'e1',
    codigo: 'ENG26-0001',
    codigo_participante: 'ENG26-0001-1',
    vagas: 2,
    pessoas_preenchidas: 2,
    empresa_nome: 'Buffet X',
    empresa_cidade: 'São Paulo',
    empresa_instagram: null,
    status_checkin: 'concluido',
    ...p,
  }
}

describe('agruparPorInscricao', () => {
  it('junta as linhas da mesma inscricao, na ordem dos participantes', () => {
    const grupos = agruparPorInscricao([
      linha({ inscricao_id: 'i1', ordem: 2, nome: 'Leonardo' }),
      linha({ inscricao_id: 'i1', ordem: 1, nome: 'Janaína', titular: true }),
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].participantes.map((p) => p.nome)).toEqual(['Janaína', 'Leonardo'])
  })

  it('mantem os grupos na ordem do codigo', () => {
    const grupos = agruparPorInscricao([
      linha({ inscricao_id: 'i2', codigo: 'ENG26-0002' }),
      linha({ inscricao_id: 'i1', codigo: 'ENG26-0001' }),
    ])
    expect(grupos.map((g) => g.codigo)).toEqual(['ENG26-0001', 'ENG26-0002'])
  })

  it('marca como incompleto quem comprou mais vagas do que preencheu', () => {
    // E assim que se enxerga quem comprou 3 e cadastrou 2 — hoje invisivel.
    const grupos = agruparPorInscricao([
      linha({ inscricao_id: 'i1', vagas: 3, pessoas_preenchidas: 2, ordem: 1 }),
      linha({ inscricao_id: 'i1', vagas: 3, pessoas_preenchidas: 2, ordem: 2 }),
    ])
    expect(grupos[0]).toMatchObject({ vagas: 3, preenchidos: 2, completo: false })
  })

  it('marca como completo quando bate', () => {
    const grupos = agruparPorInscricao([
      linha({ inscricao_id: 'i1', vagas: 1, pessoas_preenchidas: 1 }),
    ])
    expect(grupos[0].completo).toBe(true)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(agruparPorInscricao([])).toEqual([])
  })
})
