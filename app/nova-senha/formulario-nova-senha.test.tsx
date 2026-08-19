import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { FormularioNovaSenha } from './formulario-nova-senha'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/lib/supabase/recuperacao', () => ({
  criarClienteRecuperacaoBrowser: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      updateUser: vi.fn(),
    },
  }),
}))

describe('FormularioNovaSenha', () => {
  it('pede a nova senha duas vezes', () => {
    render(<FormularioNovaSenha />)
    expect(screen.getByLabelText(/^nova senha/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/repita/i)).toBeInTheDocument()
  })

  it('os dois campos sao do tipo senha', () => {
    render(<FormularioNovaSenha />)
    expect(screen.getByLabelText(/^nova senha/i)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/repita/i)).toHaveAttribute('type', 'password')
  })

  it('marca os campos como senha nova, para o gerenciador sugerir uma', () => {
    render(<FormularioNovaSenha />)
    expect(screen.getByLabelText(/^nova senha/i)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })

  it('so libera o botao depois de validar o link', () => {
    // Enquanto o token do fragmento nao foi processado, trocar a senha
    // falharia com "usuario nao autenticado".
    render(<FormularioNovaSenha />)
    expect(screen.getByRole('button', { name: /trocar senha/i })).toBeDisabled()
  })
})

describe('FormularioNovaSenha e o cliente supabase', () => {
  it('cria o cliente uma vez so, na montagem', () => {
    // Dois clientes na mesma aba disputam a mesma chave de armazenamento;
    // o proprio Supabase avisa que o comportamento fica indefinido.
    //
    // A forma correta e passar a funcao para o useState SEM chamar — ele a
    // executa uma unica vez, na montagem. Qualquer chamada direta no corpo
    // do componente ou dentro de um handler cria uma instancia nova.
    const fonte = readFileSync(resolve(__dirname, './formulario-nova-senha.tsx'), 'utf-8')

    expect(fonte).toMatch(/useState\(criarClienteRecuperacaoBrowser\)/)
    expect(fonte.match(/criarClienteRecuperacaoBrowser\(\)/g) ?? []).toHaveLength(0)
  })
})
