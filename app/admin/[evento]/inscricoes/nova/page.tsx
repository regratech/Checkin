import { FormularioInscricao } from './formulario-inscricao'

export default async function PaginaNovaInscricao({
  params,
}: PageProps<'/admin/[evento]/inscricoes/nova'>) {
  const { evento } = await params

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Nova inscrição</h1>
      <FormularioInscricao eventoSlug={evento} />
    </div>
  )
}
