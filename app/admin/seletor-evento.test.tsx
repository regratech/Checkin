import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SeletorEvento } from './seletor-evento'
import type { Evento } from '@/lib/supabase/tipos'

const empurrar = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: empurrar }) }))

const eventos: Evento[] = [
  {
    id: 'e1',
    nome: 'Engrenagem 2026',
    slug: 'engrenagem-2026',
    prefixo_codigo: 'ENG26',
    data: '2026-09-10',
    local: 'São Paulo',
    ativo: true,
  },
  {
    id: 'e2',
    nome: 'Engrenagem 2027',
    slug: 'engrenagem-2027',
    prefixo_codigo: 'ENG27',
    data: '2027-03-05',
    local: 'Rio',
    ativo: true,
  },
]

describe('SeletorEvento', () => {
  it('lista todos os eventos', () => {
    render(<SeletorEvento eventos={eventos} atual="engrenagem-2026" />)
    expect(screen.getByRole('option', { name: /Engrenagem 2026/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Engrenagem 2027/ })).toBeInTheDocument()
  })

  it('deixa o evento atual selecionado', () => {
    render(<SeletorEvento eventos={eventos} atual="engrenagem-2027" />)
    expect(screen.getByRole('combobox')).toHaveValue('engrenagem-2027')
  })

  it('avisa quando ainda nao existe evento nenhum', () => {
    render(<SeletorEvento eventos={[]} />)
    expect(screen.getByText(/nenhum evento/i)).toBeInTheDocument()
  })
})
