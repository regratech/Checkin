import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoResposta } from './campo-resposta'
import { expandirRoteiro } from '@/lib/roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

function passoDe(pergunta: Pergunta, vagas = 1) {
  return expandirRoteiro([pergunta], vagas).find((p) => p.pergunta?.id === pergunta.id)!
}

const base: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual sua função?', tipo: 'selecao_unica', escopo: 'participante',
  obrigatoria: true, ordem: 1,
  opcoes: [
    { chave: 'faz_tudo', rotulo: 'Faço tudo', rotulo_acompanhante: 'Faz tudo' },
    { chave: 'administra', rotulo: 'Só administro', rotulo_acompanhante: 'Só administra' },
  ],
  ajuda: null, ativa: true,
}

describe('CampoResposta', () => {
  it('selecao unica vira botoes, um por opcao', () => {
    render(<CampoResposta passo={passoDe(base)} onResponder={vi.fn()} enviando={false} />)
    expect(screen.getByRole('button', { name: 'Faço tudo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Só administro' })).toBeInTheDocument()
  })

  it('o acompanhante ve a terceira pessoa', () => {
    // O mesmo papel, dito na voz certa. E o que impede quatro funcoes
    // virarem oito valores distintos, como aconteceu na planilha.
    const passoDoSegundo = expandirRoteiro([base], 2).find((p) => p.chave === 'p2.cargo')!
    render(<CampoResposta passo={passoDoSegundo} onResponder={vi.fn()} enviando={false} />)
    expect(screen.getByRole('button', { name: 'Faz tudo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Faço tudo' })).not.toBeInTheDocument()
  })

  it('clicar numa opcao responde com a chave, nao com o texto', async () => {
    const responder = vi.fn()
    render(<CampoResposta passo={passoDe(base)} onResponder={responder} enviando={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Faço tudo' }))
    expect(responder).toHaveBeenCalledWith('faz_tudo')
  })

  it('nota vira seis botoes, de zero a cinco', () => {
    const nota = { ...base, id: 'q2', tipo: 'nota_estrela' as const, opcoes: null }
    render(<CampoResposta passo={passoDe(nota)} onResponder={vi.fn()} enviando={false} />)
    for (const n of ['0', '1', '2', '3', '4', '5']) {
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
    }
  })

  it('data usa o seletor nativo', () => {
    const data = { ...base, id: 'q3', tipo: 'data' as const, opcoes: null }
    const { container } = render(
      <CampoResposta passo={passoDe(data)} onResponder={vi.fn()} enviando={false} />,
    )
    expect(container.querySelector('input[type="date"]')).toBeTruthy()
  })

  it('telefone usa teclado numerico no celular', () => {
    const tel = { ...base, id: 'q4', tipo: 'telefone' as const, opcoes: null }
    const { container } = render(
      <CampoResposta passo={passoDe(tel)} onResponder={vi.fn()} enviando={false} />,
    )
    expect(container.querySelector('input[type="tel"]')).toBeTruthy()
  })

  it('texto longo usa area de texto', () => {
    const longo = { ...base, id: 'q5', tipo: 'texto_longo' as const, opcoes: null }
    const { container } = render(
      <CampoResposta passo={passoDe(longo)} onResponder={vi.fn()} enviando={false} />,
    )
    expect(container.querySelector('textarea')).toBeTruthy()
  })

  it('tudo fica desabilitado enquanto grava', () => {
    render(<CampoResposta passo={passoDe(base)} onResponder={vi.fn()} enviando />)
    expect(screen.getByRole('button', { name: 'Faço tudo' })).toBeDisabled()
  })

  it('campo opcional oferece pular', () => {
    const opcional = {
      ...base, id: 'q6', tipo: 'texto_curto' as const, obrigatoria: false, opcoes: null,
    }
    render(<CampoResposta passo={passoDe(opcional)} onResponder={vi.fn()} enviando={false} />)
    expect(screen.getByRole('button', { name: /pular/i })).toBeInTheDocument()
  })

  it('campo obrigatorio nao oferece pular', () => {
    render(<CampoResposta passo={passoDe(base)} onResponder={vi.fn()} enviando={false} />)
    expect(screen.queryByRole('button', { name: /pular/i })).not.toBeInTheDocument()
  })
})
