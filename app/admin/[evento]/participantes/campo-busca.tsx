'use client'

import { usePathname, useSearchParams } from 'next/navigation'

export function CampoBusca({ valorInicial }: { valorInicial: string }) {
  const caminho = usePathname()
  const parametros = useSearchParams()
  const grupo = parametros.get('grupo') ?? ''
  const status = parametros.get('status') ?? ''

  // Formulario GET: a busca escreve na URL sozinha, funciona sem javascript
  // e o resultado continua compartilhavel por link.
  return (
    <form method="get" action={caminho} className="flex gap-2">
      {grupo ? <input type="hidden" name="grupo" value={grupo} /> : null}
      {status ? <input type="hidden" name="status" value={status} /> : null}

      <input
        type="search"
        name="busca"
        defaultValue={valorInicial}
        placeholder="Nome, email, telefone, buffet ou código"
        className="w-80 rounded border px-3 py-1.5 text-sm"
      />
      <button type="submit" className="rounded border px-3 py-1.5 text-sm">
        Buscar
      </button>
    </form>
  )
}
