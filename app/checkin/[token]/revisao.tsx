'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { concluir, voltarPara } from './acoes'
import { lerOpcoes, rotuloDaOpcao } from '@/lib/opcoes'
import type { Passo } from '@/lib/roteiro'
import type { EstadoSerializado } from '@/lib/checkin'
import { CAMPOS_COMPOSTOS, ehPassoComposto, type ChaveComposta } from '@/lib/composto'

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

  // Cada linha da revisao: de onde vem o rotulo, o valor e para onde o
  // botao Corrigir manda a conversa de volta.
  interface Linha {
    id: string
    rotulo: string
    texto: string
    chaveDoPasso: string
  }

  const grupos = new Map<string, Linha[]>()
  const juntar = (titulo: string, linha: Linha) =>
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), linha])

  for (const p of estado.passos) {
    const titulo = p.alvo.tipo === 'participante' ? `Pessoa ${p.alvo.ordem}` : 'Buffet'

    // Passos compostos viram varias linhas — sem isto, os dados do titular
    // e do buffet nao apareciam na revisao.
    if (ehPassoComposto(p)) {
      const valores = estado.valoresCompostos[p.chave] ?? {}
      for (const campo of CAMPOS_COMPOSTOS[p.fixo as ChaveComposta]) {
        juntar(titulo, {
          id: `${p.chave}.${campo.nome}`,
          rotulo: campo.rotulo,
          texto: String(valores[campo.nome] ?? ''),
          chaveDoPasso: p.chave,
        })
      }
      continue
    }

    if (p.pergunta === undefined && NOME_FIXO[p.fixo ?? ''] === undefined) continue

    juntar(titulo, {
      id: p.chave,
      rotulo: rotulo(p),
      texto: mostrar(p, estado.respostas[p.chave]),
      chaveDoPasso: p.chave,
    })
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

      {[...grupos.entries()].map(([titulo, linhas]) => (
        <section key={titulo} className="rounded border">
          <h2 className="border-b bg-neutral-50 px-4 py-2 text-sm font-semibold">{titulo}</h2>
          <ul>
            {linhas.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-3 border-b px-4 py-2 text-sm last:border-0"
              >
                <span className="w-28 shrink-0 text-neutral-500">{l.rotulo}</span>
                <span className={`flex-1 ${l.texto ? '' : 'text-neutral-400'}`}>
                  {l.texto || 'em branco'}
                </span>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => corrigir(l.chaveDoPasso)}
                  aria-label={`Corrigir ${l.rotulo} de ${titulo}`}
                  className="text-xs underline disabled:opacity-50"
                >
                  Corrigir
                </button>
              </li>
            ))}
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
