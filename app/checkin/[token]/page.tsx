import { criarClienteAdmin } from '@/lib/supabase/servidor'
import { carregarPorToken } from '@/lib/checkin'
import { Conversa } from './conversa'

export const metadata = { title: 'Check-in · Regra 3' }

export default async function PaginaCheckin({ params }: PageProps<'/checkin/[token]'>) {
  const { token } = await params
  const estado = await carregarPorToken(criarClienteAdmin(), token)

  if (!estado) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Link não encontrado</h1>
        <p className="text-neutral-600">
          Confira se copiou o endereço inteiro. Se o problema continuar, responda o email da sua
          inscrição que a gente resolve.
        </p>
      </main>
    )
  }

  const { inscricao } = estado
  const titular = estado.participantes.find((p) => p.titular)
  const primeiroNome = (titular?.nome ?? inscricao.nome_compra ?? '').split(' ')[0]

  // O titular é o único passo com dado pré-existente: o que veio da compra.
  // A linha do participante ganha prioridade porque pode já ter sido
  // corrigida numa sessão anterior.
  const chaveDaConfirmacao = estado.passos.find((p) => p.fixo === 'confirmar_titular')?.chave
  const chaveDoBuffet = estado.passos.find((p) => p.fixo === 'buffet')?.chave

  const valoresCompostos: Record<string, Record<string, string>> = {}

  if (chaveDaConfirmacao) {
    valoresCompostos[chaveDaConfirmacao] = {
      nome: titular?.nome ?? inscricao.nome_compra ?? '',
      email: titular?.email ?? inscricao.email_compra ?? '',
      telefone: titular?.telefone ?? inscricao.telefone_compra ?? '',
      data_nascimento: titular?.data_nascimento ?? '',
      nome_cracha: titular?.nome_cracha ?? '',
    }
  }

  if (chaveDoBuffet) {
    valoresCompostos[chaveDoBuffet] = {
      empresa_nome: inscricao.empresa_nome ?? '',
      empresa_cidade: inscricao.empresa_cidade ?? '',
      empresa_instagram: inscricao.empresa_instagram ?? '',
    }
  }

  // Os acompanhantes também: sem isto a revisão final mostrava tudo "em
  // branco" para eles, mesmo com a linha já gravada.
  for (const passo of estado.passos) {
    const alvo = passo.alvo
    if (passo.fixo !== 'dados_participante' || alvo.tipo !== 'participante') continue
    const p = estado.participantes.find((x) => x.ordem === alvo.ordem)
    valoresCompostos[passo.chave] = {
      nome: p?.nome ?? '',
      email: p?.email ?? '',
      telefone: p?.telefone ?? '',
      data_nascimento: p?.data_nascimento ?? '',
      nome_cracha: p?.nome_cracha ?? '',
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg p-6">
      <Conversa
        token={token}
        estado={{
          passos: estado.passos,
          indice: estado.indice,
          respostas: estado.respostas,
          nomeTitular: primeiroNome || 'tudo bem',
          vagas: inscricao.vagas,
          concluida: estado.concluida,
          valoresCompostos,
        }}
      />
    </main>
  )
}
