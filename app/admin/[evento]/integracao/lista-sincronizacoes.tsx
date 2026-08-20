import { acaoReprocessar } from './acoes'

export interface LinhaSincronizacao {
  id: string
  recebido_em: string
  status: string
  erro: string | null
  chave: string | null
  resumo: string
  inscricao_id: string | null
}

const ROTULO: Record<string, string> = {
  promovida: 'Virou inscrição',
  recebida: 'Aguardando aprovação',
  erro: 'Falhou',
}

export function ListaSincronizacoes({
  eventoSlug,
  sincronizacoes,
}: {
  eventoSlug: string
  sincronizacoes: LinhaSincronizacao[]
}) {
  if (sincronizacoes.length === 0) {
    return (
      <p className="text-neutral-500">
        Nada chegou do Guru ainda. Assim que uma compra for aprovada, ela aparece aqui.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {sincronizacoes.map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border px-4 py-3 text-sm"
        >
          <span className="tabular-nums text-neutral-500">
            {new Date(s.recebido_em).toLocaleString('pt-BR')}
          </span>
          <span className="font-medium">{s.resumo}</span>
          <span className="text-neutral-500">{ROTULO[s.status] ?? s.status}</span>

          {s.erro ? <span className="text-red-600">{s.erro}</span> : null}

          {s.status === 'erro' ? (
            <form action={acaoReprocessar} className="ml-auto">
              <input type="hidden" name="evento_slug" value={eventoSlug} />
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" className="rounded border px-3 py-1 text-xs">
                Reprocessar
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
