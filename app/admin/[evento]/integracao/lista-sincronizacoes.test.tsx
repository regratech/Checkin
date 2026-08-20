import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListaSincronizacoes } from './lista-sincronizacoes'

const base = {
  id: 's1',
  recebido_em: '2026-06-23T09:00:37Z',
  status: 'promovida',
  erro: null,
  chave: 'ABC123',
  resumo: 'Diogo Rodrigues De Souza · 2 vagas',
  inscricao_id: 'i1',
}

describe('ListaSincronizacoes', () => {
  it('mostra quem chegou e quantas vagas', () => {
    render(<ListaSincronizacoes eventoSlug="eng-2026" sincronizacoes={[base]} />)
    expect(screen.getByText(/Diogo Rodrigues De Souza · 2 vagas/)).toBeInTheDocument()
  })

  it('mostra o motivo do erro, sem esconder', () => {
    render(
      <ListaSincronizacoes
        eventoSlug="eng-2026"
        sincronizacoes={[
          { ...base, status: 'erro', erro: 'Compra sem email.', inscricao_id: null },
        ]}
      />,
    )
    expect(screen.getByText(/Compra sem email/)).toBeInTheDocument()
  })

  it('so oferece reprocessar no que falhou', () => {
    // Reprocessar o que deu certo geraria confusao sem ganho: a promocao
    // e idempotente, mas o botao sugeriria que algo esta pendente.
    render(
      <ListaSincronizacoes
        eventoSlug="eng-2026"
        sincronizacoes={[
          base,
          { ...base, id: 's2', status: 'erro', erro: 'x', inscricao_id: null },
        ]}
      />,
    )
    expect(screen.getAllByRole('button', { name: /reprocessar/i })).toHaveLength(1)
  })

  it('avisa quando nada chegou ainda', () => {
    render(<ListaSincronizacoes eventoSlug="eng-2026" sincronizacoes={[]} />)
    expect(screen.getByText(/nada chegou/i)).toBeInTheDocument()
  })

  it('separa quem esta aguardando aprovacao', () => {
    render(
      <ListaSincronizacoes
        eventoSlug="eng-2026"
        sincronizacoes={[{ ...base, status: 'recebida', inscricao_id: null }]}
      />,
    )
    expect(screen.getByText(/aguardando/i)).toBeInTheDocument()
  })
})
