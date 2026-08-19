'use client'

import { useActionState, useState } from 'react'
import { acaoCriarInscricao, type ResultadoForm } from './acoes'

const VAGAS_POSSIVEIS = [1, 2, 3, 4, 5, 6]

export function FormularioInscricao({ eventoSlug }: { eventoSlug: string }) {
  const [resultado, acao, enviando] = useActionState<ResultadoForm, FormData>(
    acaoCriarInscricao,
    undefined,
  )
  const [vagas, setVagas] = useState(1)

  return (
    <form action={acao} className="flex max-w-2xl flex-col gap-8">
      <input type="hidden" name="evento_slug" value={eventoSlug} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Buffet</h2>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Nome do buffet</span>
          <input name="empresa_nome" className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Cidade</span>
          <input name="empresa_cidade" className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Instagram</span>
          <input name="empresa_instagram" className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Vagas</span>
          <select
            name="vagas"
            value={vagas}
            onChange={(e) => setVagas(Number(e.target.value))}
            className="w-24 rounded border px-3 py-2"
          >
            {VAGAS_POSSIVEIS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Um bloco por vaga. Isto substitui os quatro ramos copiados do
          Typebot: mudar o numero muda quantos blocos existem, e nada mais. */}
      {Array.from({ length: vagas }, (_, i) => (
        <section key={i} className="flex flex-col gap-4 rounded border p-4">
          <h3 className="font-semibold">
            Participante {i + 1}
            {i === 0 ? ' (titular)' : ''}
          </h3>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Nome completo</span>
            <input
              name={`participantes[${i}].nome`}
              required={i === 0}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Email</span>
            <input
              name={`participantes[${i}].email`}
              type="email"
              required={i === 0}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Telefone</span>
            <input
              name={`participantes[${i}].telefone`}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Aniversário</span>
            <input
              name={`participantes[${i}].data_nascimento`}
              type="date"
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Nome no crachá</span>
            <input
              name={`participantes[${i}].nome_cracha`}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Cargo</span>
            <input
              name={`participantes[${i}].cargo`}
              className="rounded border px-3 py-2"
            />
          </label>
        </section>
      ))}

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
        {enviando ? 'Gravando…' : 'Criar inscrição'}
      </button>
    </form>
  )
}
