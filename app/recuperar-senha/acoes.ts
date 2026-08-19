'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { criarClienteRecuperacaoServidor } from '@/lib/supabase/recuperacao'

export type ResultadoRecuperacao = { erro: string } | { aviso: string } | undefined

const esquema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Informe um email válido' })),
})

export async function pedirRecuperacao(
  _anterior: ResultadoRecuperacao,
  form: FormData,
): Promise<ResultadoRecuperacao> {
  const analise = esquema.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const cabecalhos = await headers()
  const origem = cabecalhos.get('origin') ?? 'http://localhost:3100'

  const supabase = criarClienteRecuperacaoServidor()
  const { error } = await supabase.auth.resetPasswordForEmail(analise.data.email, {
    redirectTo: `${origem}/nova-senha`,
  })

  if (error) {
    console.error('[recuperar-senha] falha ao disparar', {
      codigo: error.code,
      status: error.status,
      mensagem: error.message,
    })
  }

  // A mesma resposta exista ou não a conta: dizer "email não encontrado"
  // entrega a lista de contas a quem estiver sondando.
  return { aviso: 'Se existir uma conta com esse email, enviamos o link.' }
}
