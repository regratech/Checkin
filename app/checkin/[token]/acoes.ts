'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteAdmin } from '@/lib/supabase/servidor'
import { carregarPorToken, podeAvancar, proximoIndice } from '@/lib/checkin'
import type { Passo } from '@/lib/roteiro'

export type RespostaAcao = { ok: true } | { ok: false; erro: string }

/* eslint-disable @typescript-eslint/no-explicit-any */

// Campos do núcleo vão para a própria linha do participante. A lista é
// fechada de propósito: `confirmar_titular`, `abertura`, `buffet` e
// `revisao` também são passos com `fixo`, e usá-los como nome de coluna
// quebraria a gravação.
const COLUNAS_DO_NUCLEO = ['nome', 'email', 'telefone', 'data_nascimento', 'nome_cracha']

async function gravarValor(cliente: any, inscricaoId: string, passo: Passo, valor: unknown) {
  if (passo.pergunta) {
    const participanteId =
      passo.alvo.tipo === 'participante'
        ? ((
            await cliente
              .from('participantes')
              .select('id')
              .eq('inscricao_id', inscricaoId)
              .eq('ordem', passo.alvo.ordem)
              .maybeSingle()
          ).data?.id ?? null)
        : null

    await cliente.from('respostas').upsert(
      {
        pergunta_id: passo.pergunta.id,
        escopo: passo.pergunta.escopo,
        inscricao_id: inscricaoId,
        participante_id: participanteId,
        valor,
      },
      { onConflict: 'pergunta_id,inscricao_id,participante_id' },
    )
    return
  }

  if (
    passo.alvo.tipo === 'participante' &&
    passo.fixo &&
    COLUNAS_DO_NUCLEO.includes(passo.fixo)
  ) {
    await cliente
      .from('participantes')
      .update({ [passo.fixo]: valor })
      .eq('inscricao_id', inscricaoId)
      .eq('ordem', passo.alvo.ordem)
  }
}

export async function responder(
  token: string,
  chavePasso: string,
  valor: unknown,
): Promise<RespostaAcao> {
  const cliente = criarClienteAdmin()
  const estado = await carregarPorToken(cliente, token)

  if (!estado) return { ok: false, erro: 'Link inválido.' }
  if (estado.concluida) return { ok: false, erro: 'Este check-in já foi concluído.' }

  // Nunca confiar no cliente sobre qual é o passo atual: um cliente
  // adulterado pularia a validação de um campo obrigatório.
  const passo = estado.passos[estado.indice]
  if (!passo || passo.chave !== chavePasso) {
    return { ok: false, erro: 'Esse passo já foi respondido. Recarregue a página.' }
  }

  const permitido = podeAvancar(passo, valor)
  if (!permitido.ok) return permitido

  await gravarValor(cliente, estado.inscricao.id, passo, valor)

  const seguinte = estado.passos[proximoIndice(estado.passos, estado.indice)]
  await cliente
    .from('inscricoes')
    .update({ passo_atual: seguinte.chave, status_checkin: 'em_andamento' })
    .eq('id', estado.inscricao.id)

  revalidatePath(`/checkin/${token}`)
  return { ok: true }
}

/** Usado pela revisão final, para corrigir um campo já respondido. */
export async function voltarPara(token: string, chavePasso: string): Promise<RespostaAcao> {
  const cliente = criarClienteAdmin()
  const estado = await carregarPorToken(cliente, token)

  if (!estado) return { ok: false, erro: 'Link inválido.' }
  if (!estado.passos.some((p) => p.chave === chavePasso)) {
    return { ok: false, erro: 'Esse passo não existe mais.' }
  }

  await cliente
    .from('inscricoes')
    .update({ passo_atual: chavePasso })
    .eq('id', estado.inscricao.id)

  revalidatePath(`/checkin/${token}`)
  return { ok: true }
}

export async function concluir(token: string): Promise<RespostaAcao> {
  const cliente = criarClienteAdmin()
  const estado = await carregarPorToken(cliente, token)

  if (!estado) return { ok: false, erro: 'Link inválido.' }

  await cliente
    .from('inscricoes')
    .update({ status_checkin: 'concluido', concluido_em: new Date().toISOString() })
    .eq('id', estado.inscricao.id)

  revalidatePath(`/checkin/${token}`)
  return { ok: true }
}
