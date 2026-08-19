type Ambiente = Record<string, string | undefined>

function exigir(env: Ambiente, chave: string): string {
  const valor = env[chave]?.trim()
  if (!valor) {
    throw new Error(
      `${chave} não está definida. Preencha o .env.local — veja .env.local.example.`,
    )
  }
  return valor
}

export function lerConfigSupabase(env: Ambiente): { url: string; anon: string } {
  const url = exigir(env, 'NEXT_PUBLIC_SUPABASE_URL')

  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL inválida: "${url}".\n` +
        'Use o Project URL, no formato https://SEU-REF.supabase.co — sem /rest/v1 ' +
        'no fim, e não a URL do painel (supabase.com/dashboard/...).',
    )
  }

  return {
    url: url.replace(/\/$/, ''),
    anon: exigir(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

export function lerChaveServico(env: Ambiente): string {
  return exigir(env, 'SUPABASE_SERVICE_ROLE_KEY')
}

/**
 * Versão para código que roda no navegador.
 *
 * O Next substitui `process.env.NEXT_PUBLIC_X` por texto durante o build.
 * Passar `process.env` inteiro para uma função não deixa nada para
 * substituir, e no navegador o objeto chega vazio — a página quebra em
 * tempo de execução com "variável não está definida". Por isso as duas
 * leituras abaixo são literais, e não um acesso dinâmico.
 */
export function lerConfigPublica(): { url: string; anon: string } {
  return lerConfigSupabase({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}
