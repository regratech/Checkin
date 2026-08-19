import Link from 'next/link'
import { FormularioRecuperar } from './formulario-recuperar'

export const metadata = { title: 'Recuperar senha · Check-in R3' }

export default function PaginaRecuperar() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-semibold">Recuperar senha</h1>
      <FormularioRecuperar />
      <Link href="/entrar" className="mt-6 text-sm underline">
        Voltar para entrar
      </Link>
    </main>
  )
}
