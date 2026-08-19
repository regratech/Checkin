'use client'

import { useState } from 'react'
import { lerOpcoes, rotuloDaOpcao } from '@/lib/opcoes'
import type { Passo } from '@/lib/roteiro'
import type { TipoPergunta } from '@/lib/supabase/tipos'

const TIPO_DO_CAMPO: Record<string, TipoPergunta> = {
  nome: 'texto_curto',
  email: 'email',
  telefone: 'telefone',
  data_nascimento: 'data',
  nome_cracha: 'texto_curto',
}

/** O tipo efetivo do passo: da pergunta, ou do campo do núcleo. */
function tipoDoPasso(passo: Passo): TipoPergunta | null {
  if (passo.pergunta) return passo.pergunta.tipo
  return passo.fixo ? (TIPO_DO_CAMPO[passo.fixo] ?? null) : null
}

function ehObrigatorio(passo: Passo): boolean {
  if (passo.pergunta) return passo.pergunta.obrigatoria
  return passo.fixo === 'nome' || passo.fixo === 'email'
}

const ATRIBUTO: Partial<Record<TipoPergunta, string>> = {
  email: 'email',
  telefone: 'tel',
  numero: 'number',
  data: 'date',
}

export function CampoResposta({
  passo,
  valorInicial,
  onResponder,
  enviando,
}: {
  passo: Passo
  valorInicial?: unknown
  onResponder: (valor: unknown) => void
  enviando: boolean
}) {
  const [texto, setTexto] = useState(valorInicial === undefined ? '' : String(valorInicial))
  const [marcadas, setMarcadas] = useState<string[]>(
    Array.isArray(valorInicial) ? (valorInicial as string[]) : [],
  )

  const tipo = tipoDoPasso(passo)
  if (!tipo) return null

  const opcoes = lerOpcoes(passo.pergunta?.opcoes)
  const opcional = !ehObrigatorio(passo)

  const botaoPular = opcional ? (
    <button
      type="button"
      disabled={enviando}
      onClick={() => onResponder('')}
      className="text-sm text-neutral-500 underline disabled:opacity-50"
    >
      Pular
    </button>
  ) : null

  if (tipo === 'selecao_unica') {
    return (
      <div className="flex flex-col items-start gap-2">
        {opcoes.map((o) => (
          <button
            key={o.chave}
            type="button"
            disabled={enviando}
            onClick={() => onResponder(o.chave)}
            className="rounded-full border px-4 py-2 text-left text-sm disabled:opacity-50"
          >
            {rotuloDaOpcao(o, passo.titular)}
          </button>
        ))}
        {botaoPular}
      </div>
    )
  }

  if (tipo === 'selecao_multipla') {
    return (
      <div className="flex flex-col items-start gap-2">
        {opcoes.map((o) => {
          const marcada = marcadas.includes(o.chave)
          return (
            <button
              key={o.chave}
              type="button"
              aria-pressed={marcada}
              disabled={enviando}
              onClick={() =>
                setMarcadas((atual) =>
                  marcada ? atual.filter((c) => c !== o.chave) : [...atual, o.chave],
                )
              }
              className={`rounded-full border px-4 py-2 text-left text-sm disabled:opacity-50 ${
                marcada ? 'border-neutral-900 bg-neutral-900 text-white' : ''
              }`}
            >
              {rotuloDaOpcao(o, passo.titular)}
            </button>
          )
        })}
        <button
          type="button"
          disabled={enviando}
          onClick={() => onResponder(marcadas)}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    )
  }

  if (tipo === 'nota_estrela') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={enviando}
            onClick={() => onResponder(String(n))}
            className="h-10 w-10 rounded-full border text-sm disabled:opacity-50"
          >
            {n}
          </button>
        ))}
        {botaoPular}
      </div>
    )
  }

  if (tipo === 'sim_nao') {
    return (
      <div className="flex items-center gap-2">
        {[
          ['sim', 'Sim'],
          ['nao', 'Não'],
        ].map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            disabled={enviando}
            onClick={() => onResponder(valor)}
            className="rounded-full border px-5 py-2 text-sm disabled:opacity-50"
          >
            {rotulo}
          </button>
        ))}
        {botaoPular}
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onResponder(texto)
      }}
      className="flex flex-col items-start gap-2"
    >
      {tipo === 'texto_longo' ? (
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={enviando}
          rows={3}
          autoFocus
          className="w-full rounded border px-3 py-2"
        />
      ) : (
        <input
          type={ATRIBUTO[tipo] ?? 'text'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={enviando}
          autoFocus
          className="w-full rounded border px-3 py-2"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {enviando ? 'Gravando…' : 'Continuar'}
        </button>
        {botaoPular}
      </div>
    </form>
  )
}
