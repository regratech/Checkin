import { semAcento } from '@/lib/identidade'
import type { Evento } from '@/lib/supabase/tipos'

export interface NovoEvento {
  nome: string
  data?: string
  local?: string
  prefixo_codigo?: string
}

export function slugificar(texto: string): string {
  return semAcento(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** `Engrenagem` + 2026 -> `ENG26`. So um padrao: o admin pode sobrescrever. */
export function prefixoPadrao(nome: string, ano: number): string {
  const letras = semAcento(nome)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
  return `${letras}${String(ano).slice(-2)}`
}

type ClienteSupabase = {
  from: (tabela: string) => {
    insert: (linha: Record<string, unknown>) => {
      select: () => { single: () => Promise<{ data: unknown; error: unknown }> }
    }
  }
}

export async function criarEvento(
  cliente: ClienteSupabase,
  entrada: NovoEvento,
): Promise<Evento> {
  const ano = entrada.data ? Number(entrada.data.slice(0, 4)) : new Date().getFullYear()

  const { data, error } = await cliente
    .from('eventos')
    .insert({
      nome: entrada.nome,
      slug: slugificar(entrada.nome),
      prefixo_codigo: entrada.prefixo_codigo ?? prefixoPadrao(entrada.nome, ano),
      data: entrada.data ?? null,
      local: entrada.local ?? null,
    })
    .select()
    .single()

  if (error) throw new Error((error as { message: string }).message)
  return data as Evento
}
