import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormularioPergunta } from './formulario-pergunta'
import type { Pergunta } from '@/lib/supabase/tipos'

vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: (_a: unknown, i: unknown) => [i, vi.fn(), false] }
})

const existente: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'faturamento', rotulo: 'Faturamento',
  texto_chat: 'Quanto?', tipo: 'numero', escopo: 'inscricao',
  obrigatoria: false, ordem: 1, opcoes: null, ajuda: null, ativa: true,
}

describe('FormularioPergunta', () => {
  it('tem rotulo, texto de chat, tipo e escopo', () => {
    render(<FormularioPergunta eventoSlug="eng-2026" />)
    expect(screen.getByLabelText(/nome da coluna/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/como a lara pergunta/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/quem responde/i)).toBeInTheDocument()
  })

  it('esconde o campo de opcoes para tipo que nao usa', () => {
    render(<FormularioPergunta eventoSlug="eng-2026" />)
    expect(screen.queryByLabelText(/opções/i)).not.toBeInTheDocument()
  })

  it('mostra o campo de opcoes ao escolher uma selecao', async () => {
    render(<FormularioPergunta eventoSlug="eng-2026" />)
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), 'selecao_unica')
    expect(screen.getByLabelText(/opções/i)).toBeInTheDocument()
  })

  it('explica a barra vertical das duas vozes', async () => {
    render(<FormularioPergunta eventoSlug="eng-2026" />)
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), 'selecao_unica')
    expect(screen.getByText(/Faço a comida \| Faz a comida/)).toBeInTheDocument()
  })

  it('ao editar, o escopo fica travado e explicado', () => {
    // Trocar o escopo invalidaria as respostas ja gravadas, que o banco
    // amarra por FK composta (pergunta_id, escopo).
    render(<FormularioPergunta eventoSlug="eng-2026" pergunta={existente} />)
    expect(screen.getByLabelText(/quem responde/i)).toBeDisabled()
    expect(screen.getByText(/não pode mudar/i)).toBeInTheDocument()
  })

  it('ao editar, a chave aparece mas nao e editavel', () => {
    render(<FormularioPergunta eventoSlug="eng-2026" pergunta={existente} />)
    expect(screen.getByText('faturamento')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^chave$/i)).not.toBeInTheDocument()
  })
})
