import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Revisao } from './revisao'
import { expandirRoteiro } from '@/lib/roteiro'
import { voltarPara } from './acoes'
import type { Pergunta } from '@/lib/supabase/tipos'

vi.mock('./acoes', () => ({
  voltarPara: vi.fn().mockResolvedValue({ ok: true }),
  concluir: vi.fn().mockResolvedValue({ ok: true }),
  responder: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const cargo: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual sua função?', tipo: 'selecao_unica', escopo: 'participante',
  obrigatoria: true, ordem: 1,
  opcoes: [{ chave: 'faz_tudo', rotulo: 'Faço tudo' }], ajuda: null, ativa: true,
}

const passos = expandirRoteiro([cargo], 2)

const estado = {
  passos,
  indice: passos.length - 1,
  respostas: { 'p1.cargo': 'faz_tudo', 'p2.nome': 'Leonardo Guerrieri' },
  nomeTitular: 'Janaína',
  vagas: 2,
  concluida: false,
}

describe('Revisao', () => {
  it('agrupa o resumo por pessoa', () => {
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getByText(/pessoa 1/i)).toBeInTheDocument()
    expect(screen.getByText(/pessoa 2/i)).toBeInTheDocument()
  })

  it('mostra o que foi respondido', () => {
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getByText('Leonardo Guerrieri')).toBeInTheDocument()
  })

  it('traduz a chave da opcao para o texto que a pessoa escolheu', () => {
    // Mostrar "faz_tudo" na revisao seria incompreensivel.
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getByText('Faço tudo')).toBeInTheDocument()
  })

  it('avisa o que ficou em branco, sem esconder', () => {
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getAllByText(/em branco/i).length).toBeGreaterThan(0)
  })

  it('cada item tem um botao de corrigir', async () => {
    render(<Revisao token="t" estado={estado} />)
    const botoes = screen.getAllByRole('button', { name: /corrigir/i })
    await userEvent.click(botoes[0])
    expect(voltarPara).toHaveBeenCalledWith('t', expect.any(String))
  })

  it('tem o botao de concluir', () => {
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument()
  })
})
