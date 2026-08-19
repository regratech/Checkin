import { expandirRoteiro, indiceDoPasso, type Passo } from '@/lib/roteiro'
import { validarResposta } from '@/lib/validacao'
import type { Inscricao, Participante, Pergunta } from '@/lib/supabase/tipos'

export interface EstadoConversa {
  inscricao: Inscricao
  passos: Passo[]
  indice: number
  /** Chaveado pela chave do passo. */
  respostas: Record<string, unknown>
  participantes: Participante[]
  concluida: boolean
}

/**
 * O recorte do estado que vai para o navegador. Vive aqui, e não em
 * `conversa.tsx`, porque `revisao.tsx` também precisa dele — e conversa já
 * importa revisao, o que fecharia um ciclo.
 */
export interface EstadoSerializado {
  passos: Passo[]
  indice: number
  respostas: Record<string, unknown>
  nomeTitular: string
  vagas: number
  concluida: boolean
  /** Pre-preenchimento dos passos compostos, por chave do passo. */
  valoresCompostos: Record<string, Record<string, string>>
}

const COLUNAS_DO_NUCLEO = [
  "nome",
  "email",
  "telefone",
  "data_nascimento",
  "nome_cracha",
] as const

/**
 * Os campos do nucleo vivem nas colunas de `participantes`, nao na tabela
 * `respostas`. Sem trazer isso para o mesmo mapa, a revisao final mostrava
 * "em branco" para dados que estavam gravados — visto no navegador.
 */
export function respostasDoNucleo(
  participantes: Array<Pick<Participante, 'ordem' | (typeof COLUNAS_DO_NUCLEO)[number]>>,
): Record<string, unknown> {
  const porChave: Record<string, unknown> = {}
  for (const p of participantes) {
    for (const coluna of COLUNAS_DO_NUCLEO) {
      const valor = p[coluna]
      if (valor !== null && valor !== undefined && valor !== "") {
        porChave[`p${p.ordem}.${coluna}`] = valor
      }
    }
  }
  return porChave
}

export function chaveDeResposta(passo: Passo): string {
  return passo.chave
}

export function proximoIndice(passos: Passo[], indice: number): number {
  return Math.min(indice + 1, passos.length - 1)
}

function vazio(valor: unknown): boolean {
  if (valor === undefined || valor === null) return true
  if (Array.isArray(valor)) return valor.length === 0
  return String(valor).trim() === ''
}

export function podeAvancar(
  passo: Passo,
  valor: unknown,
): { ok: true } | { ok: false; erro: string } {
  if (passo.pergunta) {
    const p: Pergunta = passo.pergunta
    if (vazio(valor)) {
      return p.obrigatoria ? { ok: false, erro: 'Essa resposta é obrigatória.' } : { ok: true }
    }
    const r = validarResposta(p, valor)
    return r.ok ? { ok: true } : { ok: false, erro: r.erro }
  }

  // Passos fixos não passam por aqui. Os compostos — confirmação do titular,
  // dados do acompanhante e buffet — têm validação própria em
  // `validarComposto`, que valida os campos juntos porque a linha em
  // `participantes` só nasce com nome e email ao mesmo tempo. Abertura e
  // revisão são conduzidas pela própria tela.
  return { ok: true }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClienteSupabase = any

/**
 * Resolve o token e monta o estado da conversa.
 *
 * Roda com `service_role` porque a RLS não abre nada para o público — e
 * **por isso** toda consulta abaixo é presa ao `inscricao_id` que o token
 * resolveu. Nenhum id vem do cliente.
 */
export async function carregarPorToken(
  cliente: ClienteSupabase,
  token: string,
): Promise<EstadoConversa | null> {
  const { data: inscricao } = await cliente
    .from('inscricoes')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!inscricao) return null

  const [{ data: perguntas }, { data: participantes }, { data: respostas }] = await Promise.all([
    cliente
      .from('perguntas')
      .select('*')
      .eq('evento_id', inscricao.evento_id)
      .eq('ativa', true)
      .order('ordem'),
    cliente.from('participantes').select('*').eq('inscricao_id', inscricao.id).order('ordem'),
    cliente.from('respostas').select('*').eq('inscricao_id', inscricao.id),
  ])

  const passos = expandirRoteiro((perguntas ?? []) as Pergunta[], inscricao.vagas)

  // O marcador pode apontar para um passo que não existe mais, se uma
  // pergunta foi removida entre a interrupção e a volta. `indiceDoPasso`
  // devolve zero nesse caso, em vez de travar.
  const indice = inscricao.passo_atual ? indiceDoPasso(passos, inscricao.passo_atual) : 0

  const porChave: Record<string, unknown> = respostasDoNucleo(
    (participantes ?? []) as Participante[],
  )
  for (const r of (respostas ?? []) as Array<{
    pergunta_id: string
    participante_id: string | null
    valor: unknown
  }>) {
    const passo = passos.find((p) => {
      if (p.pergunta?.id !== r.pergunta_id) return false
      if (r.participante_id === null) return p.alvo.tipo === 'inscricao'
      const dono = (participantes ?? []).find((x: Participante) => x.id === r.participante_id)
      return p.alvo.tipo === 'participante' && dono?.ordem === p.alvo.ordem
    })
    if (passo) porChave[passo.chave] = r.valor
  }

  return {
    inscricao: inscricao as Inscricao,
    passos,
    indice,
    respostas: porChave,
    participantes: (participantes ?? []) as Participante[],
    concluida: inscricao.status_checkin === 'concluido',
  }
}
