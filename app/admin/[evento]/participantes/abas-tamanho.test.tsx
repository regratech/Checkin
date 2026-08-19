import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AbasTamanho } from './abas-tamanho'

const contagens = { todos: 187, '1': 64, '2': 48, '3': 51, '4+': 24 }
const padrao = { eventoSlug: 'eng-2026', contagens, statusAtual: 'todos' as const, busca: '' }

describe('AbasTamanho', () => {
  it('mostra as cinco visoes', () => {
    render(<AbasTamanho {...padrao} atual="todos" />)
    for (const rotulo of [/geral/i, /1 pessoa/i, /2 pessoas/i, /3 pessoas/i, /4\+/]) {
      expect(screen.getByRole('link', { name: rotulo })).toBeInTheDocument()
    }
  })

  it('mostra a contagem de cada visao', () => {
    render(<AbasTamanho {...padrao} atual="todos" />)
    expect(screen.getByRole('link', { name: /2 pessoas/i })).toHaveTextContent('48')
  })

  it('cada aba e um link com o grupo na URL, nao um botao', () => {
    // Estado na URL: a visao fica compartilhavel por link, sobrevive ao
    // recarregar e o botao voltar funciona.
    render(<AbasTamanho {...padrao} atual="todos" />)
    expect(screen.getByRole('link', { name: /3 pessoas/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?grupo=3',
    )
  })

  it('a visao geral nao carrega parametro sobrando', () => {
    render(<AbasTamanho {...padrao} atual="2" />)
    expect(screen.getByRole('link', { name: /geral/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes',
    )
  })

  it('preserva status e busca ao trocar de aba', () => {
    // Trocar de aba nao pode limpar o que a pessoa ja filtrou.
    render(<AbasTamanho {...padrao} atual="todos" statusAtual="pendente" busca="guerry" />)
    expect(screen.getByRole('link', { name: /2 pessoas/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?grupo=2&status=pendente&busca=guerry',
    )
  })

  it('marca a aba atual para leitor de tela', () => {
    render(<AbasTamanho {...padrao} atual="2" />)
    expect(screen.getByRole('link', { name: /2 pessoas/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
