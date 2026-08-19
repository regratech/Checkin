'use server'

import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { esquemaLogin } from '@/lib/auth/esquemas'

export type ResultadoAuth = { erro: string } | undefined

export async function entrar(
  _anterior: ResultadoAuth,
  form: FormData,
): Promise<ResultadoAuth> {
  const analise = esquemaLogin.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email: analise.data.email,
    password: analise.data.senha,
  })

  // Mesma mensagem para email inexistente e senha errada: dizer qual dos
  // dois falhou entrega a um atacante a lista de emails com conta.
  if (error) return { erro: 'Email ou senha incorretos' }

  const proximo = form.get('proximo')
  redirect(
    typeof proximo === 'string' && proximo.startsWith('/admin') ? proximo : '/admin',
  )
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect('/entrar')
}
