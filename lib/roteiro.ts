import type { Pergunta } from '@/lib/supabase/tipos'

export type AlvoPasso = { tipo: 'inscricao' } | { tipo: 'participante'; ordem: number }

export type CampoFixo =
  | 'abertura'
  | 'confirmar_titular'
  | 'dados_participante'
  | 'buffet'
  | 'revisao'

export interface Passo {
  /** Único no roteiro. É o marcador gravado em `inscricoes.passo_atual`. */
  chave: string
  alvo: AlvoPasso
  /** Presente quando o passo vem de uma pergunta cadastrada. */
  pergunta?: Pergunta
  /** Presente quando o passo é um campo do núcleo fixo. */
  fixo?: CampoFixo
  /** Se o passo fala com o titular (muda a voz das opções). */
  titular: boolean
}


/**
 * Expande o roteiro único nos passos concretos daquela inscrição.
 *
 * É esta função que substitui os quatro ramos copiados do Typebot
 * (`Group #6`: numero_insc = 1 | 2 | 3 | 4). O número de blocos é
 * consequência de `vagas`; nada aqui conhece o número 4.
 */
export function expandirRoteiro(perguntas: Pergunta[], vagas: number): Passo[] {
  // A função é pura e pode ser chamada de qualquer lugar. Degradar para uma
  // vaga é melhor do que devolver um roteiro sem participante nenhum.
  const total = Number.isFinite(vagas) && vagas >= 1 ? Math.floor(vagas) : 1

  const ativas = perguntas.filter((p) => p.ativa).sort((a, b) => a.ordem - b.ordem)
  const doParticipante = ativas.filter((p) => p.escopo === 'participante')
  const daInscricao = ativas.filter((p) => p.escopo === 'inscricao')

  const passos: Passo[] = [
    { chave: 'abertura', alvo: { tipo: 'inscricao' }, fixo: 'abertura', titular: true },
  ]

  for (let ordem = 1; ordem <= total; ordem++) {
    const titular = ordem === 1
    const alvo: AlvoPasso = { tipo: 'participante', ordem }

    if (titular) {
      // O único momento com dado pré-existente: o que veio do Guru.
      // Acompanhantes são coleta em branco — não há o que confirmar.
      passos.push({
        chave: `p${ordem}.confirmar_titular`,
        alvo,
        fixo: 'confirmar_titular',
        titular,
      })
    } else {
      // Um bloco por pessoa, não cinco perguntas soltas. O motivo é técnico:
      // a linha em `participantes` só pode nascer com nome E email juntos,
      // porque `pessoa_id` é obrigatório e a pessoa é resolvida pelo par.
      // Descoberto no navegador — antes disso o acompanhante era gravado
      // num update que não acertava linha nenhuma, em silêncio.
      passos.push({
        chave: `p${ordem}.dados_participante`,
        alvo,
        fixo: 'dados_participante',
        titular,
      })
    }

    for (const pergunta of doParticipante) {
      passos.push({ chave: `p${ordem}.${pergunta.chave}`, alvo, pergunta, titular })
    }
  }

  passos.push({ chave: 'buffet', alvo: { tipo: 'inscricao' }, fixo: 'buffet', titular: true })

  for (const pergunta of daInscricao) {
    passos.push({
      chave: `i.${pergunta.chave}`,
      alvo: { tipo: 'inscricao' },
      pergunta,
      titular: true,
    })
  }

  passos.push({ chave: 'revisao', alvo: { tipo: 'inscricao' }, fixo: 'revisao', titular: true })

  return passos
}

/**
 * Onde retomar. Marcador desconhecido volta ao começo: uma pergunta pode
 * ter sido removida entre a interrupção e a volta, e isso não pode travar
 * a conversa.
 */
export function indiceDoPasso(roteiro: Passo[], chave: string): number {
  const indice = roteiro.findIndex((p) => p.chave === chave)
  return indice >= 0 ? indice : 0
}
