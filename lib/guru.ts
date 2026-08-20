import { normalizarTelefone } from '@/lib/validacao'

export interface CompraGuru {
  nome: string
  email: string
  telefone: string | null
  documento: string | null
  vagas: number
  aprovada: boolean
  produto: string | null
  criadoEm: string | null
  chave: string
}

type Payload = Record<string, unknown>

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : valor == null ? '' : String(valor).trim()
}

/**
 * Nunca foi possível inspecionar o payload completo no n8n — o nó do
 * webhook estava com dado fixado. Por isso a chave é auto-descoberta:
 * procura um identificador conhecido e, se não achar, deriva de campos que
 * sabidamente existem. Funciona hoje, e passa a usar o identificador
 * sozinho no dia em que ele aparecer.
 */
const CAMPOS_DE_ID = ['id', 'transaction_id', 'subscription_code', 'order_id', 'code']

export function chaveDeIdempotencia(payload: Payload): string {
  for (const campo of CAMPOS_DE_ID) {
    const valor = texto(payload[campo])
    if (valor) return valor
  }

  // Documento + email + instante da criação. Colidir exigiria a mesma
  // pessoa comprando duas vezes no mesmo segundo.
  return [texto(payload.doc), texto(payload.email), texto(payload.created_at)].join('|')
}

const LIMITE_DE_VAGAS = 20

export function vagasDoPayload(payload: Payload): number {
  const bruto = Number(texto(payload.quantity))
  if (Number.isInteger(bruto) && bruto >= 1 && bruto <= LIMITE_DE_VAGAS) return bruto

  // Conferência, não fonte: o nome do produto repete a informação.
  // "[PRÉ-VENDA - 3 INSCRIÇÕES]" ou "[PRÉ-VENDA - 1 INSCRIÇÃO]".
  const doTexto = texto(payload.product).match(/(\d+)\s*INSCRI[ÇC]/i)
  if (doTexto) {
    const n = Number(doTexto[1])
    if (n >= 1 && n <= LIMITE_DE_VAGAS) return n
  }

  // Uma vaga quando não dá para saber. Zero geraria uma inscrição sem
  // participante nenhum, que o banco recusa e a conversa não conduz.
  return 1
}

const STATUS_APROVADO = ['a', 'approved', 'aprovado', 'paid', 'pago']

export function lerCompra(
  bruto: unknown,
): { ok: true; compra: CompraGuru } | { ok: false; erro: string } {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    return { ok: false, erro: 'O corpo da requisição não é um objeto.' }
  }

  const payload = bruto as Payload

  const nome = texto(payload.name)
  if (!nome) return { ok: false, erro: 'Compra sem nome do comprador.' }

  const email = texto(payload.email).toLowerCase()
  if (!email) return { ok: false, erro: 'Compra sem email — é a chave da pessoa.' }

  return {
    ok: true,
    compra: {
      nome,
      email,
      telefone: normalizarTelefone(texto(payload.phone)),
      documento: texto(payload.doc) || null,
      vagas: vagasDoPayload(payload),
      aprovada: STATUS_APROVADO.includes(texto(payload.status).toLowerCase()),
      produto: texto(payload.product) || null,
      criadoEm: texto(payload.created_at) || null,
      chave: chaveDeIdempotencia(payload),
    },
  }
}
