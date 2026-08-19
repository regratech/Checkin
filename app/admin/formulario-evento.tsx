'use client'

import { useActionState, useState } from 'react'
import { acaoCriarEvento, type ResultadoForm } from './acoes'
import { prefixoPadrao } from '@/lib/eventos'

export function FormularioEvento() {
  const [resultado, acao, enviando] = useActionState<ResultadoForm, FormData>(
    acaoCriarEvento,
    undefined,
  )
  const [nome, setNome] = useState('')
  const [data, setData] = useState('')
  const [prefixo, setPrefixo] = useState('')
  const [prefixoManual, setPrefixoManual] = useState(false)

  const ano = data ? Number(data.slice(0, 4)) : new Date().getFullYear()
  const sugestao = nome.trim().length >= 2 ? prefixoPadrao(nome, ano) : ''
  const valorPrefixo = prefixoManual ? prefixo : sugestao

  return (
    <form action={acao} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nome do evento</span>
        <input
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Data</span>
        <input
          name="data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Local</span>
        <input name="local" className="rounded border px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Prefixo do código</span>
        <input
          name="prefixo_codigo"
          value={valorPrefixo}
          onChange={(e) => {
            setPrefixoManual(true)
            setPrefixo(e.target.value.toUpperCase())
          }}
          className="rounded border px-3 py-2 font-mono"
        />
        <span className="text-xs text-neutral-500">
          As inscrições ficarão {valorPrefixo || 'ENG26'}-0001, {valorPrefixo || 'ENG26'}-0002…
        </span>
      </label>

      {resultado?.erro ? (
        <p role="alert" className="text-sm text-red-600">
          {resultado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {enviando ? 'Criando…' : 'Criar evento'}
      </button>
    </form>
  )
}
