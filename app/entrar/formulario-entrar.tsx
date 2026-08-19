'use client'

import { useActionState } from 'react'
import { entrar, type ResultadoAuth } from './acoes'

export function FormularioEntrar({ proximo }: { proximo: string }) {
  const [resultado, acao, enviando] = useActionState<ResultadoAuth, FormData>(
    entrar,
    undefined,
  )

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="proximo" value={proximo} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Senha</span>
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border px-3 py-2"
        />
      </label>

      {resultado?.erro ? (
        <p role="alert" className="text-sm text-red-600">
          {resultado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
