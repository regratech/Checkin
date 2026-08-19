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

  if (error) {
    // A causa real fica no log do servidor. Sem isto, senha errada, email
    // nao confirmado, limite de tentativas e configuracao quebrada viram a
    // mesma frase na tela e a falha fica indiagnosticavel — aconteceu.
    console.error('[entrar] falha de autenticacao', {
      codigo: error.code,
      status: error.status,
      mensagem: error.message,
    })

    // Na tela, a mensagem continua generica: dizer qual dos dois falhou
    // entrega a um atacante a lista de emails com conta.
    return { erro: 'Email ou senha incorretos' }
  }

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
