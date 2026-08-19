import { z } from 'zod'
import { semAcento } from '@/lib/identidade'
import { opcoesDeTexto, precisaDeOpcoes } from '@/lib/opcoes'
import { ESCOPOS_PERGUNTA, TIPOS_PERGUNTA, type Pergunta } from '@/lib/supabase/tipos'

const LIMITE_CHAVE = 60

/**
 * A chave nasce do rótulo e **nunca muda depois**. É ela que aparece no CSV
 * e em qualquer integração futura; renomeá-la quebraria histórico em
 * silêncio. O rótulo, esse sim, pode ser reescrito quando quiser.
 */
export function chaveDePergunta(rotulo: string, existentes: string[]): string {
  const base =
    semAcento(rotulo)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, LIMITE_CHAVE) || 'pergunta'

  if (!existentes.includes(base)) return base

  // `unique (evento_id, chave)` recusaria a segunda; resolver aqui é melhor
  // do que devolver erro de banco a quem está cadastrando.
  let n = 2
  while (existentes.includes(`${base}_${n}`)) n++
  return `${base}_${n}`.slice(0, LIMITE_CHAVE)
}

export const esquemaPergunta = z
  .object({
    rotulo: z.string().trim().min(2, { message: 'Informe o nome da coluna' }),
    texto_chat: z.string().trim().min(3, { message: 'Escreva a pergunta que a Lara faz' }),
    tipo: z.enum(TIPOS_PERGUNTA),
    escopo: z.enum(ESCOPOS_PERGUNTA),
    // `.optional()` é obrigatório aqui: checkbox desmarcado não vem no
    // FormData, e um union com `z.undefined()` NÃO torna a chave opcional
    // no Zod 4 — a validação falharia em toda pergunta não obrigatória.
    obrigatoria: z
      .union([z.literal('on'), z.literal('true')])
      .optional()
      .transform((v) => v !== undefined),
    opcoes: z.string().optional().default(''),
    ajuda: z.string().trim().optional().default(''),
  })
  .refine((d) => !precisaDeOpcoes(d.tipo) || opcoesDeTexto(d.opcoes).length >= 2, {
    message: 'Perguntas de seleção precisam de pelo menos duas opções, uma por linha',
    path: ['opcoes'],
  })

export type EntradaPergunta = z.infer<typeof esquemaPergunta>

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClienteSupabase = any

const COLUNAS =
  'id, evento_id, chave, rotulo, texto_chat, tipo, escopo, obrigatoria, ordem, opcoes, ajuda, ativa'

export async function listarPerguntas(
  cliente: ClienteSupabase,
  eventoId: string,
): Promise<Pergunta[]> {
  const { data, error } = await cliente
    .from('perguntas')
    .select(COLUNAS)
    .eq('evento_id', eventoId)
    .order('ordem')

  if (error) throw new Error(error.message)
  return (data ?? []) as Pergunta[]
}

export async function criarPergunta(
  cliente: ClienteSupabase,
  eventoId: string,
  entrada: EntradaPergunta,
): Promise<Pergunta> {
  const existentes = await listarPerguntas(cliente, eventoId)

  const { data, error } = await cliente
    .from('perguntas')
    .insert({
      evento_id: eventoId,
      chave: chaveDePergunta(
        entrada.rotulo,
        existentes.map((p) => p.chave),
      ),
      rotulo: entrada.rotulo,
      texto_chat: entrada.texto_chat,
      tipo: entrada.tipo,
      escopo: entrada.escopo,
      obrigatoria: entrada.obrigatoria,
      ordem: existentes.length + 1,
      opcoes: precisaDeOpcoes(entrada.tipo) ? opcoesDeTexto(entrada.opcoes) : null,
      ajuda: entrada.ajuda || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Pergunta
}

/**
 * `chave` e `escopo` ficam de fora de propósito. A chave amarra o histórico;
 * o escopo é parte da FK composta que valida as respostas já gravadas.
 */
export async function atualizarPergunta(
  cliente: ClienteSupabase,
  id: string,
  entrada: EntradaPergunta,
): Promise<void> {
  const { error } = await cliente
    .from('perguntas')
    .update({
      rotulo: entrada.rotulo,
      texto_chat: entrada.texto_chat,
      tipo: entrada.tipo,
      obrigatoria: entrada.obrigatoria,
      opcoes: precisaDeOpcoes(entrada.tipo) ? opcoesDeTexto(entrada.opcoes) : null,
      ajuda: entrada.ajuda || null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function moverPergunta(
  cliente: ClienteSupabase,
  eventoId: string,
  id: string,
  direcao: 'cima' | 'baixo',
): Promise<void> {
  const { data, error } = await cliente
    .from('perguntas')
    .select('id, ordem')
    .eq('evento_id', eventoId)
    .order('ordem')

  if (error) throw new Error(error.message)

  const lista = (data ?? []) as Array<{ id: string; ordem: number }>
  const posicao = lista.findIndex((p) => p.id === id)
  if (posicao < 0) return

  const vizinho = direcao === 'cima' ? posicao - 1 : posicao + 1
  if (vizinho < 0 || vizinho >= lista.length) return

  // Trocar duas linhas em vez de reescrever a lista inteira a cada clique.
  const atual = lista[posicao]
  const outro = lista[vizinho]

  await cliente.from('perguntas').update({ ordem: outro.ordem }).eq('id', atual.id)
  await cliente.from('perguntas').update({ ordem: atual.ordem }).eq('id', outro.id)
}

export async function alternarAtiva(
  cliente: ClienteSupabase,
  id: string,
  ativa: boolean,
): Promise<void> {
  const { error } = await cliente.from('perguntas').update({ ativa }).eq('id', id)
  if (error) throw new Error(error.message)
}
