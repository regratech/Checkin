import { describe, it, expect } from 'vitest'
import { montarCsv, nomeArquivoCsv } from './csv'
import type { LinhaParticipante } from './participantes'

function linha(p: Partial<LinhaParticipante>): LinhaParticipante {
  return {
    id: 'x', inscricao_id: 'i1', pessoa_id: 'p1', ordem: 1, titular: true,
    nome: 'Janaína Garcia Guerrieri', email: 'laguerryeventos@gmail.com',
    telefone: '51998128616', data_nascimento: '1978-10-05',
    nome_cracha: 'Janaina Guerrieri', cargo: 'Sócia', evento_id: 'e1',
    codigo: 'ENG26-0001', codigo_participante: 'ENG26-0001-1', vagas: 2,
    pessoas_preenchidas: 2, empresa_nome: 'La Guerry Gastronomia',
    empresa_cidade: 'Porto Alegre / RS', empresa_instagram: '@laguerrygastronomia',
    status_checkin: 'concluido', ...p,
  }
}

describe('montarCsv', () => {
  it('comeca com BOM, para o Excel brasileiro nao comer os acentos', () => {
    // Sem BOM, "Janaína" abre como "JanaÃ­na" no Excel em portugues.
    expect(montarCsv([linha({})]).startsWith('\uFEFF')).toBe(true)
  })

  it('separa por ponto e virgula, que e o padrao do Excel em portugues', () => {
    const csv = montarCsv([linha({})])
    const cabecalho = csv.replace('\uFEFF', '').split('\r\n')[0]
    expect(cabecalho.split(';').length).toBeGreaterThan(5)
    expect(cabecalho).toContain('Código')
  })

  it('traz o codigo do participante na primeira coluna', () => {
    const csv = montarCsv([linha({})])
    const primeiraLinha = csv.replace('\uFEFF', '').split('\r\n')[1]
    expect(primeiraLinha.startsWith('ENG26-0001-1;')).toBe(true)
  })

  it('protege o separador dentro do valor', () => {
    // "Porto Alegre / RS" e inofensivo, mas "Souza; Filho" quebraria a coluna.
    const csv = montarCsv([linha({ nome: 'Souza; Filho' })])
    expect(csv).toContain('"Souza; Filho"')
  })

  it('dobra a aspa dentro do valor', () => {
    const csv = montarCsv([linha({ empresa_nome: 'Buffet "O Sabor"' })])
    expect(csv).toContain('"Buffet ""O Sabor"""')
  })

  it('protege a quebra de linha dentro do valor', () => {
    const csv = montarCsv([linha({ cargo: 'Sócia\nFundadora' })])
    expect(csv).toContain('"Sócia\nFundadora"')
  })

  it('escreve campo nulo como vazio, nunca como a palavra null', () => {
    const csv = montarCsv([linha({ telefone: null, cargo: null })])
    expect(csv).not.toMatch(/null/)
  })

  it('traduz titular para Sim e Não', () => {
    expect(montarCsv([linha({ titular: true })])).toContain(';Sim;')
    expect(montarCsv([linha({ titular: false })])).toContain(';Não;')
  })

  it('usa CRLF entre as linhas', () => {
    const csv = montarCsv([linha({ ordem: 1 }), linha({ ordem: 2 })])
    expect(csv.replace('\uFEFF', '').split('\r\n')).toHaveLength(3)
  })

  it('lista vazia devolve so o cabecalho', () => {
    const csv = montarCsv([]).replace('\uFEFF', '')
    expect(csv.split('\r\n')).toHaveLength(1)
  })
})

describe('nomeArquivoCsv', () => {
  it('junta evento e visao', () => {
    expect(nomeArquivoCsv('engrenagem-2026', '2')).toBe('engrenagem-2026-2-pessoas.csv')
  })

  it('a visao geral nao vira "todos-pessoas"', () => {
    expect(nomeArquivoCsv('engrenagem-2026', 'todos')).toBe('engrenagem-2026-geral.csv')
  })
})
