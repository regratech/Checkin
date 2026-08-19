'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { criarEvento } from '@/lib/eventos'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export type ResultadoForm = { erro: string } | undefined

const esquemaEvento = z.object({
  nome: z.string().trim().min(2, { message: 'Informe o nome do evento' }),
  data: z.string().trim().optional(),
  local: z.string().trim().optional(),
  prefixo_codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,8}$/, { message: 'O prefixo usa de 3 a 8 letras ou números' })
    .optional()
    .or(z.literal('')),
})

export async function acaoCriarEvento(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const analise = esquemaEvento.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const { nome, data, local, prefixo_codigo } = analise.data
  const supabase = await criarClienteServidor()

  try {
    await criarEvento(supabase, {
      nome,
      data: data || undefined,
      local: local || undefined,
      prefixo_codigo: prefixo_codigo || undefined,
    })
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e)
    if (/duplicate key|23505/i.test(mensagem)) {
      return { erro: 'Já existe um evento com esse nome.' }
    }
    return { erro: mensagem }
  }

  // Sem isto a lista continua servindo o cache antigo e o evento novo
  // simplesmente nao aparece.
  revalidatePath('/admin')
}
