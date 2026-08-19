import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListaPerguntas } from './lista-perguntas'
import type { Pergunta } from '@/lib/supabase/tipos'

function pergunta(p: Partial<Pergunta>): Pergunta {
  return {
    id: 'q1', evento_id: 'e1', chave: 'faturamento', rotulo: 'Faturamento',
    texto_chat: 'Quanto fatura?', tipo: 'numero', escopo: 'inscricao',
    obrigatoria: false, ordem: 1, opcoes: null, ajuda: null, ativa: true, ...p,
  }
}

describe('ListaPerguntas', () => {
  it('mostra rotulo, chave, tipo e escopo', () => {
    render(<ListaPerguntas eventoSlug="eng-2026" perguntas={[pergunta({})]} />)
    expect(screen.getByText('Faturamento')).toBeInTheDocument()
    expect(screen.getByText('faturamento')).toBeInTheDocument()
    expect(screen.getByText(/uma vez por inscrição/i)).toBeInTheDocument()
  })

  it('diz que a pergunta de participante se repete', () => {
    render(
      <ListaPerguntas eventoSlug="eng-2026" perguntas={[pergunta({ escopo: 'participante' })]} />,
    )
    expect(screen.getByText(/uma vez por pessoa/i)).toBeInTheDocument()
  })

  it('a primeira nao tem botao de subir', () => {
    render(
      <ListaPerguntas
        eventoSlug="eng-2026"
        perguntas={[pergunta({ id: 'a' }), pergunta({ id: 'b', ordem: 2 })]}
      />,
    )
    expect(screen.getAllByRole('button', { name: /subir/i })).toHaveLength(1)
  })

  it('a ultima nao tem botao de descer', () => {
    render(
      <ListaPerguntas
        eventoSlug="eng-2026"
        perguntas={[pergunta({ id: 'a' }), pergunta({ id: 'b', ordem: 2 })]}
      />,
    )
    expect(screen.getAllByRole('button', { name: /descer/i })).toHaveLength(1)
  })

  it('mostra a pergunta desativada com aviso, sem esconde-la', () => {
    // Desativar preserva as respostas ja dadas. Sumir com a linha faria
    // parecer que a pergunta foi apagada.
    render(<ListaPerguntas eventoSlug="eng-2026" perguntas={[pergunta({ ativa: false })]} />)
    expect(screen.getByText(/fora do roteiro/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reativar/i })).toBeInTheDocument()
  })

  it('avisa quando o roteiro esta vazio', () => {
    render(<ListaPerguntas eventoSlug="eng-2026" perguntas={[]} />)
    expect(screen.getByText(/nenhuma pergunta/i)).toBeInTheDocument()
  })
})
