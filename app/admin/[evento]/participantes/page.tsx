import Link from 'next/link'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  GRUPOS,
  agruparPorInscricao,
  aplicarFiltroDeGrupo,
  lerFiltros,
  type Grupo,
  type LinhaParticipante,
} from '@/lib/participantes'
import { AbasTamanho } from './abas-tamanho'
import { ChipsStatus } from './chips-status'
import { CampoBusca } from './campo-busca'
import { TabelaPlana } from './tabela-plana'
import { Grupos } from './grupos'

export default async function PaginaParticipantes({
  params,
  searchParams,
}: PageProps<'/admin/[evento]/participantes'>) {
  const { evento: slug } = await params
  const filtros = lerFiltros(await searchParams)
  const supabase = await criarClienteServidor()

  const { data: evento } = await supabase
    .from('eventos')
    .select('id, nome, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (!evento) notFound()

  let consulta = supabase
    .from('vw_participantes')
    .select('*')
    .eq('evento_id', evento.id)
    .order('codigo_participante')

  consulta = aplicarFiltroDeGrupo(consulta, filtros.grupo)
  if (filtros.status !== 'todos') consulta = consulta.eq('status_checkin', filtros.status)
  if (filtros.busca) {
    const t = `%${filtros.busca}%`
    consulta = consulta.or(
      `nome.ilike.${t},email.ilike.${t},telefone.ilike.${t},empresa_nome.ilike.${t},codigo.ilike.${t}`,
    )
  }

  const { data } = await consulta
  const linhas = (data ?? []) as LinhaParticipante[]

  // As contagens das abas ignoram o grupo escolhido — senao a aba ativa
  // mostraria o total e as outras mostrariam zero.
  const { data: todasDoEvento } = await supabase
    .from('vw_participantes')
    .select('vagas')
    .eq('evento_id', evento.id)

  const contagens = Object.fromEntries(GRUPOS.map((g) => [g, 0])) as Record<Grupo, number>
  for (const { vagas } of (todasDoEvento ?? []) as Array<{ vagas: number }>) {
    contagens.todos++
    const chave: Grupo = vagas >= 4 ? '4+' : (String(vagas) as Grupo)
    if (chave in contagens) contagens[chave]++
  }

  const parametrosExport = new URLSearchParams()
  if (filtros.grupo !== 'todos') parametrosExport.set('grupo', filtros.grupo)
  if (filtros.status !== 'todos') parametrosExport.set('status', filtros.status)
  if (filtros.busca) parametrosExport.set('busca', filtros.busca)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{evento.nome} · Participantes</h1>
        <Link
          href={`/admin/${slug}/participantes/exportar?${parametrosExport}`}
          className="rounded border px-3 py-1.5 text-sm"
        >
          Exportar CSV
        </Link>
      </div>

      <AbasTamanho
        eventoSlug={slug}
        atual={filtros.grupo}
        contagens={contagens}
        statusAtual={filtros.status}
        busca={filtros.busca}
      />
      <ChipsStatus eventoSlug={slug} filtros={filtros} />
      <CampoBusca valorInicial={filtros.busca} />

      {filtros.grupo === 'todos' ? (
        <TabelaPlana linhas={linhas} />
      ) : (
        <Grupos grupos={agruparPorInscricao(linhas)} />
      )}
    </div>
  )
}
