import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormularioEvento } from './formulario-evento'

vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: (_a: unknown, i: unknown) => [i, vi.fn(), false] }
})

describe('FormularioEvento', () => {
  it('tem os campos de nome, data, local e prefixo', () => {
    render(<FormularioEvento />)
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/data/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/local/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/prefixo/i)).toBeInTheDocument()
  })

  it('sugere o prefixo enquanto a pessoa digita o nome', async () => {
    // Digitar ENG26 a mao e trabalho que o sistema sabe fazer.
    render(<FormularioEvento />)
    await userEvent.type(screen.getByLabelText(/nome/i), 'Engrenagem')
    await userEvent.type(screen.getByLabelText(/data/i), '2026-09-10')
    expect(screen.getByLabelText(/prefixo/i)).toHaveValue('ENG26')
  })

  it('deixa o prefixo ser sobrescrito a mao', async () => {
    render(<FormularioEvento />)
    await userEvent.type(screen.getByLabelText(/nome/i), 'Engrenagem')
    await userEvent.clear(screen.getByLabelText(/prefixo/i))
    await userEvent.type(screen.getByLabelText(/prefixo/i), 'XYZ99')
    expect(screen.getByLabelText(/prefixo/i)).toHaveValue('XYZ99')
  })
})
