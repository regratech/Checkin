import { timingSafeEqual } from 'node:crypto'
import { type NextRequest } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/servidor'
import { chaveDeIdempotencia } from '@/lib/guru'
import { promover } from '@/lib/promocao'

/**
 * Comparação em tempo constante. Com `===`, o tempo de resposta cresce
 * conforme o prefixo acerta, e o segredo pode ser adivinhado caractere a
 * caractere.
 */
function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/guru/[evento]'>) {
  const { evento: slug } = await ctx.params
  const cliente = criarClienteAdmin()

  const { data: evento } = await cliente
    .from('eventos')
    .select('id, webhook_segredo')
    .eq('slug', slug)
    .maybeSingle()

  // Mesma resposta para evento inexistente e segredo errado: dizer qual dos
  // dois falhou entrega a lista de eventos a quem estiver sondando.
  const segredo = request.headers.get('x-checkin-segredo') ?? ''
  if (!evento || !segredoConfere(segredo, evento.webhook_segredo)) {
    return Response.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ erro: 'Corpo não é JSON válido.' }, { status: 400 })
  }

  const chave =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? chaveDeIdempotencia(payload as Record<string, unknown>)
      : null

  // Grava antes de interpretar. Se a leitura falhar, o payload continua no
  // banco e o admin reprocessa depois de corrigir — interpretar primeiro
  // perderia o dado justamente no caso em que ele é mais necessário.
  const { data: sincronizacao, error } = await cliente
    .from('sincronizacoes')
    .insert({ evento_id: evento.id, origem: 'webhook', payload, chave })
    .select()
    .single()

  if (error) {
    // `unique (evento_id, chave)` recusando é a idempotência funcionando:
    // esta compra já entrou.
    if (/duplicate key|23505/i.test(error.message)) {
      return Response.json({ estado: 'repetida' }, { status: 409 })
    }
    return Response.json({ erro: 'Não foi possível guardar.' }, { status: 500 })
  }

  const resultado = await promover(cliente, evento.id, sincronizacao.id, payload)

  // Sempre 200 quando o payload foi guardado, mesmo com falha na promoção.
  // Devolver erro faria o n8n reenviar em laço; o problema se resolve na
  // tela de integração, não por retentativa.
  return Response.json({ estado: resultado.estado, guardado: true }, { status: 200 })
}
