'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CampoResposta } from './campo-resposta'
import { CampoComposto } from './campo-composto'
import { ehPassoComposto, type ChaveComposta } from '@/lib/composto'
import { Revisao } from './revisao'
import { responder } from './acoes'
import type { EstadoSerializado } from '@/lib/checkin'

const TEXTO_FIXO: Record<string, string> = {
  confirmar_titular: 'Começando por você. Confere se está certo?',
  nome: 'Qual o nome completo?',
  email: 'Qual o email?',
  telefone: 'Qual o telefone, com DDD?',
  data_nascimento: 'Qual a data de aniversário?',
  nome_cracha: 'Como quer o nome no crachá?',
  buffet: 'Agora me conta sobre o buffet.',
}

export function Conversa({ token, estado }: { token: string; estado: EstadoSerializado }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [enviando, iniciarTransicao] = useTransition()

  const passo = estado.passos[estado.indice]

  if (estado.concluida) {
    return (
      <div className="rounded border p-6 text-center">
        <p className="text-lg font-medium">Tudo certo!</p>
        <p className="mt-2 text-neutral-600">
          Seu check-in já foi concluído. Ao chegar, o nome estará na lista de presença e o crachá
          será retirado na entrada.
        </p>
      </div>
    )
  }

  function enviar(valor: unknown) {
    setErro('')
    iniciarTransicao(async () => {
      const r = await responder(token, passo.chave, valor)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  const contador =
    passo.alvo.tipo === 'participante' ? `Pessoa ${passo.alvo.ordem} de ${estado.vagas}` : null

  const abertura = `Oi, ${estado.nomeTitular}! Você garantiu ${estado.vagas} ${
    estado.vagas === 1 ? 'vaga' : 'vagas'
  }. Vou precisar dos dados de cada pessoa — leva uns 4 minutos.`

  const fala = passo.pergunta
    ? passo.pergunta.texto_chat
    : passo.fixo === 'abertura'
      ? abertura
      : (TEXTO_FIXO[passo.fixo ?? ''] ?? '')

  const progresso = (estado.indice / Math.max(estado.passos.length - 1, 1)) * 100

  return (
    <div className="flex flex-col gap-6">
      <div
        role="progressbar"
        aria-valuenow={estado.indice}
        aria-valuemin={0}
        aria-valuemax={estado.passos.length - 1}
        aria-label="Progresso do check-in"
        className="h-1 w-full overflow-hidden rounded bg-neutral-200"
      >
        <div className="h-full bg-neutral-900 transition-all" style={{ width: `${progresso}%` }} />
      </div>

      {contador ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {contador}
        </p>
      ) : null}

      {passo.fixo === 'revisao' ? (
        <Revisao token={token} estado={estado} />
      ) : (
        <>
          <p className="text-lg">{fala}</p>

          {ehPassoComposto(passo) ? (
            <CampoComposto
              chave={passo.fixo as ChaveComposta}
              valoresIniciais={estado.valoresCompostos[passo.chave] ?? {}}
              onResponder={enviar}
              enviando={enviando}
            />
          ) : passo.fixo === 'abertura' ? (
            <button
              type="button"
              disabled={enviando}
              onClick={() => enviar('')}
              className="self-start rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              Vamos lá
            </button>
          ) : (
            <CampoResposta
              passo={passo}
              valorInicial={estado.respostas[passo.chave]}
              onResponder={enviar}
              enviando={enviando}
            />
          )}
        </>
      )}

      {erro ? (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
