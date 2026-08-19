'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteAdmin } from '@/lib/supabase/servidor'
import { carregarPorToken, podeAvancar, proximoIndice } from '@/lib/checkin'
import { ehPassoComposto, validarComposto, type ChaveComposta } from '@/lib/composto'
import { resolverPessoa } from '@/lib/inscricoes'
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

  // Passos compostos pedem varios campos de uma vez e tem validacao propria.
  if (ehPassoComposto(passo)) {
    const bruto = (typeof valor === 'object' && valor !== null ? valor : {}) as Record<
      string,
      unknown
    >
    const r = validarComposto(passo.fixo as ChaveComposta, bruto)
    if (!r.ok) return { ok: false, erro: r.erro }

    if (passo.fixo === 'buffet') {
      await cliente.from('inscricoes').update(r.valores).eq('id', estado.inscricao.id)
    } else if (passo.alvo.tipo === 'participante') {
      const ordem = passo.alvo.ordem
      const existente = estado.participantes.find((x) => x.ordem === ordem)

      if (existente) {
        await cliente.from('participantes').update(r.valores).eq('id', existente.id)
      } else {
        // O acompanhante ainda nao tem linha: so o titular nasce com a
        // inscricao. A pessoa e resolvida pelo par email + nome — por isso
        // este passo pede os dois juntos, e nao um de cada vez.
        const pessoaId = await resolverPessoa(
          cliente,
          String(r.valores.email),
          String(r.valores.nome),
        )
        await cliente.from('participantes').insert({
          ...r.valores,
          inscricao_id: estado.inscricao.id,
          pessoa_id: pessoaId,
          ordem,
          titular: false,
        })
      }
    }
  } else {
    const permitido = podeAvancar(passo, valor)
    if (!permitido.ok) return permitido

    await gravarValor(cliente, estado.inscricao.id, passo, valor)
  }

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
