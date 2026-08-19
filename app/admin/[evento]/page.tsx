import Link from 'next/link'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { SeletorEvento } from '@/app/admin/seletor-evento'
import type { Evento } from '@/lib/supabase/tipos'

const COLUNAS = 'id, nome, slug, prefixo_codigo, data, local, ativo'

export default async function PaginaEvento({ params }: PageProps<'/admin/[evento]'>) {
  const { evento: slug } = await params
  const supabase = await criarClienteServidor()

  const [{ data: atual }, { data: todos }] = await Promise.all([
    supabase.from('eventos').select(COLUNAS).eq('slug', slug).maybeSingle(),
    supabase
      .from('eventos')
      .select(COLUNAS)
      .order('data', { ascending: false, nullsFirst: false }),
  ])

  if (!atual) notFound()

  const { count: inscricoes } = await supabase
    .from('inscricoes')
    .select('*', { count: 'exact', head: true })
    .eq('evento_id', (atual as Evento).id)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{(atual as Evento).nome}</h1>
        <SeletorEvento eventos={(todos ?? []) as Evento[]} atual={slug} />
      </div>

      <p className="text-neutral-600">
        {inscricoes ?? 0} {inscricoes === 1 ? 'inscrição' : 'inscrições'}
      </p>

      <Link
        href={`/admin/${slug}/inscricoes/nova`}
        className="self-start rounded bg-neutral-900 px-4 py-2 text-white"
      >
        Nova inscrição
      </Link>
    </div>
  )
}
