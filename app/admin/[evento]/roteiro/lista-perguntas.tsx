import type { Pergunta } from '@/lib/supabase/tipos'
import { acaoAlternarAtiva, acaoMoverPergunta } from './acoes'

const NOME_DO_TIPO: Record<Pergunta['tipo'], string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  email: 'Email',
  telefone: 'Telefone',
  numero: 'Número',
  data: 'Data',
  selecao_unica: 'Escolha uma',
  selecao_multipla: 'Escolha várias',
  nota_estrela: 'Nota de 0 a 5',
  sim_nao: 'Sim ou não',
}

export function ListaPerguntas({
  eventoSlug,
  perguntas,
}: {
  eventoSlug: string
  perguntas: Pergunta[]
}) {
  if (perguntas.length === 0) {
    return <p className="text-neutral-500">Nenhuma pergunta ainda. Crie a primeira abaixo.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {perguntas.map((p, i) => (
        <li
          key={p.id}
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded border px-4 py-3 ${
            p.ativa ? '' : 'bg-neutral-50 text-neutral-500'
          }`}
        >
          <span className="font-medium">{p.rotulo}</span>
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{p.chave}</code>
          <span className="text-sm text-neutral-500">{NOME_DO_TIPO[p.tipo]}</span>
          <span className="text-sm text-neutral-500">
            {p.escopo === 'participante' ? 'uma vez por pessoa' : 'uma vez por inscrição'}
          </span>
          {p.obrigatoria ? (
            <span className="text-xs text-neutral-500">obrigatória</span>
          ) : null}
          {!p.ativa ? <span className="text-xs font-medium">fora do roteiro</span> : null}

          <div className="ml-auto flex items-center gap-1">
            {i > 0 ? (
              <form action={acaoMoverPergunta}>
                <input type="hidden" name="evento_slug" value={eventoSlug} />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="direcao" value="cima" />
                <button
                  type="submit"
                  aria-label={`Subir ${p.rotulo}`}
                  className="rounded border px-2 py-1 text-xs"
                >
                  ↑
                </button>
              </form>
            ) : null}

            {i < perguntas.length - 1 ? (
              <form action={acaoMoverPergunta}>
                <input type="hidden" name="evento_slug" value={eventoSlug} />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="direcao" value="baixo" />
                <button
                  type="submit"
                  aria-label={`Descer ${p.rotulo}`}
                  className="rounded border px-2 py-1 text-xs"
                >
                  ↓
                </button>
              </form>
            ) : null}

            <form action={acaoAlternarAtiva}>
              <input type="hidden" name="evento_slug" value={eventoSlug} />
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="ativa" value={p.ativa ? 'false' : 'true'} />
              <button
                type="submit"
                aria-label={p.ativa ? `Tirar ${p.rotulo} do roteiro` : `Reativar ${p.rotulo}`}
                className="rounded border px-2 py-1 text-xs"
              >
                {p.ativa ? 'Tirar do roteiro' : 'Reativar'}
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  )
}
