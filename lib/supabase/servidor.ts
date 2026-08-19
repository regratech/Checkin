import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { lerConfigSupabase, lerChaveServico } from './config'

export async function criarClienteServidor() {
  const { url, anon } = lerConfigSupabase(process.env)
  const store = await cookies()
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // chamado de um Server Component: a sessao ja foi renovada antes
        }
      },
    },
  })
}

/**
 * Cliente com service_role. Ignora RLS por completo.
 * NUNCA importar em codigo que roda no navegador.
 */
export function criarClienteAdmin() {
  const { url } = lerConfigSupabase(process.env)
  return createClient(url, lerChaveServico(process.env), {
    auth: { persistSession: false },
  })
}
