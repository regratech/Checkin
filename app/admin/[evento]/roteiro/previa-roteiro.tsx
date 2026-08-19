import type { Passo } from '@/lib/roteiro'

const TEXTO_FIXO: Record<string, string> = {
  abertura: 'Oi! Você garantiu N vagas. Vou precisar dos dados de cada pessoa.',
  confirmar_titular: 'Começando por você. Confere se está certo? (dados vindos da compra)',
  nome: 'Qual o nome completo?',
  email: 'Qual o email?',
  telefone: 'Qual o telefone?',
  data_nascimento: 'Qual a data de aniversário?',
  nome_cracha: 'Como quer o nome no crachá?',
  buffet: 'Agora sobre o buffet: nome, cidade e Instagram.',
  revisao: 'Pronto! Confere tudo antes de fechar.',
}

function titulo(passo: Passo): string | null {
  if (passo.alvo.tipo !== 'participante') return null
  return `Pessoa ${passo.alvo.ordem}${passo.titular ? ' (titular)' : ''}`
}

export function PreviaRoteiro({ passos, vagas }: { passos: Passo[]; vagas: number }) {
  // Derivado antes de renderizar, nunca mutado durante. Alterar uma
  // variável no meio do `map` é o padrão que o compilador do React recusa:
  // numa re-renderização o valor sobreviveria e o agrupamento sairia errado.
  const titulos = passos.map(titulo)
  const abreBloco = titulos.map((t, i) => t !== null && t !== titulos[i - 1])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        Para uma compra de {vagas} {vagas === 1 ? 'vaga' : 'vagas'}, a conversa tem{' '}
        <strong>{passos.length} passos</strong>.
      </p>

      <ol className="flex flex-col gap-1">
        {passos.map((passo, i) => (
          <li key={passo.chave}>
            {abreBloco[i] ? (
              <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {titulos[i]}
              </p>
            ) : null}

            <div className="flex gap-3 rounded border px-3 py-2 text-sm">
              <span className="tabular-nums text-neutral-400">{i + 1}</span>
              <span className="flex-1">
                {passo.pergunta ? passo.pergunta.texto_chat : TEXTO_FIXO[passo.fixo ?? '']}
              </span>
              {passo.pergunta ? (
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                  {passo.pergunta.chave}
                </code>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
