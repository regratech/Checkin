import type { GrupoInscricao } from '@/lib/participantes'

export function Grupos({ grupos }: { grupos: GrupoInscricao[] }) {
  if (grupos.length === 0) {
    return <p className="text-neutral-500">Nenhuma inscrição desse tamanho.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <section key={g.codigo} className="rounded border">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-neutral-50 px-4 py-2 text-sm">
            <span className="font-mono text-xs">{g.codigo}</span>
            <span className="font-medium">{g.empresa_nome ?? 'Sem buffet'}</span>
            {g.empresa_cidade ? (
              <span className="text-neutral-500">{g.empresa_cidade}</span>
            ) : null}
            <span className="ml-auto tabular-nums text-neutral-600">
              {g.preenchidos}/{g.vagas} preenchidos
            </span>
            {!g.completo ? (
              <span role="status" aria-label="Grupo incompleto" title="Grupo incompleto">
                ⚠
              </span>
            ) : null}
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {g.participantes.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pl-4 pr-4 font-mono text-xs">
                      {p.codigo_participante}
                    </td>
                    <td className="py-2 pr-4">
                      {p.nome}
                      {p.titular ? (
                        <span className="ml-2 text-xs text-neutral-500">titular</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">{p.cargo ?? '—'}</td>
                    <td className="py-2 pr-4">{p.nome_cracha ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
