import { FormularioEntrar } from './formulario-entrar'

export const metadata = { title: 'Entrar · Check-in R3' }

export default async function PaginaEntrar({ searchParams }: PageProps<'/entrar'>) {
  const { proximo } = await searchParams
  const destino =
    typeof proximo === 'string' && proximo.startsWith('/admin') ? proximo : '/admin'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-semibold">Check-in R3</h1>
      <FormularioEntrar proximo={destino} />
    </main>
  )
}
