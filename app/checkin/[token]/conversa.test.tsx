import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Conversa } from './conversa'
import { expandirRoteiro } from '@/lib/roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

vi.mock('./acoes', () => ({
  responder: vi.fn().mockResolvedValue({ ok: true }),
  voltarPara: vi.fn().mockResolvedValue({ ok: true }),
  concluir: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const cargo: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual sua função no buffet?', tipo: 'selecao_unica',
  escopo: 'participante', obrigatoria: true, ordem: 1,
  opcoes: [{ chave: 'faz_tudo', rotulo: 'Faço tudo' }], ajuda: null, ativa: true,
}

function estado(indice: number, vagas = 2) {
  return {
    passos: expandirRoteiro([cargo], vagas),
    indice,
    respostas: {},
    nomeTitular: 'Marina',
    vagas,
    concluida: false,
    valoresCompostos: {},
  }
}

describe('Conversa', () => {
  it('cumprimenta pelo nome e diz quantas vagas', () => {
    render(<Conversa token="t" estado={estado(0)} />)
    expect(screen.getByText(/Marina/)).toBeInTheDocument()
    expect(screen.getByText(/2 vagas/)).toBeInTheDocument()
  })

  it('mostra o contador de pessoa quando o passo e de participante', () => {
    // "pessoa 2 de 2" e o que impede a sensacao de conversa infinita.
    const e = estado(0)
    const indice = e.passos.findIndex((p) => p.chave === 'p2.dados_participante')
    render(<Conversa token="t" estado={{ ...e, indice }} />)
    expect(screen.getByText(/pessoa 2 de 2/i)).toBeInTheDocument()
  })

  it('nao mostra contador nos passos do buffet', () => {
    const e = estado(0)
    const indice = e.passos.findIndex((p) => p.fixo === 'buffet')
    render(<Conversa token="t" estado={{ ...e, indice }} />)
    expect(screen.queryByText(/pessoa \d+ de/i)).not.toBeInTheDocument()
  })

  it('mostra a pergunta do passo atual', () => {
    const e = estado(0)
    const indice = e.passos.findIndex((p) => p.chave === 'p1.cargo')
    render(<Conversa token="t" estado={{ ...e, indice }} />)
    expect(screen.getByText(/Qual sua função no buffet\?/)).toBeInTheDocument()
  })

  it('mostra a barra de progresso', () => {
    render(<Conversa token="t" estado={estado(3)} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  })

  it('no fim, mostra a revisao em vez de um campo', () => {
    const e = estado(0)
    const indice = e.passos.findIndex((p) => p.fixo === 'revisao')
    render(<Conversa token="t" estado={{ ...e, indice }} />)
    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument()
  })

  it('check-in ja concluido nao mostra campo nenhum', () => {
    render(<Conversa token="t" estado={{ ...estado(0), concluida: true }} />)
    expect(screen.getByText(/tudo certo/i)).toBeInTheDocument()
  })
})
