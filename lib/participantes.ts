import { STATUS_CHECKIN, type StatusCheckin } from '@/lib/supabase/tipos'

export interface LinhaParticipante {
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
  evento_id: string
  codigo: string
  codigo_participante: string
  vagas: number
  pessoas_preenchidas: number
  empresa_nome: string | null
  empresa_cidade: string | null
  empresa_instagram: string | null
  status_checkin: StatusCheckin
}

export const GRUPOS = ['todos', '1', '2', '3', '4+'] as const
export type Grupo = (typeof GRUPOS)[number]

export interface Filtros {
  grupo: Grupo
  status: StatusCheckin | 'todos'
  busca: string
}

type ParametrosUrl = Record<string, string | string[] | undefined>

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ''
}

/**
 * A URL e digitavel por qualquer um: `?grupo=99` nao pode derrubar a pagina.
 * Valor desconhecido vira o padrao, em silencio.
 */
export function lerFiltros(sp: ParametrosUrl): Filtros {
  const grupo = primeiro(sp.grupo) as Grupo
  const status = primeiro(sp.status) as StatusCheckin

  return {
    grupo: GRUPOS.includes(grupo) ? grupo : 'todos',
    status: STATUS_CHECKIN.includes(status) ? status : 'todos',
    busca: primeiro(sp.busca).trim(),
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * O filtro e sempre sobre `vagas` — o que foi comprado —, nunca sobre
 * `pessoas_preenchidas`. A contagem de preenchidos muda durante o check-in
 * e faria a linha pular de aba enquanto o titular ainda digita.
 */
export function aplicarFiltroDeGrupo<T extends { eq: any; gte: any }>(
  consulta: T,
  grupo: Grupo,
): T {
  if (grupo === 'todos') return consulta
  // `4+` e `>= 4` para que lotes maiores, se o Guru passar a vende-los,
  // apareçam em algum lugar em vez de sumir.
  if (grupo === '4+') return consulta.gte('vagas', 4)
  return consulta.eq('vagas', Number(grupo))
}

export interface GrupoInscricao {
  codigo: string
  empresa_nome: string | null
  empresa_cidade: string | null
  vagas: number
  preenchidos: number
  completo: boolean
  participantes: LinhaParticipante[]
}

export function agruparPorInscricao(linhas: LinhaParticipante[]): GrupoInscricao[] {
  const porInscricao = new Map<string, LinhaParticipante[]>()

  for (const l of linhas) {
    const atual = porInscricao.get(l.inscricao_id)
    if (atual) atual.push(l)
    else porInscricao.set(l.inscricao_id, [l])
  }

  return [...porInscricao.values()]
    .map((participantes) => {
      const ordenados = [...participantes].sort((a, b) => a.ordem - b.ordem)
      const primeira = ordenados[0]
      return {
        codigo: primeira.codigo,
        empresa_nome: primeira.empresa_nome,
        empresa_cidade: primeira.empresa_cidade,
        vagas: primeira.vagas,
        preenchidos: primeira.pessoas_preenchidas,
        completo: primeira.pessoas_preenchidas >= primeira.vagas,
        participantes: ordenados,
      }
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
}
