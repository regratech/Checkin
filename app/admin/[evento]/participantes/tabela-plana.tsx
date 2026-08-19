import type { LinhaParticipante } from '@/lib/participantes'

export function TabelaPlana({ linhas }: { linhas: LinhaParticipante[] }) {
  if (linhas.length === 0) {
    return <p className="text-neutral-500">Nenhum participante encontrado.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            <th className="py-2 pr-4 font-medium">Código</th>
            <th className="py-2 pr-4 font-medium">Nome</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Telefone</th>
            <th className="py-2 pr-4 font-medium">Crachá</th>
            <th className="py-2 pr-4 font-medium">Cargo</th>
            <th className="py-2 pr-4 font-medium">Buffet</th>
            <th className="py-2 pr-4 font-medium">Na compra</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b last:border-0">
              <td className="py-2 pr-4 font-mono text-xs">{l.codigo_participante}</td>
              <td className="py-2 pr-4">
                {l.nome}
                {l.titular ? (
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                    titular
                  </span>
                ) : null}
              </td>
              <td className="py-2 pr-4">{l.email ?? '—'}</td>
              <td className="py-2 pr-4">{l.telefone ?? '—'}</td>
              <td className="py-2 pr-4">{l.nome_cracha ?? '—'}</td>
              <td className="py-2 pr-4">{l.cargo ?? '—'}</td>
              <td className="py-2 pr-4">{l.empresa_nome ?? '—'}</td>
              <td className="py-2 pr-4 tabular-nums">
                {l.pessoas_preenchidas}/{l.vagas}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
