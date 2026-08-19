'use client'

import { useState } from 'react'
import { CAMPOS_COMPOSTOS, type ChaveComposta } from '@/lib/composto'

const ATRIBUTO: Record<string, string> = {
  email: 'email',
  telefone: 'tel',
  data: 'date',
}

/**
 * Os dois passos que pedem vários campos de uma vez: a confirmação do
 * titular (com o que veio da compra já preenchido) e o bloco do buffet.
 */
export function CampoComposto({
  chave,
  valoresIniciais,
  onResponder,
  enviando,
}: {
  chave: ChaveComposta
  valoresIniciais: Record<string, string>
  onResponder: (valores: Record<string, string>) => void
  enviando: boolean
}) {
  const campos = CAMPOS_COMPOSTOS[chave]
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.nome, valoresIniciais[c.nome] ?? ''])),
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onResponder(valores)
      }}
      className="flex flex-col gap-3"
    >
      {campos.map((campo) => (
        <label key={campo.nome} className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">
            {campo.rotulo}
            {campo.obrigatorio ? '' : ' (opcional)'}
          </span>
          <input
            name={campo.nome}
            type={ATRIBUTO[campo.tipo] ?? 'text'}
            value={valores[campo.nome]}
            onChange={(e) => setValores((v) => ({ ...v, [campo.nome]: e.target.value }))}
            disabled={enviando}
            className="rounded border px-3 py-2"
          />
        </label>
      ))}

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 self-start rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {enviando ? 'Gravando…' : 'Está certo, continuar'}
      </button>
    </form>
  )
}
