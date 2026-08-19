import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormularioInscricao } from './formulario-inscricao'

vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: (_a: unknown, i: unknown) => [i, vi.fn(), false] }
})

describe('FormularioInscricao', () => {
  it('comeca com uma vaga e um bloco de participante', () => {
    render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    expect(screen.getByRole('heading', { name: /participante 1/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /participante 2/i }),
    ).not.toBeInTheDocument()
  })

  it('cria um bloco por vaga ao aumentar o numero', async () => {
    // Isto e o que substitui os quatro ramos copiados do Typebot: um laco
    // sobre `vagas`, nao quatro copias do mesmo formulario.
    render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    await userEvent.selectOptions(screen.getByLabelText(/vagas/i), '3')
    expect(screen.getByRole('heading', { name: /participante 3/i })).toBeInTheDocument()
  })

  it('marca o primeiro bloco como titular', async () => {
    render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    await userEvent.selectOptions(screen.getByLabelText(/vagas/i), '2')
    expect(
      screen.getByRole('heading', { name: /participante 1.*titular/i }),
    ).toBeInTheDocument()
  })

  it('nomeia os campos de forma indexada, para a acao remontar a lista', () => {
    const { container } = render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    expect(container.querySelector('input[name="participantes[0].nome"]')).toBeTruthy()
    expect(container.querySelector('input[name="participantes[0].email"]')).toBeTruthy()
  })

  it('leva o slug do evento junto', () => {
    const { container } = render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    expect(container.querySelector('input[name="evento_slug"]')).toHaveValue(
      'engrenagem-2026',
    )
  })
})
