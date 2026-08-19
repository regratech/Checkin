import { expandirRoteiro, indiceDoPasso, type CampoFixo, type Passo } from '@/lib/roteiro'
import { validarPorTipo, validarResposta } from '@/lib/validacao'
import type { Inscricao, Participante, Pergunta, TipoPergunta } from '@/lib/supabase/tipos'

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
}

export function chaveDeResposta(passo: Passo): string {
  return passo.chave
}

export function proximoIndice(passos: Passo[], indice: number): number {
  return Math.min(indice + 1, passos.length - 1)
}

/**
 * Como cada campo do núcleo é validado. Não é configurável: sem nome não
 * sai crachá, e um email torto quebra o contato depois.
 */
const NUCLEO: Partial<Record<CampoFixo, { tipo: TipoPergunta; obrigatorio: boolean }>> = {
  nome: { tipo: 'texto_curto', obrigatorio: true },
  email: { tipo: 'email', obrigatorio: true },
  // Telefone e aniversário faltaram em vários acompanhantes na planilha
  // real. Travar a conversa por isso faria o titular abandonar o check-in.
  telefone: { tipo: 'telefone', obrigatorio: false },
  data_nascimento: { tipo: 'data', obrigatorio: false },
  nome_cracha: { tipo: 'texto_curto', obrigatorio: false },
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

  const regra = passo.fixo ? NUCLEO[passo.fixo] : undefined
  // Passos sem regra — abertura, confirmação, buffet, revisão — não pedem
  // resposta; são conduzidos pela própria tela.
  if (!regra) return { ok: true }

  if (vazio(valor)) {
    return regra.obrigatorio ? { ok: false, erro: 'Esse campo é obrigatório.' } : { ok: true }
  }

  const r = validarPorTipo(regra.tipo, valor)
  return r.ok ? { ok: true } : { ok: false, erro: r.erro }
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

  const porChave: Record<string, unknown> = {}
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
