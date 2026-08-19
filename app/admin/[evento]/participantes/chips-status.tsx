import Link from 'next/link'
import { STATUS_CHECKIN, type StatusCheckin } from '@/lib/supabase/tipos'
import type { Filtros } from '@/lib/participantes'

const ROTULOS: Record<StatusCheckin | 'todos', string> = {
  todos: 'Todos',
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

export function ChipsStatus({
  eventoSlug,
  filtros,
}: {
  eventoSlug: string
  filtros: Filtros
}) {
  const base = `/admin/${eventoSlug}/participantes`

  function href(status: StatusCheckin | 'todos'): string {
    // A ordem dos parametros e fixa (grupo, status, busca) para a URL de
    // uma mesma visao ser sempre a mesma string.
    const p = new URLSearchParams()
    if (filtros.grupo !== 'todos') p.set('grupo', filtros.grupo)
    if (status !== 'todos') p.set('status', status)
    if (filtros.busca) p.set('busca', filtros.busca)
    const q = p.toString()
    return q ? `${base}?${q}` : base
  }

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-neutral-500">Status</span>
      {(['todos', ...STATUS_CHECKIN] as const).map((status) => {
        const ativo = status === filtros.status
        return (
          <Link
            key={status}
            href={href(status)}
            aria-current={ativo ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 text-xs ${
              ativo ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'
            }`}
          >
            {ROTULOS[status]}
          </Link>
        )
      })}
    </nav>
  )
}
