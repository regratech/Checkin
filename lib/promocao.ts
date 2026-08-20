import { lerCompra } from '@/lib/guru'
import { gerarToken, resolverPessoa } from '@/lib/inscricoes'

export type ResultadoPromocao =
  | { estado: 'criada'; inscricaoId: string; codigo: string }
  | { estado: 'repetida'; inscricaoId: string }
  | { estado: 'aguardando' }
  | { estado: 'erro'; erro: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClienteSupabase = any

async function marcar(
  cliente: ClienteSupabase,
  sincronizacaoId: string,
  campos: Record<string, unknown>,
) {
  await cliente.from('sincronizacoes').update(campos).eq('id', sincronizacaoId)
}

export async function promover(
  cliente: ClienteSupabase,
  eventoId: string,
  sincronizacaoId: string,
  payload: unknown,
): Promise<ResultadoPromocao> {
  const leitura = lerCompra(payload)

  if (!leitura.ok) {
    await marcar(cliente, sincronizacaoId, { status: 'erro', erro: leitura.erro })
    return { estado: 'erro', erro: leitura.erro }
  }

  const { compra } = leitura

  // Só compra aprovada vira inscrição. As demais ficam guardadas: o Guru
  // costuma mandar a confirmação depois, e aí a mesma chave reaparece.
  if (!compra.aprovada) {
    await marcar(cliente, sincronizacaoId, { status: 'recebida', erro: null })
    return { estado: 'aguardando' }
  }

  // Idempotência: o webhook pode ser reenviado por falha de rede ou
  // retentativa do Guru. A chave já está no banco, então basta perguntar.
  const { data: existente } = await cliente
    .from('inscricoes')
    .select('id, codigo')
    .eq('evento_id', eventoId)
    .eq('guru_transacao_id', compra.chave)
    .maybeSingle()

  if (existente) {
    await marcar(cliente, sincronizacaoId, {
      status: 'promovida',
      erro: null,
      inscricao_id: existente.id,
    })
    return { estado: 'repetida', inscricaoId: existente.id }
  }

  try {
    const pessoaId = await resolverPessoa(cliente, compra.email, compra.nome)

    const { data: codigo, error: erroCodigo } = await cliente.rpc('gerar_codigo_inscricao', {
      p_evento_id: eventoId,
    })
    if (erroCodigo) throw new Error(erroCodigo.message)

    const { data: inscricao, error: erroInscricao } = await cliente
      .from('inscricoes')
      .insert({
        evento_id: eventoId,
        codigo,
        origem: 'webhook',
        guru_transacao_id: compra.chave,
        // O payload inteiro fica guardado: a primeira venda real é a única
        // chance de ver o formato completo, que o n8n não deixou inspecionar.
        guru_payload: payload,
        pessoa_titular_id: pessoaId,
        nome_compra: compra.nome,
        email_compra: compra.email,
        telefone_compra: compra.telefone,
        documento_compra: compra.documento,
        vagas: compra.vagas,
        token: gerarToken(),
      })
      .select()
      .single()
    if (erroInscricao) throw new Error(erroInscricao.message)

    // Só o titular. Os acompanhantes nascem na conversa, porque a linha
    // precisa de nome e email — que só o titular informa no check-in.
    const { error: erroParticipante } = await cliente.from('participantes').insert({
      inscricao_id: inscricao.id,
      pessoa_id: pessoaId,
      ordem: 1,
      titular: true,
      nome: compra.nome,
      email: compra.email,
      telefone: compra.telefone,
    })
    if (erroParticipante) throw new Error(erroParticipante.message)

    await marcar(cliente, sincronizacaoId, {
      status: 'promovida',
      erro: null,
      inscricao_id: inscricao.id,
    })

    return { estado: 'criada', inscricaoId: inscricao.id, codigo: inscricao.codigo }
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e)
    await marcar(cliente, sincronizacaoId, { status: 'erro', erro })
    return { estado: 'erro', erro }
  }
}
