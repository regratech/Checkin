import { chaveIdentidade } from '@/lib/identidade'
import type { Inscricao, Participante } from '@/lib/supabase/tipos'

export interface EntradaParticipante {
  nome: string
  email: string
  telefone?: string
  data_nascimento?: string
  nome_cracha?: string
  cargo?: string
}

export interface NovaInscricao {
  evento_id: string
  vagas: number
  empresa_nome?: string
  empresa_cidade?: string
  empresa_instagram?: string
  participantes: EntradaParticipante[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClienteSupabase = any

/**
 * O token e a unica credencial do link de check-in: quem tem o link entra.
 * 32 bytes de `crypto.getRandomValues` em base64url dao 43 caracteres
 * imprevisiveis, seguros dentro de uma URL.
 */
export function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function resolverPessoa(
  cliente: ClienteSupabase,
  email: string,
  nome: string,
): Promise<string> {
  const chave = chaveIdentidade(email, nome)

  const { data: achada } = await cliente
    .from('pessoas')
    .select('id')
    .eq('email', chave.email)
    .eq('nome_chave', chave.nome_chave)
    .maybeSingle()

  if (achada) return achada.id

  const { data: criada, error } = await cliente
    .from('pessoas')
    .insert({ ...chave, nome_recente: nome.trim() })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return criada.id
}

export async function criarInscricaoManual(
  cliente: ClienteSupabase,
  entrada: NovaInscricao,
): Promise<{ inscricao: Inscricao; participantes: Participante[] }> {
  if (entrada.participantes.length === 0) {
    throw new Error('A inscricao precisa de ao menos um participante.')
  }
  if (entrada.participantes.length > entrada.vagas) {
    throw new Error(
      `A inscricao tem ${entrada.vagas} vagas e recebeu ${entrada.participantes.length} participantes.`,
    )
  }

  const { data: codigo, error: erroCodigo } = await cliente.rpc(
    'gerar_codigo_inscricao',
    { p_evento_id: entrada.evento_id },
  )
  if (erroCodigo) throw new Error(erroCodigo.message)

  const pessoaIds: string[] = []
  for (const p of entrada.participantes) {
    pessoaIds.push(await resolverPessoa(cliente, p.email, p.nome))
  }

  // Ninguem se leva a si proprio como acompanhante. O banco tambem recusa
  // (migration 006), mas a mensagem crua do Postgres — "duplicate key value
  // violates unique constraint" — nao diz QUEM esta repetido.
  const vistos = new Map<string, string>()
  for (const [i, id] of pessoaIds.entries()) {
    const anterior = vistos.get(id)
    if (anterior) {
      throw new Error(
        `${anterior} foi cadastrado duas vezes nesta inscrição. ` +
          'Se são pessoas diferentes, confira o nome e o email de cada uma.',
      )
    }
    vistos.set(id, entrada.participantes[i].nome.trim())
  }

  const { data: inscricao, error: erroInscricao } = await cliente
    .from('inscricoes')
    .insert({
      evento_id: entrada.evento_id,
      codigo,
      origem: 'manual',
      vagas: entrada.vagas,
      empresa_nome: entrada.empresa_nome ?? null,
      empresa_cidade: entrada.empresa_cidade ?? null,
      empresa_instagram: entrada.empresa_instagram ?? null,
      token: gerarToken(),
      pessoa_titular_id: pessoaIds[0],
    })
    .select()
    .single()
  if (erroInscricao) throw new Error(erroInscricao.message)

  const linhas = entrada.participantes.map((p, i) => ({
    inscricao_id: inscricao.id,
    pessoa_id: pessoaIds[i],
    ordem: i + 1,
    titular: i === 0,
    nome: p.nome.trim(),
    email: p.email.trim().toLowerCase(),
    telefone: p.telefone ?? null,
    data_nascimento: p.data_nascimento ?? null,
    nome_cracha: p.nome_cracha ?? null,
    cargo: p.cargo ?? null,
  }))

  const { data: participantes, error: erroParticipantes } = await cliente
    .from('participantes')
    .insert(linhas)
    .select()
  if (erroParticipantes) throw new Error(erroParticipantes.message)

  return { inscricao, participantes }
}
