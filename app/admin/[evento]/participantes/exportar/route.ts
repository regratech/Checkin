import { type NextRequest } from 'next/server'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { montarCsv, nomeArquivoCsv } from '@/lib/csv'
import { aplicarFiltroDeGrupo, lerFiltros, type LinhaParticipante } from '@/lib/participantes'

// `RouteContext<'/rota'>` e um helper global que o `next typegen` gera —
// nao se importa. Ver 03-file-conventions/route.md na doc da versao.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/admin/[evento]/participantes/exportar'>,
) {
  const { evento: slug } = await ctx.params

  // Os mesmos filtros da tela. Montar por conta propria aqui faria o CSV
  // divergir do que a pessoa esta vendo, sem ninguem perceber.
  const filtros = lerFiltros(Object.fromEntries(request.nextUrl.searchParams))

  const supabase = await criarClienteServidor()

  const { data: evento } = await supabase
    .from('eventos')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!evento) return new Response('Evento não encontrado', { status: 404 })

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

  const { data, error } = await consulta
  if (error) return new Response(error.message, { status: 500 })

  const csv = montarCsv((data ?? []) as LinhaParticipante[])
  const nome = nomeArquivoCsv(evento.slug, filtros.grupo)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  })
}
