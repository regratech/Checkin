# Check-in R3 — Fatia C1 (O roteiro) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin monta o questionário de um evento — criar, editar, reordenar e desativar perguntas — e vê a prévia exata do roteiro que a Lara vai seguir para uma compra de N vagas.

**Architecture:** O motor de roteiro é uma função pura: recebe as perguntas ativas e o número de vagas, devolve a lista linear de passos. É ele que substitui os quatro ramos copiados do Typebot. O editor é CRUD comum sobre `perguntas`, com uma regra dura: a `chave` nasce do rótulo e **nunca muda**, porque é ela que amarra as respostas já gravadas e as colunas do CSV.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript strict, Tailwind 4, zod 4, `@supabase/ssr`, vitest 4 com jsdom e testing-library.

## Global Constraints

- **Diretório:** `C:\Users\regra\Downloads\Checkin R3`, branch `main`, remoto `github.com/regratech/Checkin`.
- **Spec:** `docs/superpowers/specs/2026-08-18-checkin-r3-design.md`, seções 3.2 (`perguntas`) e 4 (motor de roteiro).
- **Fatias A, B1 e B2 entregues.** Existem as 8 tabelas com RLS, `vw_participantes`, autenticação, moldura do admin, criar evento, inscrição manual, tabela de participantes com abas, CSV e recuperação de senha. Migrations `001` a `006`.
- **Idioma:** nomes de arquivo, função, variável, rota e teste em **português**.
- **Estilo TypeScript:** sem ponto e vírgula, aspas simples, `import type` quando for só tipo.
- **`chave` é imutável.** Ela nasce do rótulo na criação e nunca é reescrita. As respostas já gravadas apontam para a pergunta pelo `id`, mas o CSV e qualquer integração futura usam a `chave` — renomeá-la quebra histórico em silêncio. O rótulo, esse sim, pode mudar quando quiser.
- **`escopo` não pode ser editado depois que existe resposta.** Trocar de `inscricao` para `participante` invalidaria as respostas gravadas, que o banco amarra por FK composta `(pergunta_id, escopo)`.
- **O dev server precisa de `NODE_EXTRA_CA_CERTS`** apontando para o certificado do Avast; sem ele toda chamada ao Supabase falha com `fetch failed` status 0. Já está em `.claude/launch.json`. Porta **3100**.
- **Código de cliente lê variáveis públicas por `lerConfigPublica()`**, nunca `lerConfigSupabase(process.env)` — o Next só substitui `process.env.NEXT_PUBLIC_X` quando a leitura é literal. Já derrubou a tela `/nova-senha`.
- **Depois de mudar código que o navegador executa, limpe o `.next` antes de concluir que a correção falhou.** O cache do Turbopack já serviu pacote velho e custou uma investigação inteira.
- **Testes que leem o fonte como texto** devem remover comentários e delimitar o trecho examinado. Três asserções desta suíte já reprovaram código correto por não fazer isso.
- **Verificação:** `npm test`, `npm run typecheck` e `npm run lint` ao fim de cada tarefa.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/opcoes.ts` | Esquema das opções de seleção, com rótulo por voz (titular / acompanhante) |
| `lib/roteiro.ts` | Expansão do roteiro: perguntas + vagas → passos |
| `lib/perguntas.ts` | Chave estável, validação de entrada, acesso ao banco |
| `app/admin/[evento]/roteiro/page.tsx` | Lista das perguntas + prévia |
| `app/admin/[evento]/roteiro/acoes.ts` | Server Actions: criar, editar, mover, ativar |
| `app/admin/[evento]/roteiro/formulario-pergunta.tsx` | Criar e editar |
| `app/admin/[evento]/roteiro/lista-perguntas.tsx` | Tabela com mover e ativar |
| `app/admin/[evento]/roteiro/previa-roteiro.tsx` | Os passos gerados, para N vagas |

---

### Task 1: Opções de seleção

**Files:**
- Create: `lib/opcoes.ts`
- Test: `lib/opcoes.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `interface Opcao { chave: string; rotulo: string; rotulo_acompanhante?: string }`
  - `lerOpcoes(bruto: unknown): Opcao[]`
  - `rotuloDaOpcao(opcao: Opcao, titular: boolean): string`
  - `opcoesDeTexto(texto: string): Opcao[]`
  - `textoDeOpcoes(opcoes: Opcao[]): string`
  - `precisaDeOpcoes(tipo: TipoPergunta): boolean`

O caso que motiva `rotulo_acompanhante` é real. No último evento a mesma função virou dois textos porque o roteiro pergunta em voz diferente para o titular e para o acompanhante:

```
"Eu que planejo, organizo, coordeno e faço a comida."   (titular)
"Planeja, organiza, coordena e faz a comida."           (acompanhante)
```

Quatro papéis viraram oito valores distintos na planilha, e agrupar por cargo ficou impossível. Uma opção passa a ter **uma chave** e até **dois textos**.

- [ ] **Step 1: Escrever os testes**

Criar `lib/opcoes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  lerOpcoes,
  rotuloDaOpcao,
  opcoesDeTexto,
  textoDeOpcoes,
  precisaDeOpcoes,
} from './opcoes'

describe('lerOpcoes', () => {
  it('le a forma completa', () => {
    expect(
      lerOpcoes([{ chave: 'faz_tudo', rotulo: 'Faço tudo', rotulo_acompanhante: 'Faz tudo' }]),
    ).toEqual([{ chave: 'faz_tudo', rotulo: 'Faço tudo', rotulo_acompanhante: 'Faz tudo' }])
  })

  it('aceita opcao sem voz de acompanhante', () => {
    expect(lerOpcoes([{ chave: 'sim', rotulo: 'Sim' }])).toEqual([
      { chave: 'sim', rotulo: 'Sim' },
    ])
  })

  it('devolve lista vazia para nulo, em vez de quebrar', () => {
    // `opcoes` e jsonb e pode estar nulo em pergunta de texto.
    expect(lerOpcoes(null)).toEqual([])
    expect(lerOpcoes(undefined)).toEqual([])
  })

  it('descarta entrada malformada em vez de derrubar a tela', () => {
    expect(lerOpcoes([{ rotulo: 'sem chave' }, 'nao e objeto', null])).toEqual([])
  })
})

describe('rotuloDaOpcao', () => {
  const opcao = {
    chave: 'faz_tudo',
    rotulo: 'Eu que planejo, organizo, coordeno e faço a comida.',
    rotulo_acompanhante: 'Planeja, organiza, coordena e faz a comida.',
  }

  it('usa a primeira pessoa para o titular', () => {
    expect(rotuloDaOpcao(opcao, true)).toMatch(/^Eu que planejo/)
  })

  it('usa a terceira pessoa para o acompanhante', () => {
    expect(rotuloDaOpcao(opcao, false)).toMatch(/^Planeja/)
  })

  it('cai no rotulo unico quando nao ha voz de acompanhante', () => {
    const simples = { chave: 'sim', rotulo: 'Sim' }
    expect(rotuloDaOpcao(simples, false)).toBe('Sim')
    expect(rotuloDaOpcao(simples, true)).toBe('Sim')
  })
})

describe('opcoesDeTexto', () => {
  it('uma opcao por linha', () => {
    expect(opcoesDeTexto('Sim\nNão')).toEqual([
      { chave: 'sim', rotulo: 'Sim' },
      { chave: 'nao', rotulo: 'Não' },
    ])
  })

  it('separa as duas vozes por barra vertical', () => {
    const [opcao] = opcoesDeTexto('Faço a comida | Faz a comida')
    expect(opcao).toEqual({
      chave: 'faco_a_comida',
      rotulo: 'Faço a comida',
      rotulo_acompanhante: 'Faz a comida',
    })
  })

  it('ignora linhas em branco', () => {
    expect(opcoesDeTexto('Sim\n\n  \nNão')).toHaveLength(2)
  })

  it('desambigua chave repetida em vez de gerar duas iguais', () => {
    // Duas opcoes com a mesma chave quebrariam a leitura da resposta.
    const opcoes = opcoesDeTexto('Outros\nOutros')
    expect(opcoes.map((o) => o.chave)).toEqual(['outros', 'outros_2'])
  })

  it('gera chave estavel a partir do texto, sem acento', () => {
    expect(opcoesDeTexto('Ilha gastronômica')[0].chave).toBe('ilha_gastronomica')
  })
})

describe('textoDeOpcoes', () => {
  it('desfaz o que opcoesDeTexto fez', () => {
    const original = 'Faço a comida | Faz a comida\nSó administro'
    expect(textoDeOpcoes(opcoesDeTexto(original))).toBe(original)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- opcoes`
Expected: FAIL — `Cannot find module './opcoes'`

- [ ] **Step 3: Implementar**

Criar `lib/opcoes.ts`:

```typescript
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
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- opcoes`
Expected: PASS, 16 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/opcoes.ts lib/opcoes.test.ts
git commit -m "feat: opcoes de selecao com rotulo por voz"
```

---

### Task 2: O motor de roteiro

**Files:**
- Create: `lib/roteiro.ts`
- Test: `lib/roteiro.test.ts`

**Interfaces:**
- Consumes: `Pergunta` de `@/lib/supabase/tipos`
- Produces:
  - `type AlvoPasso = { tipo: 'inscricao' } | { tipo: 'participante'; ordem: number }`
  - `interface Passo { chave: string; alvo: AlvoPasso; pergunta?: Pergunta; fixo?: CampoFixo; titular: boolean }`
  - `type CampoFixo = 'abertura' | 'confirmar_titular' | 'nome' | 'email' | 'telefone' | 'data_nascimento' | 'nome_cracha' | 'buffet' | 'revisao'`
  - `expandirRoteiro(perguntas: Pergunta[], vagas: number): Passo[]`
  - `indiceDoPasso(roteiro: Passo[], chave: string): number`

**Esta é a tarefa central da fatia.** É a função que substitui os quatro ramos copiados do Typebot (`Group #6`: `numero_insc = 1 | 2 | 3 | 4`). Um roteiro, expandido em tempo de execução.

- [ ] **Step 1: Escrever os testes**

Criar `lib/roteiro.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { expandirRoteiro, indiceDoPasso } from './roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

function pergunta(p: Partial<Pergunta>): Pergunta {
  return {
    id: 'q1',
    evento_id: 'e1',
    chave: 'faturamento',
    rotulo: 'Faturamento',
    texto_chat: 'Quanto o buffet fatura por mês?',
    tipo: 'numero',
    escopo: 'inscricao',
    obrigatoria: false,
    ordem: 1,
    opcoes: null,
    ajuda: null,
    ativa: true,
    ...p,
  }
}

describe('expandirRoteiro', () => {
  it('uma vaga gera um bloco de participante', () => {
    const passos = expandirRoteiro([], 1)
    const deParticipante = passos.filter((p) => p.alvo.tipo === 'participante')
    expect(new Set(deParticipante.map((p) => (p.alvo as { ordem: number }).ordem))).toEqual(
      new Set([1]),
    )
  })

  it('tres vagas geram tres blocos, e o primeiro e o titular', () => {
    // Isto e o que substitui os quatro ramos copiados do Typebot: o numero
    // de blocos e consequencia de `vagas`, nao de codigo escrito a mao.
    const passos = expandirRoteiro([], 3)
    const ordens = passos
      .filter((p) => p.alvo.tipo === 'participante')
      .map((p) => (p.alvo as { ordem: number }).ordem)
    expect(new Set(ordens)).toEqual(new Set([1, 2, 3]))
    expect(passos.filter((p) => p.titular && p.alvo.tipo === 'participante').every((p) => (p.alvo as { ordem: number }).ordem === 1)).toBe(true)
  })

  it('sete vagas funcionam sem ninguem tocar em nada', () => {
    const ordens = expandirRoteiro([], 7)
      .filter((p) => p.alvo.tipo === 'participante')
      .map((p) => (p.alvo as { ordem: number }).ordem)
    expect(Math.max(...ordens)).toBe(7)
  })

  it('comeca pela abertura e termina pela revisao', () => {
    const passos = expandirRoteiro([], 2)
    expect(passos[0].fixo).toBe('abertura')
    expect(passos[passos.length - 1].fixo).toBe('revisao')
  })

  it('o titular confirma os dados; o acompanhante nao', () => {
    // O unico momento com dado pre-existente e o titular, que vem do Guru.
    // Acompanhantes sao coleta em branco — nao ha o que confirmar.
    const passos = expandirRoteiro([], 2)
    const confirmacoes = passos.filter((p) => p.fixo === 'confirmar_titular')
    expect(confirmacoes).toHaveLength(1)
    expect(confirmacoes[0].alvo).toEqual({ tipo: 'participante', ordem: 1 })
  })

  it('pergunta de escopo participante se repete uma vez por vaga', () => {
    const cargo = pergunta({ id: 'q-cargo', chave: 'cargo', escopo: 'participante' })
    const passos = expandirRoteiro([cargo], 3)
    const doCargo = passos.filter((p) => p.pergunta?.chave === 'cargo')
    expect(doCargo).toHaveLength(3)
    expect(doCargo.map((p) => (p.alvo as { ordem: number }).ordem)).toEqual([1, 2, 3])
  })

  it('pergunta de escopo inscricao aparece uma vez so', () => {
    const passos = expandirRoteiro([pergunta({})], 4)
    expect(passos.filter((p) => p.pergunta?.chave === 'faturamento')).toHaveLength(1)
  })

  it('as perguntas do buffet vem depois de todos os participantes', () => {
    const cargo = pergunta({ id: 'q-cargo', chave: 'cargo', escopo: 'participante' })
    const passos = expandirRoteiro([cargo, pergunta({})], 2)
    const ultimoParticipante = passos.map((p) => p.alvo.tipo).lastIndexOf('participante')
    const doBuffet = passos.findIndex((p) => p.pergunta?.chave === 'faturamento')
    expect(doBuffet).toBeGreaterThan(ultimoParticipante)
  })

  it('respeita a ordem cadastrada', () => {
    const a = pergunta({ id: 'a', chave: 'segunda', ordem: 2 })
    const b = pergunta({ id: 'b', chave: 'primeira', ordem: 1 })
    const chaves = expandirRoteiro([a, b], 1)
      .filter((p) => p.pergunta)
      .map((p) => p.pergunta!.chave)
    expect(chaves).toEqual(['primeira', 'segunda'])
  })

  it('ignora pergunta desativada', () => {
    // Desativar preserva as respostas ja dadas; so tira do roteiro daqui
    // para a frente.
    const passos = expandirRoteiro([pergunta({ ativa: false })], 1)
    expect(passos.some((p) => p.pergunta)).toBe(false)
  })

  it('cada passo tem chave unica, para servir de marcador de retomada', () => {
    const cargo = pergunta({ id: 'q-cargo', chave: 'cargo', escopo: 'participante' })
    const passos = expandirRoteiro([cargo, pergunta({})], 3)
    const chaves = passos.map((p) => p.chave)
    expect(new Set(chaves).size).toBe(chaves.length)
  })

  it('a chave do passo diz a quem ele pertence', () => {
    const cargo = pergunta({ id: 'q-cargo', chave: 'cargo', escopo: 'participante' })
    const passos = expandirRoteiro([cargo], 2)
    const doSegundo = passos.find(
      (p) => p.pergunta?.chave === 'cargo' && (p.alvo as { ordem: number }).ordem === 2,
    )
    expect(doSegundo!.chave).toContain('2')
  })

  it('vagas invalidas viram uma vaga, em vez de roteiro vazio', () => {
    // `vagas` vem do banco com check >= 1, mas a funcao e pura e pode ser
    // chamada de qualquer lugar. Melhor degradar do que devolver nada.
    expect(expandirRoteiro([], 0).some((p) => p.alvo.tipo === 'participante')).toBe(true)
    expect(expandirRoteiro([], -3).some((p) => p.alvo.tipo === 'participante')).toBe(true)
  })
})

describe('indiceDoPasso', () => {
  it('acha o passo pela chave', () => {
    const roteiro = expandirRoteiro([], 2)
    const alvo = roteiro[2].chave
    expect(indiceDoPasso(roteiro, alvo)).toBe(2)
  })

  it('chave desconhecida volta para o comeco', () => {
    // Uma retomada com marcador de um roteiro antigo — porque uma pergunta
    // foi removida — nao pode travar a conversa.
    expect(indiceDoPasso(expandirRoteiro([], 1), 'passo_que_nao_existe_mais')).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- roteiro`
Expected: FAIL — `Cannot find module './roteiro'`

- [ ] **Step 3: Implementar**

Criar `lib/roteiro.ts`:

```typescript
import type { Pergunta } from '@/lib/supabase/tipos'

export type AlvoPasso = { tipo: 'inscricao' } | { tipo: 'participante'; ordem: number }

export type CampoFixo =
  | 'abertura'
  | 'confirmar_titular'
  | 'nome'
  | 'email'
  | 'telefone'
  | 'data_nascimento'
  | 'nome_cracha'
  | 'buffet'
  | 'revisao'

export interface Passo {
  /** Único no roteiro. É o marcador gravado em `inscricoes.passo_atual`. */
  chave: string
  alvo: AlvoPasso
  /** Presente quando o passo vem de uma pergunta cadastrada. */
  pergunta?: Pergunta
  /** Presente quando o passo é um campo do núcleo fixo. */
  fixo?: CampoFixo
  /** Se o passo fala com o titular (muda a voz das opções). */
  titular: boolean
}

/** Campos que todo participante responde, na ordem em que a Lara pergunta. */
const CAMPOS_DO_PARTICIPANTE: CampoFixo[] = [
  'nome',
  'email',
  'telefone',
  'data_nascimento',
  'nome_cracha',
]

/**
 * Expande o roteiro único nos passos concretos daquela inscrição.
 *
 * É esta função que substitui os quatro ramos copiados do Typebot
 * (`Group #6`: numero_insc = 1 | 2 | 3 | 4). O número de blocos é
 * consequência de `vagas`; nada aqui conhece o número 4.
 */
export function expandirRoteiro(perguntas: Pergunta[], vagas: number): Passo[] {
  // A função é pura e pode ser chamada de qualquer lugar. Degradar para uma
  // vaga é melhor do que devolver um roteiro sem participante nenhum.
  const total = Number.isFinite(vagas) && vagas >= 1 ? Math.floor(vagas) : 1

  const ativas = perguntas.filter((p) => p.ativa).sort((a, b) => a.ordem - b.ordem)
  const doParticipante = ativas.filter((p) => p.escopo === 'participante')
  const daInscricao = ativas.filter((p) => p.escopo === 'inscricao')

  const passos: Passo[] = [
    { chave: 'abertura', alvo: { tipo: 'inscricao' }, fixo: 'abertura', titular: true },
  ]

  for (let ordem = 1; ordem <= total; ordem++) {
    const titular = ordem === 1
    const alvo: AlvoPasso = { tipo: 'participante', ordem }

    if (titular) {
      // O único momento com dado pré-existente: o que veio do Guru.
      // Acompanhantes são coleta em branco — não há o que confirmar.
      passos.push({
        chave: `p${ordem}.confirmar_titular`,
        alvo,
        fixo: 'confirmar_titular',
        titular,
      })
    } else {
      for (const campo of CAMPOS_DO_PARTICIPANTE) {
        passos.push({ chave: `p${ordem}.${campo}`, alvo, fixo: campo, titular })
      }
    }

    for (const pergunta of doParticipante) {
      passos.push({ chave: `p${ordem}.${pergunta.chave}`, alvo, pergunta, titular })
    }
  }

  passos.push({ chave: 'buffet', alvo: { tipo: 'inscricao' }, fixo: 'buffet', titular: true })

  for (const pergunta of daInscricao) {
    passos.push({
      chave: `i.${pergunta.chave}`,
      alvo: { tipo: 'inscricao' },
      pergunta,
      titular: true,
    })
  }

  passos.push({ chave: 'revisao', alvo: { tipo: 'inscricao' }, fixo: 'revisao', titular: true })

  return passos
}

/**
 * Onde retomar. Marcador desconhecido volta ao começo: uma pergunta pode
 * ter sido removida entre a interrupção e a volta, e isso não pode travar
 * a conversa.
 */
export function indiceDoPasso(roteiro: Passo[], chave: string): number {
  const indice = roteiro.findIndex((p) => p.chave === chave)
  return indice >= 0 ? indice : 0
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- roteiro`
Expected: PASS, 15 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/roteiro.ts lib/roteiro.test.ts
git commit -m "feat: motor de roteiro, um laco no lugar dos quatro ramos"
```

---

### Task 3: Acesso às perguntas

**Files:**
- Create: `lib/perguntas.ts`
- Test: `lib/perguntas.test.ts`

**Interfaces:**
- Consumes: `Opcao`, `opcoesDeTexto` de `@/lib/opcoes`; `TIPOS_PERGUNTA`, `ESCOPOS_PERGUNTA` de `@/lib/supabase/tipos`
- Produces:
  - `chaveDePergunta(rotulo: string, existentes: string[]): string`
  - `esquemaPergunta` (zod)
  - `listarPerguntas(cliente, eventoId: string): Promise<Pergunta[]>`
  - `criarPergunta(cliente, eventoId: string, entrada: EntradaPergunta): Promise<Pergunta>`
  - `atualizarPergunta(cliente, id: string, entrada: EntradaPergunta): Promise<void>`
  - `moverPergunta(cliente, eventoId: string, id: string, direcao: 'cima' | 'baixo'): Promise<void>`
  - `alternarAtiva(cliente, id: string, ativa: boolean): Promise<void>`

- [ ] **Step 1: Escrever os testes**

Criar `lib/perguntas.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { chaveDePergunta, esquemaPergunta, moverPergunta } from './perguntas'

describe('chaveDePergunta', () => {
  it('deriva do rotulo, sem acento e em minusculas', () => {
    expect(chaveDePergunta('Faturamento médio mensal', [])).toBe('faturamento_medio_mensal')
  })

  it('desambigua quando a chave ja existe no evento', () => {
    // `unique (evento_id, chave)` recusaria a segunda; melhor resolver aqui
    // do que devolver erro de banco a quem esta cadastrando.
    expect(chaveDePergunta('Faturamento', ['faturamento'])).toBe('faturamento_2')
    expect(chaveDePergunta('Faturamento', ['faturamento', 'faturamento_2'])).toBe(
      'faturamento_3',
    )
  })

  it('rotulo so de pontuacao ainda gera chave valida', () => {
    expect(chaveDePergunta('???', [])).toMatch(/^pergunta/)
  })

  it('corta chave absurdamente longa', () => {
    expect(chaveDePergunta('a'.repeat(200), []).length).toBeLessThanOrEqual(60)
  })
})

describe('esquemaPergunta', () => {
  const valido = {
    rotulo: 'Faturamento',
    texto_chat: 'Quanto o buffet fatura por mês?',
    tipo: 'numero',
    escopo: 'inscricao',
    obrigatoria: 'on',
    opcoes: '',
    ajuda: '',
  }

  it('aceita uma pergunta valida', () => {
    const r = esquemaPergunta.safeParse(valido)
    expect(r.success).toBe(true)
    expect(r.success && r.data.obrigatoria).toBe(true)
  })

  it('checkbox ausente vira false', () => {
    const { obrigatoria: _, ...semCheckbox } = valido
    const r = esquemaPergunta.safeParse(semCheckbox)
    expect(r.success && r.data.obrigatoria).toBe(false)
  })

  it('recusa tipo inventado', () => {
    expect(esquemaPergunta.safeParse({ ...valido, tipo: 'telepatia' }).success).toBe(false)
  })

  it('recusa escopo inventado', () => {
    expect(esquemaPergunta.safeParse({ ...valido, escopo: 'galaxia' }).success).toBe(false)
  })

  it('exige o texto que a Lara vai falar', () => {
    const r = esquemaPergunta.safeParse({ ...valido, texto_chat: '  ' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0].message).toMatch(/pergunta/i)
  })

  it('selecao sem opcoes e recusada, com mensagem clara', () => {
    const r = esquemaPergunta.safeParse({ ...valido, tipo: 'selecao_unica', opcoes: '' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0].message).toMatch(/opç/i)
  })

  it('selecao com opcoes passa', () => {
    const r = esquemaPergunta.safeParse({
      ...valido,
      tipo: 'selecao_unica',
      opcoes: 'Sim\nNão',
    })
    expect(r.success).toBe(true)
  })
})

describe('moverPergunta', () => {
  function clienteComOrdem(lista: Array<{ id: string; ordem: number }>) {
    const atualizacoes: Array<{ id: string; ordem: number }> = []
    const cliente = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: lista, error: null }),
          }),
        }),
        update: (valores: { ordem: number }) => ({
          eq: async (_c: string, id: string) => {
            atualizacoes.push({ id, ordem: valores.ordem })
            return { error: null }
          },
        }),
      }),
    } as never
    return { cliente, atualizacoes }
  }

  it('trocar com o vizinho de cima escreve as duas ordens', () => {
    // Reordenar mexendo em duas linhas evita reescrever a lista inteira a
    // cada clique.
    const { cliente, atualizacoes } = clienteComOrdem([
      { id: 'a', ordem: 1 },
      { id: 'b', ordem: 2 },
    ])
    return moverPergunta(cliente, 'e1', 'b', 'cima').then(() => {
      expect(atualizacoes).toHaveLength(2)
      expect(atualizacoes.find((u) => u.id === 'b')!.ordem).toBe(1)
      expect(atualizacoes.find((u) => u.id === 'a')!.ordem).toBe(2)
    })
  })

  it('a primeira nao sobe', () => {
    const { cliente, atualizacoes } = clienteComOrdem([
      { id: 'a', ordem: 1 },
      { id: 'b', ordem: 2 },
    ])
    return moverPergunta(cliente, 'e1', 'a', 'cima').then(() => {
      expect(atualizacoes).toHaveLength(0)
    })
  })

  it('a ultima nao desce', () => {
    const { cliente, atualizacoes } = clienteComOrdem([
      { id: 'a', ordem: 1 },
      { id: 'b', ordem: 2 },
    ])
    return moverPergunta(cliente, 'e1', 'b', 'baixo').then(() => {
      expect(atualizacoes).toHaveLength(0)
    })
  })

  it('id que nao esta na lista nao escreve nada', () => {
    const { cliente, atualizacoes } = clienteComOrdem([{ id: 'a', ordem: 1 }])
    return moverPergunta(cliente, 'e1', 'inexistente', 'cima').then(() => {
      expect(atualizacoes).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- perguntas`
Expected: FAIL — `Cannot find module './perguntas'`

- [ ] **Step 3: Implementar**

Criar `lib/perguntas.ts`:

```typescript
import { z } from 'zod'
import { semAcento } from '@/lib/identidade'
import { opcoesDeTexto, precisaDeOpcoes } from '@/lib/opcoes'
import {
  ESCOPOS_PERGUNTA,
  TIPOS_PERGUNTA,
  type Pergunta,
  type TipoPergunta,
} from '@/lib/supabase/tipos'

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
    // `.optional()` e obrigatorio aqui: checkbox desmarcado nao vem no
    // FormData, e um union com `z.undefined()` NAO torna a chave opcional
    // no Zod 4 — a validacao falharia em toda pergunta nao obrigatoria.
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
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- perguntas`
Expected: PASS, 14 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/perguntas.ts lib/perguntas.test.ts
git commit -m "feat: acesso as perguntas com chave estavel"
```

---

### Task 4: Server Actions do roteiro

**Files:**
- Create: `app/admin/[evento]/roteiro/acoes.ts`
- Test: `app/admin/[evento]/roteiro/acoes.test.ts`

**Interfaces:**
- Consumes: `criarPergunta`, `atualizarPergunta`, `moverPergunta`, `alternarAtiva`, `esquemaPergunta` de `@/lib/perguntas`
- Produces:
  - `type ResultadoForm = { erro: string } | undefined`
  - `acaoCriarPergunta(_anterior: ResultadoForm, form: FormData): Promise<ResultadoForm>`
  - `acaoAtualizarPergunta(_anterior: ResultadoForm, form: FormData): Promise<ResultadoForm>`
  - `acaoMoverPergunta(form: FormData): Promise<void>`
  - `acaoAlternarAtiva(form: FormData): Promise<void>`

- [ ] **Step 1: Escrever o teste**

Criar `app/admin/[evento]/roteiro/acoes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acoes do roteiro', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('reaproveita as funcoes de lib/perguntas', () => {
    expect(codigo).toMatch(/from '@\/lib\/perguntas'/)
    expect(codigo).toMatch(/criarPergunta\(/)
    expect(codigo).toMatch(/atualizarPergunta\(/)
  })

  it('valida com o esquema antes de gravar', () => {
    expect(codigo).toMatch(/esquemaPergunta\.safeParse/)
  })

  it('passa pela sessao do usuario, respeitando a RLS', () => {
    expect(codigo).toMatch(/criarClienteServidor/)
    expect(codigo).not.toMatch(/criarClienteAdmin|SERVICE_ROLE/)
  })

  it('nunca escreve chave nem escopo na atualizacao', () => {
    // A chave amarra o historico e o CSV; o escopo e parte da FK composta
    // que valida as respostas ja gravadas. Os dois sao imutaveis.
    const trecho = codigo.slice(codigo.indexOf('acaoAtualizarPergunta'))
    expect(trecho).not.toMatch(/chave:/)
    expect(trecho).not.toMatch(/escopo:/)
  })

  it('atualiza a tela depois de cada mudanca', () => {
    expect(codigo).toMatch(/revalidatePath\(/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "roteiro/acoes"`
Expected: FAIL — `ENOENT ... acoes.ts`

- [ ] **Step 3: Implementar**

Criar `app/admin/[evento]/roteiro/acoes.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  alternarAtiva,
  atualizarPergunta,
  criarPergunta,
  esquemaPergunta,
  moverPergunta,
} from '@/lib/perguntas'

export type ResultadoForm = { erro: string } | undefined

async function acharEvento(slug: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('eventos')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  return { supabase, evento: data as { id: string } | null }
}

export async function acaoCriarPergunta(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const slug = String(form.get('evento_slug') ?? '')
  const analise = esquemaPergunta.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const { supabase, evento } = await acharEvento(slug)
  if (!evento) return { erro: 'Evento não encontrado.' }

  try {
    await criarPergunta(supabase, evento.id, analise.data)
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) }
  }

  revalidatePath(`/admin/${slug}/roteiro`)
}

export async function acaoAtualizarPergunta(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const slug = String(form.get('evento_slug') ?? '')
  const id = String(form.get('id') ?? '')
  const analise = esquemaPergunta.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const supabase = await criarClienteServidor()

  try {
    // `chave` e `escopo` não são passados: a chave amarra o histórico e o
    // escopo é parte da FK composta que valida as respostas já gravadas.
    await atualizarPergunta(supabase, id, analise.data)
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) }
  }

  revalidatePath(`/admin/${slug}/roteiro`)
}

export async function acaoMoverPergunta(form: FormData) {
  const slug = String(form.get('evento_slug') ?? '')
  const id = String(form.get('id') ?? '')
  const direcao = form.get('direcao') === 'cima' ? 'cima' : 'baixo'

  const { supabase, evento } = await acharEvento(slug)
  if (!evento) return

  await moverPergunta(supabase, evento.id, id, direcao)
  revalidatePath(`/admin/${slug}/roteiro`)
}

export async function acaoAlternarAtiva(form: FormData) {
  const slug = String(form.get('evento_slug') ?? '')
  const id = String(form.get('id') ?? '')
  const ativa = form.get('ativa') === 'true'

  const supabase = await criarClienteServidor()
  await alternarAtiva(supabase, id, ativa)
  revalidatePath(`/admin/${slug}/roteiro`)
}
```

- [ ] **Step 4: Rodar e commitar**

```bash
npm test -- "roteiro/acoes"
npm run typecheck
git add "app/admin/[evento]/roteiro"
git commit -m "feat: acoes do editor de roteiro"
```

---

### Task 5: A lista e o formulário

**Files:**
- Create: `app/admin/[evento]/roteiro/lista-perguntas.tsx`, `app/admin/[evento]/roteiro/formulario-pergunta.tsx`
- Test: `app/admin/[evento]/roteiro/lista-perguntas.test.tsx`, `app/admin/[evento]/roteiro/formulario-pergunta.test.tsx`

**Interfaces:**
- Consumes: `Pergunta` de `@/lib/supabase/tipos`; as ações da Task 4
- Produces:
  - `ListaPerguntas({ eventoSlug, perguntas }: { eventoSlug: string; perguntas: Pergunta[] })`
  - `FormularioPergunta({ eventoSlug, pergunta }: { eventoSlug: string; pergunta?: Pergunta })`

**Sobre reordenar:** a spec falava em arrastar. Este plano usa **botões de subir e descer**. Motivo: arrastar exige biblioteca, é difícil de testar, não funciona com teclado e é ruim no celular. Com dez ou vinte perguntas por evento, dois botões resolvem — e são acessíveis por padrão.

- [ ] **Step 1: Escrever o teste da lista**

Criar `app/admin/[evento]/roteiro/lista-perguntas.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListaPerguntas } from './lista-perguntas'
import type { Pergunta } from '@/lib/supabase/tipos'

function pergunta(p: Partial<Pergunta>): Pergunta {
  return {
    id: 'q1', evento_id: 'e1', chave: 'faturamento', rotulo: 'Faturamento',
    texto_chat: 'Quanto fatura?', tipo: 'numero', escopo: 'inscricao',
    obrigatoria: false, ordem: 1, opcoes: null, ajuda: null, ativa: true, ...p,
  }
}

describe('ListaPerguntas', () => {
  it('mostra rotulo, chave, tipo e escopo', () => {
    render(<ListaPerguntas eventoSlug="eng-2026" perguntas={[pergunta({})]} />)
    expect(screen.getByText('Faturamento')).toBeInTheDocument()
    expect(screen.getByText('faturamento')).toBeInTheDocument()
    expect(screen.getByText(/uma vez por inscrição/i)).toBeInTheDocument()
  })

  it('diz que a pergunta de participante se repete', () => {
    render(
      <ListaPerguntas
        eventoSlug="eng-2026"
        perguntas={[pergunta({ escopo: 'participante' })]}
      />,
    )
    expect(screen.getByText(/uma vez por pessoa/i)).toBeInTheDocument()
  })

  it('a primeira nao tem botao de subir', () => {
    render(
      <ListaPerguntas
        eventoSlug="eng-2026"
        perguntas={[pergunta({ id: 'a' }), pergunta({ id: 'b', ordem: 2 })]}
      />,
    )
    expect(screen.getAllByRole('button', { name: /subir/i })).toHaveLength(1)
  })

  it('a ultima nao tem botao de descer', () => {
    render(
      <ListaPerguntas
        eventoSlug="eng-2026"
        perguntas={[pergunta({ id: 'a' }), pergunta({ id: 'b', ordem: 2 })]}
      />,
    )
    expect(screen.getAllByRole('button', { name: /descer/i })).toHaveLength(1)
  })

  it('mostra a pergunta desativada com aviso, sem esconde-la', () => {
    // Desativar preserva as respostas ja dadas. Sumir com a linha faria
    // parecer que a pergunta foi apagada.
    render(<ListaPerguntas eventoSlug="eng-2026" perguntas={[pergunta({ ativa: false })]} />)
    expect(screen.getByText(/fora do roteiro/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reativar/i })).toBeInTheDocument()
  })

  it('avisa quando o roteiro esta vazio', () => {
    render(<ListaPerguntas eventoSlug="eng-2026" perguntas={[]} />)
    expect(screen.getByText(/nenhuma pergunta/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- lista-perguntas`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar a lista**

Criar `app/admin/[evento]/roteiro/lista-perguntas.tsx`:

```tsx
import type { Pergunta } from '@/lib/supabase/tipos'
import { acaoAlternarAtiva, acaoMoverPergunta } from './acoes'

const NOME_DO_TIPO: Record<Pergunta['tipo'], string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  email: 'Email',
  telefone: 'Telefone',
  numero: 'Número',
  data: 'Data',
  selecao_unica: 'Escolha uma',
  selecao_multipla: 'Escolha várias',
  nota_estrela: 'Nota de 0 a 5',
  sim_nao: 'Sim ou não',
}

export function ListaPerguntas({
  eventoSlug,
  perguntas,
}: {
  eventoSlug: string
  perguntas: Pergunta[]
}) {
  if (perguntas.length === 0) {
    return <p className="text-neutral-500">Nenhuma pergunta ainda. Crie a primeira abaixo.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {perguntas.map((p, i) => (
        <li
          key={p.id}
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded border px-4 py-3 ${
            p.ativa ? '' : 'bg-neutral-50 text-neutral-500'
          }`}
        >
          <span className="font-medium">{p.rotulo}</span>
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{p.chave}</code>
          <span className="text-sm text-neutral-500">{NOME_DO_TIPO[p.tipo]}</span>
          <span className="text-sm text-neutral-500">
            {p.escopo === 'participante' ? 'uma vez por pessoa' : 'uma vez por inscrição'}
          </span>
          {p.obrigatoria ? <span className="text-xs text-neutral-500">obrigatória</span> : null}
          {!p.ativa ? (
            <span className="text-xs font-medium">fora do roteiro</span>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            {i > 0 ? (
              <form action={acaoMoverPergunta}>
                <input type="hidden" name="evento_slug" value={eventoSlug} />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="direcao" value="cima" />
                <button
                  type="submit"
                  aria-label={`Subir ${p.rotulo}`}
                  className="rounded border px-2 py-1 text-xs"
                >
                  ↑
                </button>
              </form>
            ) : null}

            {i < perguntas.length - 1 ? (
              <form action={acaoMoverPergunta}>
                <input type="hidden" name="evento_slug" value={eventoSlug} />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="direcao" value="baixo" />
                <button
                  type="submit"
                  aria-label={`Descer ${p.rotulo}`}
                  className="rounded border px-2 py-1 text-xs"
                >
                  ↓
                </button>
              </form>
            ) : null}

            <form action={acaoAlternarAtiva}>
              <input type="hidden" name="evento_slug" value={eventoSlug} />
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="ativa" value={p.ativa ? 'false' : 'true'} />
              <button
                type="submit"
                aria-label={p.ativa ? `Tirar ${p.rotulo} do roteiro` : `Reativar ${p.rotulo}`}
                className="rounded border px-2 py-1 text-xs"
              >
                {p.ativa ? 'Tirar do roteiro' : 'Reativar'}
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Escrever o teste do formulário**

Criar `app/admin/[evento]/roteiro/formulario-pergunta.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormularioPergunta } from './formulario-pergunta'

vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: (_a: unknown, i: unknown) => [i, vi.fn(), false] }
})

describe('FormularioPergunta', () => {
  it('tem rotulo, texto de chat, tipo e escopo', () => {
    render(<FormularioPergunta eventoSlug="eng-2026" />)
    expect(screen.getByLabelText(/nome da coluna/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/como a lara pergunta/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/quem responde/i)).toBeInTheDocument()
  })

  it('esconde o campo de opcoes para tipo que nao usa', () => {
    render(<FormularioPergunta eventoSlug="eng-2026" />)
    expect(screen.queryByLabelText(/opções/i)).not.toBeInTheDocument()
  })

  it('mostra o campo de opcoes ao escolher uma selecao', async () => {
    render(<FormularioPergunta eventoSlug="eng-2026" />)
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), 'selecao_unica')
    expect(screen.getByLabelText(/opções/i)).toBeInTheDocument()
  })

  it('explica a barra vertical das duas vozes', async () => {
    render(<FormularioPergunta eventoSlug="eng-2026" />)
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), 'selecao_unica')
    expect(screen.getByText(/\|/)).toBeInTheDocument()
  })

  it('ao editar, o escopo fica travado e explicado', () => {
    // Trocar o escopo invalidaria as respostas ja gravadas, que o banco
    // amarra por FK composta (pergunta_id, escopo).
    render(
      <FormularioPergunta
        eventoSlug="eng-2026"
        pergunta={{
          id: 'q1', evento_id: 'e1', chave: 'faturamento', rotulo: 'Faturamento',
          texto_chat: 'Quanto?', tipo: 'numero', escopo: 'inscricao',
          obrigatoria: false, ordem: 1, opcoes: null, ajuda: null, ativa: true,
        }}
      />,
    )
    expect(screen.getByLabelText(/quem responde/i)).toBeDisabled()
    expect(screen.getByText(/não pode mudar/i)).toBeInTheDocument()
  })

  it('ao editar, a chave aparece mas nao e editavel', () => {
    render(
      <FormularioPergunta
        eventoSlug="eng-2026"
        pergunta={{
          id: 'q1', evento_id: 'e1', chave: 'faturamento', rotulo: 'Faturamento',
          texto_chat: 'Quanto?', tipo: 'numero', escopo: 'inscricao',
          obrigatoria: false, ordem: 1, opcoes: null, ajuda: null, ativa: true,
        }}
      />,
    )
    expect(screen.getByText('faturamento')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^chave$/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- formulario-pergunta`
Expected: FAIL — módulo não existe.

- [ ] **Step 6: Implementar o formulário**

Criar `app/admin/[evento]/roteiro/formulario-pergunta.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { acaoAtualizarPergunta, acaoCriarPergunta, type ResultadoForm } from './acoes'
import { lerOpcoes, precisaDeOpcoes, textoDeOpcoes } from '@/lib/opcoes'
import { TIPOS_PERGUNTA, type Pergunta, type TipoPergunta } from '@/lib/supabase/tipos'

const NOME_DO_TIPO: Record<TipoPergunta, string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  email: 'Email',
  telefone: 'Telefone',
  numero: 'Número',
  data: 'Data',
  selecao_unica: 'Escolha uma',
  selecao_multipla: 'Escolha várias',
  nota_estrela: 'Nota de 0 a 5',
  sim_nao: 'Sim ou não',
}

export function FormularioPergunta({
  eventoSlug,
  pergunta,
}: {
  eventoSlug: string
  pergunta?: Pergunta
}) {
  const editando = pergunta !== undefined
  const [resultado, acao, enviando] = useActionState<ResultadoForm, FormData>(
    editando ? acaoAtualizarPergunta : acaoCriarPergunta,
    undefined,
  )
  const [tipo, setTipo] = useState<TipoPergunta>(pergunta?.tipo ?? 'texto_curto')

  return (
    <form action={acao} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="evento_slug" value={eventoSlug} />
      {editando ? <input type="hidden" name="id" value={pergunta.id} /> : null}

      {editando ? (
        <p className="text-sm text-neutral-500">
          Chave: <code className="rounded bg-neutral-100 px-1.5 py-0.5">{pergunta.chave}</code>{' '}
          — usada no CSV, não muda.
        </p>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nome da coluna</span>
        <input
          name="rotulo"
          defaultValue={pergunta?.rotulo}
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Como a Lara pergunta</span>
        <textarea
          name="texto_chat"
          defaultValue={pergunta?.texto_chat}
          required
          rows={2}
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Tipo</span>
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoPergunta)}
          className="rounded border px-3 py-2"
        >
          {TIPOS_PERGUNTA.map((t) => (
            <option key={t} value={t}>
              {NOME_DO_TIPO[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Quem responde</span>
        <select
          name="escopo"
          defaultValue={pergunta?.escopo ?? 'inscricao'}
          disabled={editando}
          className="rounded border px-3 py-2 disabled:bg-neutral-100"
        >
          <option value="inscricao">Uma vez por inscrição (o buffet)</option>
          <option value="participante">Uma vez por pessoa</option>
        </select>
        {editando ? (
          <span className="text-xs text-neutral-500">
            Não pode mudar depois de criada: as respostas já gravadas dependem disso.
          </span>
        ) : null}
      </label>

      {precisaDeOpcoes(tipo) ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Opções</span>
          <textarea
            name="opcoes"
            defaultValue={pergunta ? textoDeOpcoes(lerOpcoes(pergunta.opcoes)) : ''}
            rows={5}
            className="rounded border px-3 py-2 font-mono text-sm"
          />
          <span className="text-xs text-neutral-500">
            Uma por linha. Para dizer o mesmo item em voz diferente ao acompanhante, separe
            com | — por exemplo: <code>Faço a comida | Faz a comida</code>
          </span>
        </label>
      ) : null}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="obrigatoria"
          defaultChecked={pergunta?.obrigatoria}
          className="rounded border"
        />
        <span className="text-sm">Obrigatória</span>
      </label>

      {resultado?.erro ? (
        <p role="alert" className="text-sm text-red-600">
          {resultado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {enviando ? 'Salvando…' : editando ? 'Salvar' : 'Adicionar pergunta'}
      </button>
    </form>
  )
}
```

- [ ] **Step 7: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add "app/admin/[evento]/roteiro"
git commit -m "feat: lista e formulario de perguntas"
```

---

### Task 6: A prévia do roteiro e a página

**Files:**
- Create: `app/admin/[evento]/roteiro/previa-roteiro.tsx`, `app/admin/[evento]/roteiro/page.tsx`
- Test: `app/admin/[evento]/roteiro/previa-roteiro.test.tsx`
- Modify: `app/admin/[evento]/page.tsx`

**Interfaces:**
- Consumes: `expandirRoteiro`, `Passo` de `@/lib/roteiro`
- Produces: `PreviaRoteiro({ passos, vagas }: { passos: Passo[]; vagas: number })`

A prévia é o que torna o motor visível. Sem ela, o admin cadastra perguntas e só descobre o resultado quando alguém faz o check-in.

- [ ] **Step 1: Escrever o teste**

Criar `app/admin/[evento]/roteiro/previa-roteiro.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreviaRoteiro } from './previa-roteiro'
import { expandirRoteiro } from '@/lib/roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

const cargo: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual é a sua função no buffet?', tipo: 'selecao_unica',
  escopo: 'participante', obrigatoria: true, ordem: 1, opcoes: null,
  ajuda: null, ativa: true,
}

describe('PreviaRoteiro', () => {
  it('numera os passos', () => {
    const passos = expandirRoteiro([], 1)
    render(<PreviaRoteiro passos={passos} vagas={1} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('mostra o texto que a Lara vai falar', () => {
    render(<PreviaRoteiro passos={expandirRoteiro([cargo], 1)} vagas={1} />)
    expect(screen.getByText(/Qual é a sua função no buffet\?/)).toBeInTheDocument()
  })

  it('separa os blocos por pessoa', () => {
    render(<PreviaRoteiro passos={expandirRoteiro([cargo], 3)} vagas={3} />)
    expect(screen.getByText(/pessoa 1/i)).toBeInTheDocument()
    expect(screen.getByText(/pessoa 3/i)).toBeInTheDocument()
  })

  it('a mesma pergunta aparece uma vez por pessoa', () => {
    render(<PreviaRoteiro passos={expandirRoteiro([cargo], 3)} vagas={3} />)
    expect(screen.getAllByText(/Qual é a sua função no buffet\?/)).toHaveLength(3)
  })

  it('diz quantos passos a conversa tem', () => {
    const passos = expandirRoteiro([cargo], 2)
    render(<PreviaRoteiro passos={passos} vagas={2} />)
    expect(screen.getByText(new RegExp(`${passos.length} passos`))).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- previa-roteiro`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar a prévia**

Criar `app/admin/[evento]/roteiro/previa-roteiro.tsx`:

```tsx
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
  let ultimoTitulo: string | null = null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        Para uma compra de {vagas} {vagas === 1 ? 'vaga' : 'vagas'}, a conversa tem{' '}
        <strong>{passos.length} passos</strong>.
      </p>

      <ol className="flex flex-col gap-1">
        {passos.map((passo, i) => {
          const t = titulo(passo)
          const abreBloco = t !== null && t !== ultimoTitulo
          if (t !== null) ultimoTitulo = t

          return (
            <li key={passo.chave}>
              {abreBloco ? (
                <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {t}
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
          )
        })}
      </ol>
    </div>
  )
}
```

- [ ] **Step 4: Implementar a página**

Criar `app/admin/[evento]/roteiro/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { listarPerguntas } from '@/lib/perguntas'
import { expandirRoteiro } from '@/lib/roteiro'
import { ListaPerguntas } from './lista-perguntas'
import { FormularioPergunta } from './formulario-pergunta'
import { PreviaRoteiro } from './previa-roteiro'

export default async function PaginaRoteiro({
  params,
  searchParams,
}: PageProps<'/admin/[evento]/roteiro'>) {
  const { evento: slug } = await params
  const { vagas: vagasBruto } = await searchParams

  const supabase = await criarClienteServidor()
  const { data: evento } = await supabase
    .from('eventos')
    .select('id, nome')
    .eq('slug', slug)
    .maybeSingle()
  if (!evento) notFound()

  const perguntas = await listarPerguntas(supabase, evento.id)

  const pedido = Number(Array.isArray(vagasBruto) ? vagasBruto[0] : vagasBruto)
  const vagas = Number.isFinite(pedido) && pedido >= 1 && pedido <= 10 ? Math.floor(pedido) : 2

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-4 text-xl font-semibold">{evento.nome} · Roteiro</h1>
        <ListaPerguntas eventoSlug={slug} perguntas={perguntas} />
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Nova pergunta</h2>
        <FormularioPergunta eventoSlug={slug} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Prévia da conversa</h2>
        <form method="get" className="mb-4 flex items-center gap-2 text-sm">
          <label htmlFor="vagas">Simular uma compra de</label>
          <select
            id="vagas"
            name="vagas"
            defaultValue={vagas}
            className="rounded border px-2 py-1"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded border px-3 py-1">
            Atualizar
          </button>
        </form>

        <PreviaRoteiro passos={expandirRoteiro(perguntas, vagas)} vagas={vagas} />
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Ligar a partir da tela do evento**

Em `app/admin/[evento]/page.tsx`, ao lado do link "Nova inscrição", acrescentar:

```tsx
      <div className="flex gap-3">
        <Link
          href={`/admin/${slug}/participantes`}
          className="rounded border px-4 py-2"
        >
          Participantes
        </Link>
        <Link href={`/admin/${slug}/roteiro`} className="rounded border px-4 py-2">
          Roteiro
        </Link>
      </div>
```

(mantendo o botão "Nova inscrição" que já existe)

- [ ] **Step 6: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add "app/admin/[evento]"
git commit -m "feat: previa do roteiro e pagina do editor"
```

---

## Verificação final no navegador

Se algo tiver mudado em código de cliente, apague o `.next` antes: o cache do Turbopack já serviu pacote velho e custou uma investigação inteira.

1. `/admin/escalada/roteiro` — a lista começa vazia
2. Criar **Faturamento**, tipo Número, uma vez por inscrição → aparece na lista com a chave `faturamento`
3. Criar **Cargo**, tipo Escolha uma, uma vez por pessoa, com as opções:

   ```
   Eu que planejo, organizo, coordeno e faço a comida. | Planeja, organiza, coordena e faz a comida.
   Só não faço a comida, o restante é comigo. | Só não faz a comida, o restante faz tudo.
   Sou responsável pela parte administrativa apenas. | Responsável pela parte administrativa.
   ```

   São os quatro papéis reais do último evento, agora com **uma chave e duas vozes** cada.
4. Na prévia, escolher **3 vagas** → "Cargo" deve aparecer **três vezes**, uma em cada bloco de pessoa, e "Faturamento" **uma vez só**, depois de todos
5. Subir e descer uma pergunta → a ordem muda na lista e na prévia
6. **Tirar do roteiro** uma pergunta → some da prévia, continua na lista marcada como fora
7. Editar a pergunta → o campo "Quem responde" está travado e a chave aparece como texto, não como campo

## O que a Fatia C1 entrega

O questionário de cada evento é montado pela tela, e a prévia mostra exatamente a conversa que sairá dali — inclusive quantos passos ela terá para uma compra de N vagas.

**O que fica para a Fatia C2:** a conversa em si — token, uma pergunta por vez, gravação incremental, retomada e revisão final.
**Para a Fatia D:** a integração com o Guru, cujo caminho atual passa por uma planilha (ver adendo no spec).

## Candidato para depois, não incluído aqui

**Clonar o roteiro do evento anterior.** Com vários eventos por ano e um questionário estável, redigitar quinze perguntas a cada edição é trabalho puro. Um botão "copiar perguntas de outro evento" resolveria. Ficou de fora porque a decisão registrada no spec foi "núcleo fixo + perguntas customizadas", sem biblioteca — mas vale reconsiderar depois do segundo evento.
