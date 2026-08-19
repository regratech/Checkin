export const PAPEIS = ['publico', 'admin'] as const
export const ORIGENS_INSCRICAO = ['webhook', 'api', 'csv', 'manual'] as const
export const STATUS_CHECKIN = ['pendente', 'em_andamento', 'concluido'] as const
export const ESCOPOS_PERGUNTA = ['inscricao', 'participante'] as const
export const TIPOS_PERGUNTA = [
  'texto_curto',
  'texto_longo',
  'email',
  'telefone',
  'numero',
  'data',
  'selecao_unica',
  'selecao_multipla',
  'nota_estrela',
  'sim_nao',
] as const
export const STATUS_SINCRONIZACAO = ['recebida', 'promovida', 'erro'] as const

export type Papel = (typeof PAPEIS)[number]
export type OrigemInscricao = (typeof ORIGENS_INSCRICAO)[number]
export type StatusCheckin = (typeof STATUS_CHECKIN)[number]
export type EscopoPergunta = (typeof ESCOPOS_PERGUNTA)[number]
export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number]
export type StatusSincronizacao = (typeof STATUS_SINCRONIZACAO)[number]

export interface Evento {
  id: string
  nome: string
  slug: string
  /** Prefixo do codigo legivel das inscricoes, ex.: `ENG26`. */
  prefixo_codigo: string
  data: string | null
  local: string | null
  ativo: boolean
}

export interface Pessoa {
  id: string
  email: string
  /** Nome normalizado. Junto com o email forma a chave de identidade. */
  nome_chave: string
  /** Ultimo nome visto. Serve para busca, nao e fonte de verdade. */
  nome_recente: string
}

export interface Inscricao {
  id: string
  evento_id: string
  /** Codigo legivel, ex.: `ENG26-0042`. Unico dentro do evento. */
  codigo: string
  pessoa_titular_id: string | null
  origem: OrigemInscricao
  guru_transacao_id: string | null
  email_compra: string | null
  nome_compra: string | null
  telefone_compra: string | null
  vagas: number
  empresa_nome: string | null
  empresa_cidade: string | null
  empresa_instagram: string | null
  token: string
  status_checkin: StatusCheckin
  passo_atual: string | null
  concluido_em: string | null
}

export interface Participante {
  id: string
  inscricao_id: string
  pessoa_id: string
  ordem: number
  titular: boolean
  nome: string
  email: string | null
  telefone: string | null
  data_nascimento: string | null
  nome_cracha: string | null
  cargo: string | null
}

export interface Pergunta {
  id: string
  evento_id: string
  chave: string
  rotulo: string
  texto_chat: string
  tipo: TipoPergunta
  escopo: EscopoPergunta
  obrigatoria: boolean
  ordem: number
  opcoes: unknown
  ajuda: string | null
  ativa: boolean
}

export interface Resposta {
  id: string
  pergunta_id: string
  escopo: EscopoPergunta
  inscricao_id: string
  participante_id: string | null
  valor: unknown
}
