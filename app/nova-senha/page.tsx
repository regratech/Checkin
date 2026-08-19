import { FormularioNovaSenha } from './formulario-nova-senha'

export const metadata = { title: 'Nova senha · Check-in R3' }

export default function PaginaNovaSenha() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-semibold">Escolha a nova senha</h1>
      <FormularioNovaSenha />
    </main>
  )
}
