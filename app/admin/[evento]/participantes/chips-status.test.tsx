import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChipsStatus } from './chips-status'
import type { Filtros } from '@/lib/participantes'

const filtros: Filtros = { grupo: 'todos', status: 'todos', busca: '' }

describe('ChipsStatus', () => {
  it('mostra os quatro estados', () => {
    render(<ChipsStatus eventoSlug="eng-2026" filtros={filtros} />)
    for (const r of [/todos/i, /pendente/i, /em andamento/i, /concluído/i]) {
      expect(screen.getByRole('link', { name: r })).toBeInTheDocument()
    }
  })

  it('preserva o grupo escolhido ao trocar o status', () => {
    // Trocar o status dentro da aba "2 pessoas" nao pode jogar a pessoa de
    // volta para a visao geral.
    render(<ChipsStatus eventoSlug="eng-2026" filtros={{ ...filtros, grupo: '2' }} />)
    expect(screen.getByRole('link', { name: /pendente/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?grupo=2&status=pendente',
    )
  })

  it('preserva a busca ao trocar o status', () => {
    render(<ChipsStatus eventoSlug="eng-2026" filtros={{ ...filtros, busca: 'guerry' }} />)
    expect(screen.getByRole('link', { name: /concluído/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?status=concluido&busca=guerry',
    )
  })

  it('o chip "todos" limpa so o status', () => {
    render(
      <ChipsStatus eventoSlug="eng-2026" filtros={{ grupo: '3', status: 'pendente', busca: 'x' }} />,
    )
    expect(screen.getByRole('link', { name: /todos/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?grupo=3&busca=x',
    )
  })

  it('marca o status atual para leitor de tela', () => {
    render(<ChipsStatus eventoSlug="eng-2026" filtros={{ ...filtros, status: 'pendente' }} />)
    expect(screen.getByRole('link', { name: /pendente/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
