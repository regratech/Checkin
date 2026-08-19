import { createClient } from '@supabase/supabase-js'
import { lerConfigPublica } from './config'

/**
 * Clientes exclusivos do fluxo de recuperação de senha.
 *
 * Por que não usar os clientes normais: eles fixam `flowType: 'pkce'`, que
 * grava um `code_verifier` num cookie do navegador que PEDIU a recuperação e
 * exige esse mesmo cookie na hora de abrir o link. Na prática isso obriga a
 * pessoa a abrir o email no mesmo navegador em que pediu — e o caso mais
 * comum é o contrário: pedir no notebook e abrir no celular. Quando isso
 * acontece o Supabase recusa a troca e a tela mostra "link inválido",
 * indistinguível de link expirado.
 *
 * `flowType: 'implicit'` não guarda nada localmente: o link volta com o token
 * no fragmento da URL, e qualquer navegador consegue processá-lo.
 *
 * O projeto Engrenagem já tropeçou nisto — ver o arquivo de mesmo nome lá.
 */
export function criarClienteRecuperacaoServidor() {
  const { url, anon } = lerConfigPublica()
  return createClient(url, anon, {
    auth: {
      flowType: 'implicit',
      // Este cliente só dispara o email, nunca guarda sessão.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function criarClienteRecuperacaoBrowser() {
  const { url, anon } = lerConfigPublica()
  return createClient(url, anon, {
    auth: {
      flowType: 'implicit',
      // Lê o `#access_token` que o Supabase devolve no link do email.
      detectSessionInUrl: true,
      // Sessão só em memória: existe para trocar a senha e morre com a aba.
      // A sessão de verdade nasce depois, no login normal.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
