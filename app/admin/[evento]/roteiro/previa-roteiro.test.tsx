import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreviaRoteiro } from './previa-roteiro'
import { expandirRoteiro } from '@/lib/roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

const cargo: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual é a sua função no buffet?', tipo: 'selecao_unica',
  escopo: 'participante', obrigatoria: true, ordem: 1, opcoes: null,
  ajuda: null, ativa: true,
}

describe('PreviaRoteiro', () => {
  it('numera os passos', () => {
    render(<PreviaRoteiro passos={expandirRoteiro([], 1)} vagas={1} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('mostra o texto que a Lara vai falar', () => {
    render(<PreviaRoteiro passos={expandirRoteiro([cargo], 1)} vagas={1} />)
    expect(screen.getByText(/Qual é a sua função no buffet\?/)).toBeInTheDocument()
  })

  it('separa os blocos por pessoa', () => {
    render(<PreviaRoteiro passos={expandirRoteiro([cargo], 3)} vagas={3} />)
    expect(screen.getByText(/pessoa 1/i)).toBeInTheDocument()
    expect(screen.getByText(/pessoa 3/i)).toBeInTheDocument()
  })

  it('a mesma pergunta aparece uma vez por pessoa', () => {
    render(<PreviaRoteiro passos={expandirRoteiro([cargo], 3)} vagas={3} />)
    expect(screen.getAllByText(/Qual é a sua função no buffet\?/)).toHaveLength(3)
  })

  it('diz quantos passos a conversa tem', () => {
    const passos = expandirRoteiro([cargo], 2)
    render(<PreviaRoteiro passos={passos} vagas={2} />)
    expect(screen.getByText(new RegExp(`${passos.length} passos`))).toBeInTheDocument()
  })
})
