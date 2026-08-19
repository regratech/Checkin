import { semAcento } from '@/lib/identidade'
import type { TipoPergunta } from '@/lib/supabase/tipos'

export interface Opcao {
  chave: string
  rotulo: string
  /**
   * O mesmo item dito na terceira pessoa, para quando a pergunta é feita
   * sobre um acompanhante. Ausente quando o texto serve para os dois.
   */
  rotulo_acompanhante?: string
}

function ehOpcao(valor: unknown): valor is Opcao {
  if (typeof valor !== 'object' || valor === null) return false
  const o = valor as Record<string, unknown>
  return typeof o.chave === 'string' && typeof o.rotulo === 'string'
}

/** `opcoes` é jsonb e pode vir nulo ou torto. Nunca derruba a tela. */
export function lerOpcoes(bruto: unknown): Opcao[] {
  if (!Array.isArray(bruto)) return []
  return bruto.filter(ehOpcao).map((o) => ({
    chave: o.chave,
    rotulo: o.rotulo,
    ...(o.rotulo_acompanhante ? { rotulo_acompanhante: o.rotulo_acompanhante } : {}),
  }))
}

export function rotuloDaOpcao(opcao: Opcao, titular: boolean): string {
  if (titular) return opcao.rotulo
  return opcao.rotulo_acompanhante ?? opcao.rotulo
}

function chaveDeTexto(texto: string): string {
  return (
    semAcento(texto)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'opcao'
  )
}

/**
 * O editor recebe as opções como texto, uma por linha. A barra vertical
 * separa a voz do titular da voz do acompanhante:
 *
 *     Faço a comida | Faz a comida
 *     Só administro
 */
export function opcoesDeTexto(texto: string): Opcao[] {
  const usadas = new Map<string, number>()

  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)
    .map((linha) => {
      const [rotulo, acompanhante] = linha.split('|').map((p) => p.trim())

      // Duas opções com a mesma chave quebrariam a leitura da resposta.
      const base = chaveDeTexto(rotulo)
      const vezes = (usadas.get(base) ?? 0) + 1
      usadas.set(base, vezes)
      const chave = vezes === 1 ? base : `${base}_${vezes}`

      return {
        chave,
        rotulo,
        ...(acompanhante ? { rotulo_acompanhante: acompanhante } : {}),
      }
    })
}

export function textoDeOpcoes(opcoes: Opcao[]): string {
  return opcoes
    .map((o) => (o.rotulo_acompanhante ? `${o.rotulo} | ${o.rotulo_acompanhante}` : o.rotulo))
    .join('\n')
}

/**
 * Vive aqui, e não em `lib/perguntas.ts`, porque o formulário é um
 * componente de cliente: importar de `perguntas` arrastaria as funções de
 * acesso ao banco para dentro do pacote do navegador.
 */
export function precisaDeOpcoes(tipo: TipoPergunta): boolean {
  return tipo === 'selecao_unica' || tipo === 'selecao_multipla'
}
