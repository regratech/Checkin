'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor, criarClienteAdmin } from '@/lib/supabase/servidor'
import { promover } from '@/lib/promocao'

export async function acaoReprocessar(form: FormData) {
  const slug = String(form.get('evento_slug') ?? '')
  const id = String(form.get('id') ?? '')

  // A leitura passa pela sessão do admin, respeitando a RLS.
  const supabase = await criarClienteServidor()
  const { data: evento } = await supabase
    .from('eventos')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (!evento) return

  // Presa ao evento: sem isto, um id de outro evento reprocessaria dado
  // alheio.
  const { data: sincronizacao } = await supabase
    .from('sincronizacoes')
    .select('id, payload')
    .eq('id', id)
    .eq('evento_id', evento.id)
    .maybeSingle()
  if (!sincronizacao) return

  // A gravação usa service_role, como o webhook — o mesmo caminho, para os
  // dois não divergirem.
  await promover(criarClienteAdmin(), evento.id, sincronizacao.id, sincronizacao.payload)

  revalidatePath(`/admin/${slug}/integracao`)
}
