import Link from 'next/link'
import { GRUPOS, type Grupo } from '@/lib/participantes'
import type { StatusCheckin } from '@/lib/supabase/tipos'

const ROTULOS: Record<Grupo, string> = {
  todos: 'Geral',
  '1': '1 pessoa',
  '2': '2 pessoas',
  '3': '3 pessoas',
  '4+': '4+ pessoas',
}

export function AbasTamanho({
  eventoSlug,
  atual,
  contagens,
  statusAtual,
  busca,
}: {
  eventoSlug: string
  atual: Grupo
  contagens: Record<Grupo, number>
  statusAtual: StatusCheckin | 'todos'
  busca: string
}) {
  const base = `/admin/${eventoSlug}/participantes`

  return (
    <nav className="flex flex-wrap gap-2">
      {GRUPOS.map((grupo) => {
        const ativo = grupo === atual

        // Trocar de aba preserva o que a pessoa ja filtrou. A ordem dos
        // parametros e fixa para a URL de uma mesma visao ser sempre igual.
        const p = new URLSearchParams()
        if (grupo !== 'todos') p.set('grupo', grupo)
        if (statusAtual !== 'todos') p.set('status', statusAtual)
        if (busca) p.set('busca', busca)
        const q = p.toString()
        const href = q ? `${base}?${q}` : base

        return (
          <Link
            key={grupo}
            href={href}
            aria-current={ativo ? 'page' : undefined}
            className={`rounded border px-3 py-1.5 text-sm ${
              ativo ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'
            }`}
          >
            {ROTULOS[grupo]}
            <span className={`ml-2 ${ativo ? 'text-neutral-300' : 'text-neutral-500'}`}>
              {contagens[grupo]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
