import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Grupos } from './grupos'
import type { GrupoInscricao } from '@/lib/participantes'

const base = {
  id: 'x', inscricao_id: 'i1', pessoa_id: 'p1', ordem: 1, titular: true,
  nome: 'Janaína', email: null, telefone: null, data_nascimento: null,
  nome_cracha: null, cargo: 'Sócia', evento_id: 'e1', codigo: 'ENG26-0001',
  codigo_participante: 'ENG26-0001-1', vagas: 3, pessoas_preenchidas: 2,
  empresa_nome: 'La Guerry', empresa_cidade: 'Porto Alegre',
  empresa_instagram: null, status_checkin: 'em_andamento' as const,
}

const grupo: GrupoInscricao = {
  codigo: 'ENG26-0001',
  empresa_nome: 'La Guerry',
  empresa_cidade: 'Porto Alegre',
  vagas: 3,
  preenchidos: 2,
  completo: false,
  participantes: [
    base,
    { ...base, id: 'y', ordem: 2, nome: 'Leonardo', titular: false, codigo_participante: 'ENG26-0001-2' },
  ],
}

describe('Grupos', () => {
  it('um cabecalho por inscricao, com codigo e buffet', () => {
    render(<Grupos grupos={[grupo]} />)
    expect(screen.getByText(/ENG26-0001$/)).toBeInTheDocument()
    expect(screen.getByText(/La Guerry/)).toBeInTheDocument()
  })

  it('mostra quantos de quantos foram preenchidos', () => {
    render(<Grupos grupos={[grupo]} />)
    expect(screen.getByText(/2\/3 preenchidos/)).toBeInTheDocument()
  })

  it('sinaliza o grupo incompleto', () => {
    // E assim que se enxerga quem comprou 3 vagas e cadastrou 2.
    render(<Grupos grupos={[grupo]} />)
    expect(screen.getByRole('status')).toHaveAccessibleName(/incompleto/i)
  })

  it('nao sinaliza quando esta completo', () => {
    render(<Grupos grupos={[{ ...grupo, preenchidos: 3, completo: true }]} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('lista os participantes do grupo, na ordem', () => {
    render(<Grupos grupos={[grupo]} />)
    const linhas = screen.getAllByRole('row').map((l) => l.textContent)
    expect(linhas[0]).toContain('Janaína')
    expect(linhas[1]).toContain('Leonardo')
  })

  it('avisa quando nao ha inscricao desse tamanho', () => {
    render(<Grupos grupos={[]} />)
    expect(screen.getByText(/nenhuma inscrição/i)).toBeInTheDocument()
  })
})
