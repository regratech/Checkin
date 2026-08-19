'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarClienteRecuperacaoBrowser } from '@/lib/supabase/recuperacao'

export function FormularioNovaSenha() {
  const router = useRouter()
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // O token vem no fragmento da URL (`#access_token=...`), que o navegador
  // não envia ao servidor. Só o cliente consegue lê-lo — por isso esta tela
  // é de cliente, e por isso o fluxo é `implicit`.
  useEffect(() => {
    const supabase = criarClienteRecuperacaoBrowser()
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_IN') setPronto(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function trocar(form: FormData) {
    const senha = String(form.get('senha') ?? '')
    const repeticao = String(form.get('repeticao') ?? '')

    if (senha.length < 8) return setErro('A senha precisa de pelo menos 8 caracteres')
    if (senha !== repeticao) return setErro('As duas senhas não são iguais')

    setErro('')
    setSalvando(true)

    const supabase = criarClienteRecuperacaoBrowser()
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)

    if (error) {
      console.error('[nova-senha] falha ao trocar', error.message)
      setErro('Não foi possível trocar a senha. Peça um link novo.')
      return
    }

    router.push('/entrar')
  }

  return (
    <form action={trocar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nova senha</span>
        <input
          name="senha"
          type="password"
          autoComplete="new-password"
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Repita a nova senha</span>
        <input
          name="repeticao"
          type="password"
          autoComplete="new-password"
          required
          className="rounded border px-3 py-2"
        />
      </label>

      {erro ? (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      ) : null}

      {!pronto ? <p className="text-sm text-neutral-500">Validando o link…</p> : null}

      <button
        type="submit"
        disabled={!pronto || salvando}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : 'Trocar senha'}
      </button>
    </form>
  )
}
