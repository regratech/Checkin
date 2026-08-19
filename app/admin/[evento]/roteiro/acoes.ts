'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  alternarAtiva,
  atualizarPergunta,
  criarPergunta,
  esquemaPergunta,
  moverPergunta,
} from '@/lib/perguntas'

export type ResultadoForm = { erro: string } | undefined

async function acharEvento(slug: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('eventos').select('id').eq('slug', slug).maybeSingle()
  return { supabase, evento: data as { id: string } | null }
}

export async function acaoCriarPergunta(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const slug = String(form.get('evento_slug') ?? '')
  const analise = esquemaPergunta.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const { supabase, evento } = await acharEvento(slug)
  if (!evento) return { erro: 'Evento não encontrado.' }

  try {
    await criarPergunta(supabase, evento.id, analise.data)
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) }
  }

  revalidatePath(`/admin/${slug}/roteiro`)
}

export async function acaoAtualizarPergunta(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const slug = String(form.get('evento_slug') ?? '')
  const id = String(form.get('id') ?? '')
  const analise = esquemaPergunta.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const supabase = await criarClienteServidor()

  try {
    // `chave` e `escopo` não são passados: a chave amarra o histórico e o
    // escopo é parte da FK composta que valida as respostas já gravadas.
    await atualizarPergunta(supabase, id, analise.data)
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) }
  }

  revalidatePath(`/admin/${slug}/roteiro`)
}

export async function acaoMoverPergunta(form: FormData) {
  const slug = String(form.get('evento_slug') ?? '')
  const id = String(form.get('id') ?? '')
  const direcao = form.get('direcao') === 'cima' ? 'cima' : 'baixo'

  const { supabase, evento } = await acharEvento(slug)
  if (!evento) return

  await moverPergunta(supabase, evento.id, id, direcao)
  revalidatePath(`/admin/${slug}/roteiro`)
}

export async function acaoAlternarAtiva(form: FormData) {
  const slug = String(form.get('evento_slug') ?? '')
  const id = String(form.get('id') ?? '')
  const ativa = form.get('ativa') === 'true'

  const supabase = await criarClienteServidor()
  await alternarAtiva(supabase, id, ativa)
  revalidatePath(`/admin/${slug}/roteiro`)
}
