import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { lerConfigSupabase } from '@/lib/supabase/config'

// Next 16 renomeou `middleware.ts` para `proxy.ts`, e o export passou a se
// chamar `proxy`. Ver node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/proxy.md
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })
  const { url, anon } = lerConfigSupabase(process.env)

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value))
        resposta = NextResponse.next({ request })
        lista.forEach(({ name, value, options }) =>
          resposta.cookies.set(name, value, options),
        )
      },
    },
  })

  // getUser, nunca getSession: getSession apenas le o cookie, sem validar a
  // assinatura contra o servidor de auth. Um cookie forjado passaria.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const caminho = request.nextUrl.pathname

  if (!user && caminho.startsWith('/admin')) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/entrar'
    destino.searchParams.set('proximo', caminho)
    return NextResponse.redirect(destino)
  }

  if (user && caminho === '/entrar') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/admin'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  return resposta
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
