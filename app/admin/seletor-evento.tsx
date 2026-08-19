'use client'

import { useRouter } from 'next/navigation'
import type { Evento } from '@/lib/supabase/tipos'

export function SeletorEvento({ eventos, atual }: { eventos: Evento[]; atual?: string }) {
  const router = useRouter()

  if (eventos.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum evento cadastrado ainda.</p>
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-neutral-500">Evento</span>
      <select
        value={atual ?? ''}
        onChange={(e) => router.push(`/admin/${e.target.value}`)}
        className="rounded border px-2 py-1 text-sm"
      >
        <option value="" disabled>
          Escolha…
        </option>
        {eventos.map((evento) => (
          <option key={evento.id} value={evento.slug}>
            {evento.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
