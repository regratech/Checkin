import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { listarPerguntas } from '@/lib/perguntas'
import { expandirRoteiro } from '@/lib/roteiro'
import { ListaPerguntas } from './lista-perguntas'
import { FormularioPergunta } from './formulario-pergunta'
import { PreviaRoteiro } from './previa-roteiro'

export default async function PaginaRoteiro({
  params,
  searchParams,
}: PageProps<'/admin/[evento]/roteiro'>) {
  const { evento: slug } = await params
  const { vagas: vagasBruto } = await searchParams

  const supabase = await criarClienteServidor()
  const { data: evento } = await supabase
    .from('eventos')
    .select('id, nome')
    .eq('slug', slug)
    .maybeSingle()
  if (!evento) notFound()

  const perguntas = await listarPerguntas(supabase, evento.id)

  const pedido = Number(Array.isArray(vagasBruto) ? vagasBruto[0] : vagasBruto)
  const vagas = Number.isFinite(pedido) && pedido >= 1 && pedido <= 10 ? Math.floor(pedido) : 2

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-4 text-xl font-semibold">{evento.nome} · Roteiro</h1>
        <ListaPerguntas eventoSlug={slug} perguntas={perguntas} />
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Nova pergunta</h2>
        <FormularioPergunta eventoSlug={slug} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Prévia da conversa</h2>
        <form method="get" className="mb-4 flex items-center gap-2 text-sm">
          <label htmlFor="vagas">Simular uma compra de</label>
          <select id="vagas" name="vagas" defaultValue={vagas} className="rounded border px-2 py-1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded border px-3 py-1">
            Atualizar
          </button>
        </form>

        <PreviaRoteiro passos={expandirRoteiro(perguntas, vagas)} vagas={vagas} />
      </section>
    </div>
  )
}
