import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabelaPlana } from './tabela-plana'
import type { LinhaParticipante } from '@/lib/participantes'

function linha(p: Partial<LinhaParticipante>): LinhaParticipante {
  return {
    id: 'x', inscricao_id: 'i1', pessoa_id: 'p1', ordem: 1, titular: true,
    nome: 'Janaína Guerrieri', email: 'l@g.com', telefone: '51998128616',
    data_nascimento: null, nome_cracha: 'Janaina', cargo: 'Sócia',
    evento_id: 'e1', codigo: 'ENG26-0001', codigo_participante: 'ENG26-0001-1',
    vagas: 2, pessoas_preenchidas: 2, empresa_nome: 'La Guerry',
    empresa_cidade: 'Porto Alegre', empresa_instagram: null,
    status_checkin: 'concluido', ...p,
  }
}

describe('TabelaPlana', () => {
  it('uma linha por pessoa', () => {
    render(<TabelaPlana linhas={[linha({ id: 'a' }), linha({ id: 'b', nome: 'Leonardo' })]} />)
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('mostra o codigo do participante', () => {
    render(<TabelaPlana linhas={[linha({})]} />)
    expect(screen.getByText('ENG26-0001-1')).toBeInTheDocument()
  })

  it('diz quantas pessoas ha na compra', () => {
    render(<TabelaPlana linhas={[linha({ vagas: 3, pessoas_preenchidas: 2 })]} />)
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('avisa quando ninguem foi encontrado', () => {
    render(<TabelaPlana linhas={[]} />)
    expect(screen.getByText(/nenhum participante/i)).toBeInTheDocument()
  })
})
