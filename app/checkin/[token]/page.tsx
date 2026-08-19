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

  const titular = estado.participantes.find((p) => p.titular)
  const primeiroNome = (titular?.nome ?? estado.inscricao.nome_compra ?? '').split(' ')[0]

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg p-6">
      <Conversa
        token={token}
        estado={{
          passos: estado.passos,
          indice: estado.indice,
          respostas: estado.respostas,
          nomeTitular: primeiroNome || 'tudo bem',
          vagas: estado.inscricao.vagas,
          concluida: estado.concluida,
        }}
      />
    </main>
  )
}
