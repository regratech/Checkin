import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampoBusca } from './campo-busca'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/eng-2026/participantes',
  useSearchParams: () => new URLSearchParams('grupo=2'),
}))

describe('CampoBusca', () => {
  it('comeca com o valor que veio da URL', () => {
    render(<CampoBusca valorInicial="guerry" />)
    expect(screen.getByRole('searchbox')).toHaveValue('guerry')
  })

  it('e um formulario GET, para funcionar sem javascript', () => {
    const { container } = render(<CampoBusca valorInicial="" />)
    expect(container.querySelector('form')).toHaveAttribute('method', 'get')
  })

  it('preserva o grupo escolhido ao buscar', () => {
    // Buscar dentro da aba "2 pessoas" nao pode jogar a pessoa de volta
    // para a visao geral.
    const { container } = render(<CampoBusca valorInicial="" />)
    expect(container.querySelector('input[name="grupo"]')).toHaveValue('2')
  })
})
