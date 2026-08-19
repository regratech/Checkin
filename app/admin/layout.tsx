import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { sair } from '@/app/entrar/acoes'

export const metadata = { title: 'Admin · Check-in R3' }

export default async function LayoutAdmin({ children }: LayoutProps<'/admin'>) {
  const supabase = await criarClienteServidor()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  // O proxy so garante sessao. Uma conta `publico` esta autenticada e
  // passaria por ele — o papel precisa ser conferido aqui, no servidor.
  const { data: perfil } = await supabase
    .from('perfis')
    .select('papel, nome')
    .eq('id', user.id)
    .maybeSingle()

  if (perfil?.papel !== 'admin') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-neutral-600">Esta conta não tem permissão de administrador.</p>
        <form action={sair}>
          <button type="submit" className="text-sm underline">
            Sair
          </button>
        </form>
      </main>
    )
  }

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Check-in R3</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-500">{perfil.nome}</span>
          <form action={sair}>
            <button type="submit" className="underline">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
