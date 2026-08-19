'use client'

import { useActionState, useState } from 'react'
import { acaoAtualizarPergunta, acaoCriarPergunta, type ResultadoForm } from './acoes'
import { lerOpcoes, precisaDeOpcoes, textoDeOpcoes } from '@/lib/opcoes'
import { TIPOS_PERGUNTA, type Pergunta, type TipoPergunta } from '@/lib/supabase/tipos'

const NOME_DO_TIPO: Record<TipoPergunta, string> = {
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

export function FormularioPergunta({
  eventoSlug,
  pergunta,
}: {
  eventoSlug: string
  pergunta?: Pergunta
}) {
  const editando = pergunta !== undefined
  const [resultado, acao, enviando] = useActionState<ResultadoForm, FormData>(
    editando ? acaoAtualizarPergunta : acaoCriarPergunta,
    undefined,
  )
  const [tipo, setTipo] = useState<TipoPergunta>(pergunta?.tipo ?? 'texto_curto')

  return (
    <form action={acao} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="evento_slug" value={eventoSlug} />
      {editando ? <input type="hidden" name="id" value={pergunta.id} /> : null}

      {editando ? (
        <p className="text-sm text-neutral-500">
          Chave: <code className="rounded bg-neutral-100 px-1.5 py-0.5">{pergunta.chave}</code> —
          usada no CSV, não muda.
        </p>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nome da coluna</span>
        <input
          name="rotulo"
          defaultValue={pergunta?.rotulo}
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Como a Lara pergunta</span>
        <textarea
          name="texto_chat"
          defaultValue={pergunta?.texto_chat}
          required
          rows={2}
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Tipo</span>
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoPergunta)}
          className="rounded border px-3 py-2"
        >
          {TIPOS_PERGUNTA.map((t) => (
            <option key={t} value={t}>
              {NOME_DO_TIPO[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Quem responde</span>
        <select
          name="escopo"
          defaultValue={pergunta?.escopo ?? 'inscricao'}
          disabled={editando}
          className="rounded border px-3 py-2 disabled:bg-neutral-100"
        >
          <option value="inscricao">Uma vez por inscrição (o buffet)</option>
          <option value="participante">Uma vez por pessoa</option>
        </select>
        {editando ? (
          <span className="text-xs text-neutral-500">
            Não pode mudar depois de criada: as respostas já gravadas dependem disso.
          </span>
        ) : null}
      </label>

      {precisaDeOpcoes(tipo) ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Opções</span>
          <textarea
            name="opcoes"
            defaultValue={pergunta ? textoDeOpcoes(lerOpcoes(pergunta.opcoes)) : ''}
            rows={5}
            className="rounded border px-3 py-2 font-mono text-sm"
          />
          <span className="text-xs text-neutral-500">
            Uma por linha. Para dizer o mesmo item em voz diferente ao acompanhante, separe com
            barra vertical — por exemplo: <code>Faço a comida | Faz a comida</code>
          </span>
        </label>
      ) : null}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="obrigatoria"
          defaultChecked={pergunta?.obrigatoria}
          className="rounded border"
        />
        <span className="text-sm">Obrigatória</span>
      </label>

      {resultado?.erro ? (
        <p role="alert" className="text-sm text-red-600">
          {resultado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {enviando ? 'Salvando…' : editando ? 'Salvar' : 'Adicionar pergunta'}
      </button>
    </form>
  )
}
