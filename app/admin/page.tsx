import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { FormularioEvento } from './formulario-evento'
import type { Evento } from '@/lib/supabase/tipos'

export default async function PaginaAdmin() {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('eventos')
    .select('id, nome, slug, prefixo_codigo, data, local, ativo')
    .order('data', { ascending: false, nullsFirst: false })

  const eventos = (data ?? []) as Evento[]

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Eventos</h1>
        {eventos.length === 0 ? (
          <p className="text-neutral-500">Nenhum evento ainda. Crie o primeiro abaixo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {eventos.map((evento) => (
              <li key={evento.id}>
                <Link href={`/admin/${evento.slug}`} className="underline">
                  {evento.nome}
                </Link>
                <span className="ml-2 font-mono text-sm text-neutral-500">
                  {evento.prefixo_codigo}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Novo evento</h2>
        <FormularioEvento />
      </section>
    </div>
  )
}
