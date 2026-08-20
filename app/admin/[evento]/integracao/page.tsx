import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { lerCompra } from '@/lib/guru'
import { ListaSincronizacoes, type LinhaSincronizacao } from './lista-sincronizacoes'

export default async function PaginaIntegracao({
  params,
}: PageProps<'/admin/[evento]/integracao'>) {
  const { evento: slug } = await params
  const supabase = await criarClienteServidor()

  const { data: evento } = await supabase
    .from('eventos')
    .select('id, nome, webhook_segredo')
    .eq('slug', slug)
    .maybeSingle()
  if (!evento) notFound()

  const { data } = await supabase
    .from('sincronizacoes')
    .select('id, recebido_em, status, erro, chave, payload, inscricao_id')
    .eq('evento_id', evento.id)
    .order('recebido_em', { ascending: false })
    .limit(100)

  const sincronizacoes: LinhaSincronizacao[] = (data ?? []).map((s) => {
    const leitura = lerCompra(s.payload)
    return {
      id: s.id,
      recebido_em: s.recebido_em,
      status: s.status,
      erro: s.erro,
      chave: s.chave,
      inscricao_id: s.inscricao_id,
      resumo: leitura.ok
        ? `${leitura.compra.nome} · ${leitura.compra.vagas} ${
            leitura.compra.vagas === 1 ? 'vaga' : 'vagas'
          }`
        : 'Payload não reconhecido',
    }
  })

  const urlBase = process.env.NEXT_PUBLIC_URL_BASE ?? 'http://localhost:3100'

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{evento.nome} · Integração</h1>

      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold">Configurar no n8n</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Acrescente um nó <strong>HTTP Request</strong> ao lado do que escreve na planilha —
          sem tirar o antigo. Método <code>POST</code>, corpo <code>{'{{ $json }}'}</code>.
        </p>
        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-neutral-500">URL</dt>
            <dd>
              <code className="break-all rounded bg-neutral-100 px-2 py-1">
                {urlBase}/api/guru/{slug}
              </code>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Cabeçalho</dt>
            <dd>
              <code className="break-all rounded bg-neutral-100 px-2 py-1">
                x-checkin-segredo: {evento.webhook_segredo}
              </code>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-neutral-500">
          O segredo vale só para este evento. Quem tiver ele consegue criar inscrições aqui —
          trate como senha.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">O que chegou</h2>
        <ListaSincronizacoes eventoSlug={slug} sincronizacoes={sincronizacoes} />
      </section>
    </div>
  )
}
