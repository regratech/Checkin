'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { criarInscricaoManual, type EntradaParticipante } from '@/lib/inscricoes'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export type ResultadoForm = { erro: string } | undefined

const esquemaCabecalho = z.object({
  evento_slug: z.string().trim().min(1),
  vagas: z.coerce.number().int().min(1).max(20),
  empresa_nome: z.string().trim().optional(),
  empresa_cidade: z.string().trim().optional(),
  empresa_instagram: z.string().trim().optional(),
})

/**
 * O formulario manda os participantes em campos indexados:
 * `participantes[0].nome`, `participantes[0].email`, e assim por diante.
 * Aqui eles voltam a ser uma lista.
 */
function lerParticipantes(form: FormData, vagas: number): EntradaParticipante[] {
  const lista: EntradaParticipante[] = []

  for (let i = 0; i < vagas; i++) {
    const ler = (campo: string) => {
      const v = form.get(`participantes[${i}].${campo}`)
      return typeof v === 'string' ? v.trim() : ''
    }

    const nome = ler('nome')
    const email = ler('email')
    if (!nome && !email) continue

    lista.push({
      nome,
      email,
      telefone: ler('telefone') || undefined,
      data_nascimento: ler('data_nascimento') || undefined,
      nome_cracha: ler('nome_cracha') || undefined,
      cargo: ler('cargo') || undefined,
    })
  }

  return lista
}

export async function acaoCriarInscricao(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const analise = esquemaCabecalho.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const { evento_slug, vagas, empresa_nome, empresa_cidade, empresa_instagram } =
    analise.data

  const supabase = await criarClienteServidor()

  const { data: evento, error: erroEvento } = await supabase
    .from('eventos')
    .select('id')
    .eq('slug', evento_slug)
    .maybeSingle()

  if (erroEvento) return { erro: erroEvento.message }
  if (!evento) return { erro: 'Evento não encontrado.' }

  const participantes = lerParticipantes(form, vagas)

  for (const p of participantes) {
    if (!p.nome) return { erro: 'Todo participante preenchido precisa de nome.' }
    if (!p.email) return { erro: `Falta o email de ${p.nome}.` }
  }

  try {
    await criarInscricaoManual(supabase, {
      evento_id: evento.id,
      vagas,
      empresa_nome: empresa_nome || undefined,
      empresa_cidade: empresa_cidade || undefined,
      empresa_instagram: empresa_instagram || undefined,
      participantes,
    })
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) }
  }

  revalidatePath(`/admin/${evento_slug}`)
}
