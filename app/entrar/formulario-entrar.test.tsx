import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormularioEntrar } from './formulario-entrar'

vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return {
    ...real,
    useActionState: (_acao: unknown, inicial: unknown) => [inicial, vi.fn(), false],
  }
})

describe('FormularioEntrar', () => {
  it('mostra os campos de email e senha', () => {
    render(<FormularioEntrar proximo="/admin" />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
  })

  it('leva o destino pretendido junto, em campo oculto', () => {
    const { container } = render(<FormularioEntrar proximo="/admin/eventos" />)
    const oculto = container.querySelector('input[name="proximo"]')
    expect(oculto).toHaveValue('/admin/eventos')
  })

  it('marca o campo de senha como senha, para o gerenciador reconhecer', () => {
    render(<FormularioEntrar proximo="/admin" />)
    expect(screen.getByLabelText(/senha/i)).toHaveAttribute('type', 'password')
  })
})
