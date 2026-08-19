'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { concluir, voltarPara } from './acoes'
import { lerOpcoes, rotuloDaOpcao } from '@/lib/opcoes'
import type { Passo } from '@/lib/roteiro'
import type { EstadoSerializado } from '@/lib/checkin'

const NOME_FIXO: Record<string, string> = {
  nome: 'Nome',
  email: 'Email',
  telefone: 'Telefone',
  data_nascimento: 'Aniversário',
  nome_cracha: 'Crachá',
}

/** Mostrar `faz_tudo` na revisão seria incompreensível. */
function mostrar(passo: Passo, valor: unknown): string {
  if (valor === undefined || valor === null || String(valor).trim() === '') return ''

  if (passo.pergunta) {
    const opcoes = lerOpcoes(passo.pergunta.opcoes)
    if (Array.isArray(valor)) {
      return valor
        .map((c) => {
          const o = opcoes.find((x) => x.chave === c)
          return o ? rotuloDaOpcao(o, passo.titular) : String(c)
        })
        .join(', ')
    }
    const o = opcoes.find((x) => x.chave === valor)
    if (o) return rotuloDaOpcao(o, passo.titular)
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  }

  return String(valor)
}

function rotulo(passo: Passo): string {
  if (passo.pergunta) return passo.pergunta.rotulo
  return NOME_FIXO[passo.fixo ?? ''] ?? passo.chave
}

export function Revisao({ token, estado }: { token: string; estado: EstadoSerializado }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [ocupado, iniciarTransicao] = useTransition()

  // Só os passos que guardam alguma resposta — abertura e revisão não entram.
  const revisaveis = estado.passos.filter(
    (p) => p.pergunta !== undefined || NOME_FIXO[p.fixo ?? ''] !== undefined,
  )

  const grupos = new Map<string, Passo[]>()
  for (const p of revisaveis) {
    const titulo = p.alvo.tipo === 'participante' ? `Pessoa ${p.alvo.ordem}` : 'Buffet'
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), p])
  }

  function corrigir(chave: string) {
    setErro('')
    iniciarTransicao(async () => {
      const r = await voltarPara(token, chave)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  function fechar() {
    setErro('')
    iniciarTransicao(async () => {
      const r = await concluir(token)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-lg">Pronto! Confere pra mim antes de fechar.</p>

      {[...grupos.entries()].map(([titulo, passos]) => (
        <section key={titulo} className="rounded border">
          <h2 className="border-b bg-neutral-50 px-4 py-2 text-sm font-semibold">{titulo}</h2>
          <ul>
            {passos.map((p) => {
              const texto = mostrar(p, estado.respostas[p.chave])
              return (
                <li
                  key={p.chave}
                  className="flex items-center gap-3 border-b px-4 py-2 text-sm last:border-0"
                >
                  <span className="w-28 shrink-0 text-neutral-500">{rotulo(p)}</span>
                  <span className={`flex-1 ${texto ? '' : 'text-neutral-400'}`}>
                    {texto || 'em branco'}
                  </span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => corrigir(p.chave)}
                    aria-label={`Corrigir ${rotulo(p)} de ${titulo}`}
                    className="text-xs underline disabled:opacity-50"
                  >
                    Corrigir
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {erro ? (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      ) : null}

      <button
        type="button"
        disabled={ocupado}
        onClick={fechar}
        className="self-start rounded bg-neutral-900 px-5 py-2.5 text-white disabled:opacity-50"
      >
        {ocupado ? 'Fechando…' : 'Concluir check-in'}
      </button>
    </div>
  )
}
