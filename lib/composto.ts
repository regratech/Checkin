import { validarPorTipo } from '@/lib/validacao'
import type { Passo } from '@/lib/roteiro'
import type { TipoPergunta } from '@/lib/supabase/tipos'

/**
 * Dois passos do roteiro não são uma pergunta só: eles pedem vários campos
 * de uma vez. A confirmação do titular mostra o que veio da compra, e o
 * bloco do buffet pede nome, cidade e Instagram juntos.
 *
 * Sem isto a conversa trava — foi o que aconteceu na primeira verificação
 * no navegador: a pergunta aparecia e não havia como responder.
 */
export type ChaveComposta = 'confirmar_titular' | 'dados_participante' | 'buffet'

export interface CampoComposto {
  nome: string
  rotulo: string
  tipo: TipoPergunta
  obrigatorio: boolean
}

export const CAMPOS_COMPOSTOS: Record<ChaveComposta, CampoComposto[]> = {
  confirmar_titular: [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto_curto', obrigatorio: true },
    { nome: 'email', rotulo: 'Email', tipo: 'email', obrigatorio: true },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'telefone', obrigatorio: false },
    { nome: 'data_nascimento', rotulo: 'Aniversário', tipo: 'data', obrigatorio: false },
    { nome: 'nome_cracha', rotulo: 'Nome no crachá', tipo: 'texto_curto', obrigatorio: false },
  ],
  dados_participante: [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto_curto', obrigatorio: true },
    { nome: 'email', rotulo: 'Email', tipo: 'email', obrigatorio: true },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'telefone', obrigatorio: false },
    { nome: 'data_nascimento', rotulo: 'Aniversário', tipo: 'data', obrigatorio: false },
    { nome: 'nome_cracha', rotulo: 'Nome no crachá', tipo: 'texto_curto', obrigatorio: false },
  ],
  buffet: [
    { nome: 'empresa_nome', rotulo: 'Nome do buffet', tipo: 'texto_curto', obrigatorio: false },
    { nome: 'empresa_cidade', rotulo: 'Cidade', tipo: 'texto_curto', obrigatorio: false },
    {
      nome: 'empresa_instagram',
      rotulo: 'Instagram',
      tipo: 'texto_curto',
      obrigatorio: false,
    },
  ],
}

export function ehPassoComposto(passo: Passo): boolean {
  return (
    passo.fixo === 'confirmar_titular' ||
    passo.fixo === 'dados_participante' ||
    passo.fixo === 'buffet'
  )
}

export type ValidadoComposto =
  | { ok: true; valores: Record<string, unknown> }
  | { ok: false; erro: string }

export function validarComposto(
  chave: ChaveComposta,
  bruto: Record<string, unknown>,
): ValidadoComposto {
  const valores: Record<string, unknown> = {}

  for (const campo of CAMPOS_COMPOSTOS[chave]) {
    const cru = String(bruto[campo.nome] ?? '').trim()

    if (!cru) {
      if (campo.obrigatorio) {
        return { ok: false, erro: `Falta preencher: ${campo.rotulo}.` }
      }
      // Vazio vira nulo, não string vazia: a coluna aceita nulo e uma
      // string vazia mentiria dizendo que a pessoa respondeu.
      valores[campo.nome] = null
      continue
    }

    const r = validarPorTipo(campo.tipo, cru)
    if (!r.ok) return { ok: false, erro: `${campo.rotulo}: ${r.erro}` }
    valores[campo.nome] = r.valor
  }

  return { ok: true, valores }
}
