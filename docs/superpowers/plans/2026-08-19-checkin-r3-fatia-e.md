# Check-in R3 — Fatia E (Ramificação e fechamento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A conversa da Lara fica igual à do Typebot: perguntas que só aparecem conforme a resposta anterior, o fechamento com data, horário e local do evento, e as 22 perguntas já cadastradas.

**Architecture:** Uma pergunta pode declarar que depende de outra (`depende_de` + `depende_valor`). Isso obriga o motor de roteiro, hoje puro e sem estado, a receber as respostas já dadas. O obstáculo é circular: as respostas são hoje chaveadas **procurando o passo no roteiro**, e o roteiro passaria a depender delas. A Task 1 quebra o ciclo derivando a chave direto de `pergunta.chave` + `ordem do participante`, sem consultar o roteiro.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript strict, Tailwind 4, zod 4, `@supabase/ssr`, vitest 4.

## Global Constraints

- **Diretório:** `C:\Users\regra\Downloads\Checkin R3`, branch `main`, remoto `github.com/regratech/Checkin`.
- **Referência da copy:** `docs/superpowers/specs/2026-08-19-roteiro-do-typebot.md`. Os textos da Lara devem sair de lá **literalmente** — o público já conhece essa conversa.
- **O nome da assistente é `Lara`**, com L. Confirmado pelo operador.
- **Fatias A a D entregues.** Migrations `001` a `008`. 439 testes.
- **Idioma:** nomes de arquivo, função, variável, rota e teste em **português**.
- **Estilo TypeScript:** sem ponto e vírgula, aspas simples, `import type` quando for só tipo.
- **A escala de nota é 0 a 5.** O enunciado do Typebot diz "de 1 a 5", mas a legenda começa em 0 e a planilha tem zeros. Reproduzir a legenda, não o enunciado errado.
- **`chave` de pergunta é imutável** depois de criada. Vale também para `depende_de`, que aponta para uma chave.
- **O dev server precisa de `NODE_EXTRA_CA_CERTS`** e roda na porta **3100**.
- **Depois de mudar código que o navegador executa, limpe o `.next`** antes de concluir que a correção falhou.
- **Testes que leem o fonte como texto** removem comentários e delimitam o trecho. Já reprovaram código correto quatro vezes nesta base.
- **Regex sem a flag `s`** — o projeto compila para ES2017. Use `[\s\S]`.
- **Verificação:** `npm test`, `npm run typecheck` e `npm run lint` ao fim de cada tarefa.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/roteiro.ts` | Ganha `chaveDoAlvo` e a avaliação de condição |
| `lib/checkin.ts` | Passa a chavear respostas sem consultar o roteiro |
| `supabase/migrations/009_condicoes.sql` | `depende_de`, `depende_valor`, `horario`, `texto_encerramento` |
| `lib/perguntas.ts` | Esquema aceita a condição |
| `app/admin/[evento]/roteiro/formulario-pergunta.tsx` | Campo de condição |
| `app/admin/[evento]/encerramento/…` | Editar horário e texto de encerramento |
| `app/checkin/[token]/conversa.tsx` | Copy da Lara e o fechamento montado |
| `supabase/seeds/roteiro-engrenagem.sql` | As 22 perguntas |

---

### Task 1: Chave da resposta sem o roteiro

**Files:**
- Modify: `lib/roteiro.ts`, `lib/checkin.ts`
- Test: `lib/roteiro.test.ts`, `lib/checkin.test.ts`

**Interfaces:**
- Consumes: `Pergunta` de `@/lib/supabase/tipos`
- Produces: `chaveDoAlvo(chave: string, alvo: AlvoPasso): string` exportada de `@/lib/roteiro`

**Esta tarefa não muda comportamento nenhum.** Ela existe para quebrar o ciclo: hoje `carregarPorToken` descobre a chave de cada resposta **procurando o passo no roteiro**; a partir da Task 3 o roteiro depende das respostas. Derivar a chave direto de `pergunta.chave` + `ordem` desfaz a dependência.

- [ ] **Step 1: Escrever o teste**

Acrescentar em `lib/roteiro.test.ts`:

```typescript
describe('chaveDoAlvo', () => {
  it('pergunta de inscricao usa o prefixo i', () => {
    expect(chaveDoAlvo('faturamento', { tipo: 'inscricao' })).toBe('i.faturamento')
  })

  it('pergunta de participante usa o numero da pessoa', () => {
    expect(chaveDoAlvo('cargo', { tipo: 'participante', ordem: 2 })).toBe('p2.cargo')
  })

  it('bate com a chave que expandirRoteiro gera', () => {
    // As duas precisam concordar: uma monta o roteiro, a outra le as
    // respostas gravadas. Divergir faria a retomada perder tudo.
    const cargo: Pergunta = {
      id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
      texto_chat: 'Qual sua função?', tipo: 'texto_curto', escopo: 'participante',
      obrigatoria: false, ordem: 1, opcoes: null, ajuda: null, ativa: true,
    }
    const passo = expandirRoteiro([cargo], 2).find(
      (p) => p.pergunta?.chave === 'cargo' && ordemDe(p) === 2,
    )!
    expect(passo.chave).toBe(chaveDoAlvo('cargo', passo.alvo))
  })
})
```

Acrescentar o import: trocar a linha de import por

```typescript
import { expandirRoteiro, indiceDoPasso, chaveDoAlvo, type Passo } from './roteiro'
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- roteiro`
Expected: FAIL — `chaveDoAlvo is not a function`

- [ ] **Step 3: Implementar em `lib/roteiro.ts`**

Acrescentar antes de `expandirRoteiro`:

```typescript
/**
 * A chave de um passo de pergunta, derivada sem consultar o roteiro.
 *
 * Existe para quebrar um ciclo: `carregarPorToken` precisa chavear as
 * respostas já gravadas, e a partir das condições o roteiro passa a
 * depender dessas respostas. Derivar aqui desfaz a dependência.
 */
export function chaveDoAlvo(chave: string, alvo: AlvoPasso): string {
  return alvo.tipo === 'participante' ? `p${alvo.ordem}.${chave}` : `i.${chave}`
}
```

E usar dentro de `expandirRoteiro`, nos dois lugares onde a chave é montada à mão. Trocar:

```typescript
      passos.push({ chave: `p${ordem}.${pergunta.chave}`, alvo, pergunta, titular })
```

por:

```typescript
      passos.push({ chave: chaveDoAlvo(pergunta.chave, alvo), alvo, pergunta, titular })
```

E trocar:

```typescript
    passos.push({
      chave: `i.${pergunta.chave}`,
      alvo: { tipo: 'inscricao' },
      pergunta,
      titular: true,
    })
```

por:

```typescript
    const alvoInscricao: AlvoPasso = { tipo: 'inscricao' }
    passos.push({
      chave: chaveDoAlvo(pergunta.chave, alvoInscricao),
      alvo: alvoInscricao,
      pergunta,
      titular: true,
    })
```

- [ ] **Step 4: Usar em `lib/checkin.ts`**

Trocar o bloco que monta `porChave` a partir do roteiro:

```typescript
  for (const r of (respostas ?? []) as Array<{
    pergunta_id: string
    participante_id: string | null
    valor: unknown
  }>) {
    const passo = passos.find((p) => {
      if (p.pergunta?.id !== r.pergunta_id) return false
      if (r.participante_id === null) return p.alvo.tipo === 'inscricao'
      const dono = (participantes ?? []).find((x: Participante) => x.id === r.participante_id)
      return p.alvo.tipo === 'participante' && dono?.ordem === p.alvo.ordem
    })
    if (passo) porChave[passo.chave] = r.valor
  }
```

por:

```typescript
  // Chaveia direto de `pergunta.chave` + ordem, sem consultar o roteiro —
  // que a partir das condições passa a depender destas respostas.
  const listaPerguntas = (perguntas ?? []) as Pergunta[]
  const listaParticipantes = (participantes ?? []) as Participante[]

  for (const r of (respostas ?? []) as Array<{
    pergunta_id: string
    participante_id: string | null
    valor: unknown
  }>) {
    const pergunta = listaPerguntas.find((p) => p.id === r.pergunta_id)
    if (!pergunta) continue

    if (r.participante_id === null) {
      porChave[chaveDoAlvo(pergunta.chave, { tipo: 'inscricao' })] = r.valor
      continue
    }

    const dono = listaParticipantes.find((x) => x.id === r.participante_id)
    if (dono) {
      porChave[chaveDoAlvo(pergunta.chave, { tipo: 'participante', ordem: dono.ordem })] =
        r.valor
    }
  }
```

E mover a expansão do roteiro para **depois** desse bloco, trocando a ordem: primeiro `porChave`, depois `const passos = expandirRoteiro(...)`. Ajustar o import:

```typescript
import { chaveDoAlvo, expandirRoteiro, indiceDoPasso, type Passo } from '@/lib/roteiro'
```

- [ ] **Step 5: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add lib/roteiro.ts lib/roteiro.test.ts lib/checkin.ts
git commit -m "refactor: chave da resposta derivada sem consultar o roteiro"
```

---

### Task 2: Migration 009

**Files:**
- Create: `supabase/migrations/009_condicoes.sql`
- Test: `lib/supabase/condicoes-schema.test.ts`

**Interfaces:**
- Produces: `perguntas.depende_de`, `perguntas.depende_valor`, `eventos.horario`, `eventos.texto_encerramento`

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/condicoes-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/009_condicoes.sql'),
  'utf-8',
)
const comandos = sql.replace(/--.*$/gm, '')

describe('migration 009 - condicoes e encerramento', () => {
  it('a pergunta pode depender de outra, pela chave', () => {
    // Pela chave, nao pelo id: a chave e estavel e legivel, e e o que o
    // admin escolhe na tela.
    expect(comandos).toMatch(/add column depende_de text/i)
  })

  it('guarda os valores que satisfazem a condicao', () => {
    expect(comandos).toMatch(/add column depende_valor jsonb/i)
  })

  it('uma pergunta nao pode depender de si mesma', () => {
    // Ciclo direto: a pergunta nunca apareceria, porque a propria resposta
    // e a condicao para ela existir.
    expect(comandos).toMatch(/check\s*\(\s*depende_de is null or depende_de <> chave\s*\)/i)
  })

  it('o evento ganha horario e texto de encerramento', () => {
    // Estavam escritos a mao no Typebot. Como campo, trocar o endereco
    // deixa de exigir mexer em codigo.
    expect(comandos).toMatch(/add column horario text/i)
    expect(comandos).toMatch(/add column texto_encerramento text/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- condicoes-schema`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Escrever a migration**

Criar `supabase/migrations/009_condicoes.sql`:

```sql
-- Uma pergunta pode so aparecer conforme a resposta de outra. E o que o
-- Typebot faz em "Voce ja faz mais de um evento por dia?": SIM leva a duas
-- perguntas, NAO leva a outra.
--
-- A dependencia aponta para a CHAVE, nao para o id: a chave e estavel,
-- legivel, e e o que o admin escolhe na tela.
alter table perguntas
  add column depende_de text,
  add column depende_valor jsonb;

-- Ciclo direto: a pergunta nunca apareceria, porque a propria resposta
-- dela seria a condicao para ela existir.
alter table perguntas
  add constraint perguntas_dependencia_nao_circular
  check (depende_de is null or depende_de <> chave);

-- Data, horario e local do treinamento estavam escritos a mao no Typebot.
-- Como campo do evento, trocar o endereco deixa de exigir mexer em codigo.
-- `data` e `local` ja existem desde a migration 001.
alter table eventos
  add column horario text,
  add column texto_encerramento text;
```

- [ ] **Step 4: Rodar o teste, aplicar e commitar**

Run: `npm test -- condicoes-schema` → PASS, 4 testes.

Colar o arquivo inteiro no SQL Editor do projeto `vyjxyczbscdkfhdabrxk`.

```bash
git add supabase/migrations/009_condicoes.sql lib/supabase/condicoes-schema.test.ts
git commit -m "feat: condicao entre perguntas e campos de encerramento"
```

---

### Task 3: Condições no motor

**Files:**
- Modify: `lib/roteiro.ts`, `lib/supabase/tipos.ts`, `lib/checkin.ts`
- Test: `lib/roteiro.test.ts`

**Interfaces:**
- Consumes: `chaveDoAlvo` da Task 1
- Produces:
  - `Pergunta` ganha `depende_de: string | null` e `depende_valor: unknown`
  - `condicaoSatisfeita(pergunta: Pergunta, todas: Pergunta[], alvo: AlvoPasso, respostas: Record<string, unknown>): boolean`
  - `expandirRoteiro(perguntas: Pergunta[], vagas: number, respostas?: Record<string, unknown>): Passo[]`

- [ ] **Step 1: Escrever os testes**

Acrescentar em `lib/roteiro.test.ts`:

```typescript
describe('expandirRoteiro com condicao', () => {
  const gatilho = pergunta({
    id: 'q-gatilho', chave: 'mais_de_um_evento_dia', tipo: 'sim_nao',
    escopo: 'inscricao', ordem: 1,
  })
  const seSim = pergunta({
    id: 'q-sim', chave: 'max_eventos_dia', escopo: 'inscricao', ordem: 2,
    depende_de: 'mais_de_um_evento_dia', depende_valor: [true],
  })
  const seNao = pergunta({
    id: 'q-nao', chave: 'obstaculo_multiplos', escopo: 'inscricao', ordem: 3,
    depende_de: 'mais_de_um_evento_dia', depende_valor: [false],
  })

  const chaves = (passos: Passo[]) =>
    passos.filter((p) => p.pergunta).map((p) => p.pergunta!.chave)

  it('sem resposta ainda, so o gatilho aparece', () => {
    // A conversa nao pode mostrar as duas ramificacoes de uma vez.
    expect(chaves(expandirRoteiro([gatilho, seSim, seNao], 1))).toEqual([
      'mais_de_um_evento_dia',
    ])
  })

  it('respondendo sim, aparece a pergunta do sim', () => {
    const passos = expandirRoteiro([gatilho, seSim, seNao], 1, {
      'i.mais_de_um_evento_dia': true,
    })
    expect(chaves(passos)).toEqual(['mais_de_um_evento_dia', 'max_eventos_dia'])
  })

  it('respondendo nao, aparece a outra', () => {
    const passos = expandirRoteiro([gatilho, seSim, seNao], 1, {
      'i.mais_de_um_evento_dia': false,
    })
    expect(chaves(passos)).toEqual(['mais_de_um_evento_dia', 'obstaculo_multiplos'])
  })

  it('trocar a resposta troca a ramificacao', () => {
    // A pessoa pode corrigir na revisao. O roteiro tem de acompanhar.
    const antes = expandirRoteiro([gatilho, seSim, seNao], 1, {
      'i.mais_de_um_evento_dia': true,
    })
    const depois = expandirRoteiro([gatilho, seSim, seNao], 1, {
      'i.mais_de_um_evento_dia': false,
    })
    expect(chaves(antes)).not.toEqual(chaves(depois))
  })

  it('compara sim e nao escritos de varias formas', () => {
    // O valor gravado depende do tipo: booleano para sim_nao, string para
    // selecao. A comparacao normaliza os dois.
    for (const valor of [true, 'true', 'sim', 'Sim']) {
      const passos = expandirRoteiro([gatilho, seSim], 1, {
        'i.mais_de_um_evento_dia': valor,
      })
      expect(chaves(passos)).toContain('max_eventos_dia')
    }
  })

  it('condicao sobre pergunta de participante olha a pessoa certa', () => {
    const cargo = pergunta({
      id: 'q-cargo', chave: 'cargo', tipo: 'selecao_unica',
      escopo: 'participante', ordem: 1,
    })
    const detalhe = pergunta({
      id: 'q-det', chave: 'detalhe_cargo', escopo: 'participante', ordem: 2,
      depende_de: 'cargo', depende_valor: ['faz_tudo'],
    })

    // So a pessoa 1 respondeu "faz_tudo".
    const passos = expandirRoteiro([cargo, detalhe], 2, { 'p1.cargo': 'faz_tudo' })

    const ordensComDetalhe = passos
      .filter((p) => p.pergunta?.chave === 'detalhe_cargo')
      .map(ordemDe)
    expect(ordensComDetalhe).toEqual([1])
  })

  it('dependencia apontando para pergunta que nao existe some do roteiro', () => {
    // Melhor sumir do que aparecer sempre: uma pergunta orfa quase certamente
    // e sobra de uma pergunta apagada.
    const orfa = pergunta({
      id: 'q-orfa', chave: 'orfa', escopo: 'inscricao',
      depende_de: 'pergunta_que_nao_existe', depende_valor: ['x'],
    })
    expect(chaves(expandirRoteiro([orfa], 1))).toEqual([])
  })

  it('depende_valor vazio aceita qualquer resposta nao vazia', () => {
    const qualquer = pergunta({
      id: 'q-any', chave: 'qualquer', escopo: 'inscricao', ordem: 2,
      depende_de: 'mais_de_um_evento_dia', depende_valor: null,
    })
    expect(chaves(expandirRoteiro([gatilho, qualquer], 1, {}))).toEqual([
      'mais_de_um_evento_dia',
    ])
    expect(
      chaves(expandirRoteiro([gatilho, qualquer], 1, { 'i.mais_de_um_evento_dia': false })),
    ).toContain('qualquer')
  })

  it('sem condicao nenhuma, tudo aparece como antes', () => {
    expect(chaves(expandirRoteiro([gatilho], 1))).toEqual(['mais_de_um_evento_dia'])
  })
})
```

E acrescentar os dois campos ao helper `pergunta()` do arquivo, dentro do objeto devolvido:

```typescript
    depende_de: null,
    depende_valor: null,
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- roteiro`
Expected: FAIL — as perguntas condicionais aparecem sempre.

- [ ] **Step 3: Acrescentar os campos ao tipo**

Em `lib/supabase/tipos.ts`, dentro de `interface Pergunta`, antes de `ativa`:

```typescript
  /** Chave de outra pergunta do mesmo evento. Nulo quando incondicional. */
  depende_de: string | null
  /** Valores que satisfazem. Nulo = qualquer resposta não vazia serve. */
  depende_valor: unknown
```

- [ ] **Step 4: Implementar em `lib/roteiro.ts`**

Acrescentar depois de `chaveDoAlvo`:

```typescript
/** `true`, `"true"`, `"sim"` e `"Sim"` são a mesma resposta. */
function normalizarParaComparar(valor: unknown): string {
  if (valor === true) return 'sim'
  if (valor === false) return 'nao'
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .replace(/^não$/, 'nao')
    .replace(/^true$/, 'sim')
    .replace(/^false$/, 'nao')
}

export function condicaoSatisfeita(
  pergunta: Pergunta,
  todas: Pergunta[],
  alvo: AlvoPasso,
  respostas: Record<string, unknown>,
): boolean {
  if (!pergunta.depende_de) return true

  const dependencia = todas.find((p) => p.chave === pergunta.depende_de)
  // Dependência órfã some do roteiro. Melhor do que aparecer sempre: quase
  // certamente é sobra de uma pergunta apagada.
  if (!dependencia) return false

  // O alvo da resposta é o da DEPENDÊNCIA, não o desta pergunta: uma
  // pergunta de participante pode depender de uma do buffet.
  const alvoDaDependencia: AlvoPasso =
    dependencia.escopo === 'inscricao' ? { tipo: 'inscricao' } : alvo

  const resposta = respostas[chaveDoAlvo(dependencia.chave, alvoDaDependencia)]
  const dada = normalizarParaComparar(resposta)
  if (!dada) return false

  const aceitos = Array.isArray(pergunta.depende_valor) ? pergunta.depende_valor : []
  // Sem lista de valores, basta ter sido respondida.
  if (aceitos.length === 0) return true

  return aceitos.map(normalizarParaComparar).includes(dada)
}
```

Trocar a assinatura e o filtro de `expandirRoteiro`:

```typescript
export function expandirRoteiro(
  perguntas: Pergunta[],
  vagas: number,
  respostas: Record<string, unknown> = {},
): Passo[] {
```

e trocar

```typescript
  const ativas = perguntas.filter((p) => p.ativa).sort((a, b) => a.ordem - b.ordem)
  const doParticipante = ativas.filter((p) => p.escopo === 'participante')
  const daInscricao = ativas.filter((p) => p.escopo === 'inscricao')
```

por

```typescript
  const ativas = perguntas.filter((p) => p.ativa).sort((a, b) => a.ordem - b.ordem)
  const doParticipante = ativas.filter((p) => p.escopo === 'participante')
  const daInscricao = ativas.filter(
    (p) => p.escopo === 'inscricao' && condicaoSatisfeita(p, ativas, { tipo: 'inscricao' }, respostas),
  )
```

E dentro do laço dos participantes, trocar

```typescript
    for (const pergunta of doParticipante) {
```

por

```typescript
    for (const pergunta of doParticipante) {
      if (!condicaoSatisfeita(pergunta, ativas, alvo, respostas)) continue
```

(mantendo o corpo do laço; o `continue` entra como primeira linha)

- [ ] **Step 5: Passar as respostas em `lib/checkin.ts`**

Trocar:

```typescript
  const passos = expandirRoteiro(listaPerguntas, inscricao.vagas)
```

por:

```typescript
  // As condições precisam do que já foi respondido — por isso `porChave`
  // é montado antes (Task 1).
  const passos = expandirRoteiro(listaPerguntas, inscricao.vagas, porChave)
```

- [ ] **Step 6: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add lib/roteiro.ts lib/roteiro.test.ts lib/checkin.ts lib/supabase/tipos.ts
git commit -m "feat: perguntas condicionais no motor de roteiro"
```

---

### Task 4: A condição no editor

**Files:**
- Modify: `lib/perguntas.ts`, `app/admin/[evento]/roteiro/formulario-pergunta.tsx`, `app/admin/[evento]/roteiro/page.tsx`, `app/admin/[evento]/roteiro/lista-perguntas.tsx`
- Test: `lib/perguntas.test.ts`, `app/admin/[evento]/roteiro/formulario-pergunta.test.tsx`

**Interfaces:**
- Consumes: `Pergunta` com os campos novos
- Produces: `esquemaPergunta` aceita `depende_de` e `depende_valor`; `FormularioPergunta` ganha a prop `outras: Pergunta[]`

- [ ] **Step 1: Escrever os testes**

Acrescentar em `lib/perguntas.test.ts`:

```typescript
describe('esquemaPergunta e a condicao', () => {
  const valido = {
    rotulo: 'Máximo de eventos',
    texto_chat: 'Qual foi o máximo de eventos num mesmo dia?',
    tipo: 'numero',
    escopo: 'inscricao',
    opcoes: '',
    ajuda: '',
  }

  it('aceita pergunta sem condicao', () => {
    const r = esquemaPergunta.safeParse(valido)
    expect(r.success && r.data.depende_de).toBeUndefined()
  })

  it('aceita condicao com valores separados por linha', () => {
    const r = esquemaPergunta.safeParse({
      ...valido,
      depende_de: 'mais_de_um_evento_dia',
      depende_valor: 'sim',
    })
    expect(r.success && r.data.depende_valor).toEqual(['sim'])
  })

  it('condicao sem pergunta de origem ignora os valores', () => {
    const r = esquemaPergunta.safeParse({ ...valido, depende_de: '', depende_valor: 'sim' })
    expect(r.success && r.data.depende_de).toBeUndefined()
  })
})
```

Acrescentar em `app/admin/[evento]/roteiro/formulario-pergunta.test.tsx`:

```tsx
const outraPergunta: Pergunta = {
  id: 'q9', evento_id: 'e1', chave: 'mais_de_um_evento_dia',
  rotulo: 'Mais de um evento por dia', texto_chat: 'Faz mais de um por dia?',
  tipo: 'sim_nao', escopo: 'inscricao', obrigatoria: false, ordem: 1,
  opcoes: null, ajuda: null, ativa: true, depende_de: null, depende_valor: null,
}

describe('FormularioPergunta e a condicao', () => {
  it('lista as outras perguntas como possiveis gatilhos', () => {
    render(<FormularioPergunta eventoSlug="eng-2026" outras={[outraPergunta]} />)
    expect(
      screen.getByRole('option', { name: /Mais de um evento por dia/ }),
    ).toBeInTheDocument()
  })

  it('a propria pergunta nunca aparece como gatilho dela mesma', () => {
    // O banco recusa (check da migration 009); a tela nem oferece.
    render(
      <FormularioPergunta eventoSlug="eng-2026" pergunta={outraPergunta} outras={[outraPergunta]} />,
    )
    expect(
      screen.queryByRole('option', { name: /Mais de um evento por dia/ }),
    ).not.toBeInTheDocument()
  })

  it('sem outras perguntas, nao oferece condicao', () => {
    render(<FormularioPergunta eventoSlug="eng-2026" outras={[]} />)
    expect(screen.queryByLabelText(/só perguntar se/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "perguntas|formulario-pergunta"`
Expected: FAIL — `depende_de` não existe no esquema; `outras` não é prop.

- [ ] **Step 3: Estender o esquema em `lib/perguntas.ts`**

Dentro de `z.object({...})`, antes do `})`:

```typescript
    depende_de: z.string().trim().optional(),
    depende_valor: z.string().optional().default(''),
```

E depois do `.refine` existente, encadear:

```typescript
  .transform((d) => ({
    ...d,
    // Sem pergunta de origem, os valores não significam nada.
    depende_de: d.depende_de || undefined,
    depende_valor: d.depende_de
      ? d.depende_valor
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean)
      : undefined,
  }))
```

E gravar os dois campos em `criarPergunta` e `atualizarPergunta`, dentro do objeto passado ao `insert`/`update`:

```typescript
      depende_de: entrada.depende_de ?? null,
      depende_valor: entrada.depende_valor ?? null,
```

- [ ] **Step 4: Estender o formulário**

Em `formulario-pergunta.tsx`, acrescentar `outras` à assinatura:

```tsx
export function FormularioPergunta({
  eventoSlug,
  pergunta,
  outras,
}: {
  eventoSlug: string
  pergunta?: Pergunta
  outras: Pergunta[]
}) {
```

E, antes do checkbox de obrigatória, o bloco:

```tsx
      {outras.filter((o) => o.id !== pergunta?.id).length > 0 ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Só perguntar se…</span>
            <select
              name="depende_de"
              defaultValue={pergunta?.depende_de ?? ''}
              className="rounded border px-3 py-2"
            >
              <option value="">Sempre perguntar</option>
              {outras
                .filter((o) => o.id !== pergunta?.id)
                .map((o) => (
                  <option key={o.id} value={o.chave}>
                    {o.rotulo}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">…for respondida com</span>
            <textarea
              name="depende_valor"
              defaultValue={
                Array.isArray(pergunta?.depende_valor)
                  ? (pergunta.depende_valor as string[]).join('\n')
                  : ''
              }
              rows={2}
              className="rounded border px-3 py-2 font-mono text-sm"
            />
            <span className="text-xs text-neutral-500">
              Um valor por linha. Para sim ou não, escreva <code>sim</code> ou{' '}
              <code>nao</code>. Para uma seleção, a chave da opção. Deixando em branco,
              basta que a outra pergunta tenha sido respondida.
            </span>
          </label>
        </>
      ) : null}
```

- [ ] **Step 5: Passar as outras perguntas**

Em `app/admin/[evento]/roteiro/page.tsx`, trocar:

```tsx
        <FormularioPergunta eventoSlug={slug} />
```

por:

```tsx
        <FormularioPergunta eventoSlug={slug} outras={perguntas} />
```

E em `lista-perguntas.tsx`, mostrar a condição, acrescentando depois do trecho de `obrigatoria`:

```tsx
          {p.depende_de ? (
            <span className="text-xs text-neutral-500">
              só se <code>{p.depende_de}</code>
            </span>
          ) : null}
```

- [ ] **Step 6: A prévia precisa avisar sobre as condicionais**

Sem resposta nenhuma, a condição nunca é satisfeita — então na prévia do admin
as perguntas condicionais **somem**. Quem acabou de cadastrar uma acharia que
não funcionou.

Escrever o teste, em `app/admin/[evento]/roteiro/previa-roteiro.test.tsx`:

```tsx
describe('PreviaRoteiro e as condicionais', () => {
  const gatilho: Pergunta = {
    id: 'q1', evento_id: 'e1', chave: 'faz_mais', rotulo: 'Faz mais de um?',
    texto_chat: 'Faz mais de um evento por dia?', tipo: 'sim_nao',
    escopo: 'inscricao', obrigatoria: false, ordem: 1, opcoes: null,
    ajuda: null, ativa: true, depende_de: null, depende_valor: null,
  }
  const condicional: Pergunta = {
    ...gatilho, id: 'q2', chave: 'quantos', rotulo: 'Quantos?',
    texto_chat: 'Quantos no mesmo dia?', tipo: 'numero', ordem: 2,
    depende_de: 'faz_mais', depende_valor: ['sim'],
  }

  it('avisa que existem perguntas que dependem de resposta', () => {
    render(
      <PreviaRoteiro
        passos={expandirRoteiro([gatilho, condicional], 1)}
        vagas={1}
        condicionais={[condicional]}
      />,
    )
    expect(screen.getByText(/dependem de uma resposta/i)).toBeInTheDocument()
    expect(screen.getByText(/Quantos\?/)).toBeInTheDocument()
  })

  it('sem condicionais, nao mostra o aviso', () => {
    render(
      <PreviaRoteiro passos={expandirRoteiro([gatilho], 1)} vagas={1} condicionais={[]} />,
    )
    expect(screen.queryByText(/dependem de uma resposta/i)).not.toBeInTheDocument()
  })
})
```

Rodar: `npm test -- previa-roteiro` → FAIL, `condicionais` não é prop.

Em `previa-roteiro.tsx`, acrescentar a prop e o bloco:

```tsx
export function PreviaRoteiro({
  passos,
  vagas,
  condicionais,
}: {
  passos: Passo[]
  vagas: number
  condicionais: Pergunta[]
}) {
```

com o import `import type { Pergunta } from '@/lib/supabase/tipos'`, e antes do
`</div>` final:

```tsx
      {condicionais.length > 0 ? (
        <div className="rounded border border-dashed p-3 text-sm">
          <p className="mb-1 font-medium">
            Estas dependem de uma resposta e só aparecem na hora:
          </p>
          <ul className="text-neutral-600">
            {condicionais.map((p) => (
              <li key={p.id}>
                {p.texto_chat} <span className="text-xs">— só se {p.depende_de}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
```

E em `page.tsx`, passar:

```tsx
        <PreviaRoteiro
          passos={expandirRoteiro(perguntas, vagas)}
          vagas={vagas}
          condicionais={perguntas.filter((p) => p.ativa && p.depende_de)}
        />
```

- [ ] **Step 7: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add lib/perguntas.ts lib/perguntas.test.ts "app/admin/[evento]/roteiro"
git commit -m "feat: condicao entre perguntas no editor de roteiro"
```

---

### Task 5: A copy da Lara e o fechamento

**Files:**
- Modify: `app/checkin/[token]/conversa.tsx`, `app/checkin/[token]/page.tsx`, `lib/checkin.ts`, `app/admin/[evento]/acoes.ts`, `app/admin/[evento]/formulario-evento.tsx`
- Create: `lib/encerramento.ts`
- Test: `lib/encerramento.test.ts`, `app/checkin/[token]/conversa.test.tsx`

**Interfaces:**
- Produces:
  - `montarEncerramento(evento: { data: string | null; horario: string | null; local: string | null; texto_encerramento: string | null }): string`
  - `EstadoSerializado` ganha `encerramento: string`

- [ ] **Step 1: Escrever o teste**

Criar `lib/encerramento.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { montarEncerramento } from './encerramento'

describe('montarEncerramento', () => {
  it('monta com data, horario e local', () => {
    const texto = montarEncerramento({
      data: '2026-08-11',
      horario: '9h às 19h',
      local: 'Rua Gualaxo, 285 - Paraíso (Tênis Clube Paulista)',
      texto_encerramento: null,
    })
    expect(texto).toContain('11/08/2026')
    expect(texto).toContain('9h às 19h')
    expect(texto).toContain('Rua Gualaxo, 285')
  })

  it('omite a linha do campo que estiver vazio', () => {
    // Melhor faltar uma linha do que mostrar "Horário: null".
    const texto = montarEncerramento({
      data: '2026-08-11', horario: null, local: null, texto_encerramento: null,
    })
    expect(texto).not.toMatch(/Horário/i)
    expect(texto).not.toMatch(/Local/i)
    expect(texto).not.toMatch(/null/)
  })

  it('o texto livre do evento substitui tudo', () => {
    // Quando o operador escreve o encerramento, e ele que vale.
    const texto = montarEncerramento({
      data: '2026-08-11', horario: '9h', local: 'Rua X',
      texto_encerramento: 'Nos vemos lá!',
    })
    expect(texto).toBe('Nos vemos lá!')
  })

  it('evento sem nada devolve string vazia', () => {
    expect(
      montarEncerramento({ data: null, horario: null, local: null, texto_encerramento: null }),
    ).toBe('')
  })
})
```

Acrescentar em `app/checkin/[token]/conversa.test.tsx`:

```tsx
describe('Conversa e a copy da Lara', () => {
  it('a abertura se apresenta como Lara', () => {
    render(<Conversa token="t" estado={estado(0)} />)
    expect(screen.getByText(/Eu sou Lara/)).toBeInTheDocument()
  })

  it('a abertura diz que a inscricao ja esta confirmada', () => {
    render(<Conversa token="t" estado={estado(0)} />)
    expect(screen.getByText(/inscrição já está confirmada/i)).toBeInTheDocument()
  })

  it('a abertura promete menos de 5 minutos', () => {
    render(<Conversa token="t" estado={estado(0)} />)
    expect(screen.getByText(/menos de 5 minutos/i)).toBeInTheDocument()
  })

  it('o check-in concluido mostra o encerramento do evento', () => {
    render(
      <Conversa
        token="t"
        estado={{ ...estado(0), concluida: true, encerramento: 'Data: 11/08/2026' }}
      />,
    )
    expect(screen.getByText(/Data: 11\/08\/2026/)).toBeInTheDocument()
  })
})
```

E acrescentar `encerramento: ''` ao objeto devolvido pelo helper `estado()` desse arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "encerramento|conversa"`
Expected: FAIL — módulo não existe; a abertura não menciona Lara.

- [ ] **Step 3: Implementar `lib/encerramento.ts`**

```typescript
interface DadosDoEvento {
  data: string | null
  horario: string | null
  local: string | null
  texto_encerramento: string | null
}

function dataEmPortugues(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * A mensagem final do Typebot traz data, horário e local escritos à mão.
 * Aqui eles vêm do evento — trocar o endereço deixa de exigir mexer em
 * código.
 */
export function montarEncerramento(evento: DadosDoEvento): string {
  // Texto livre vence: quando o operador escreve o encerramento, é ele que
  // vale, inteiro.
  if (evento.texto_encerramento?.trim()) return evento.texto_encerramento.trim()

  const linhas: string[] = []
  if (evento.data) linhas.push(`Data: ${dataEmPortugues(evento.data)}`)
  if (evento.horario) linhas.push(`Horário: ${evento.horario}`)
  if (evento.local) linhas.push(`Local: ${evento.local}`)

  return linhas.join('\n')
}
```

- [ ] **Step 4: Acrescentar `encerramento` ao estado**

Em `lib/checkin.ts`, dentro de `EstadoSerializado`, depois de `concluida`:

```typescript
  /** Data, horário e local montados a partir do evento. */
  encerramento: string
```

- [ ] **Step 5: Trocar a copy em `conversa.tsx`**

Trocar a constante `abertura` por:

```tsx
  const abertura = [
    `Olá! Eu sou Lara, a assistente virtual da Regra 3.`,
    `A inscrição já está confirmada.`,
    `Esse é um formulário de check-in para providenciarmos as credenciais e conhecer melhor você, ${estado.nomeTitular}.`,
    `Será bem rápido, menos de 5 minutos. ⏱`,
    `Ao chegar, o nome estará na lista de presença e o crachá será retirado na entrada do treinamento.`,
  ].join('\n\n')
```

E trocar o `<p className="text-lg">{fala}</p>` por uma versão que respeita as quebras:

```tsx
          <p className="whitespace-pre-line text-lg">{fala}</p>
```

E o bloco de concluída:

```tsx
  if (estado.concluida) {
    return (
      <div className="flex flex-col gap-4 rounded border p-6">
        <p className="text-lg font-medium">
          Ótimo, agradecemos por todas as informações. O check-in está confirmado.
        </p>
        {estado.encerramento ? (
          <div className="whitespace-pre-line rounded bg-neutral-50 p-4 text-sm">
            📍 Lembrando as informações principais do treinamento:{'\n'}
            {estado.encerramento}
          </div>
        ) : null}
        <p className="text-sm text-neutral-600">
          Ao chegar, o nome estará na lista de presença e o crachá será retirado na entrada.
        </p>
      </div>
    )
  }
```

- [ ] **Step 6: Preencher em `page.tsx`**

Trocar o `select` do evento — hoje `carregarPorToken` só devolve `inscricao`. Acrescentar a busca do evento em `app/checkin/[token]/page.tsx`, depois de `carregarPorToken`:

```tsx
  const cliente = criarClienteAdmin()
  const { data: evento } = await cliente
    .from('eventos')
    .select('data, horario, local, texto_encerramento')
    .eq('id', estado.inscricao.evento_id)
    .maybeSingle()
```

E trocar a criação do cliente no topo para reaproveitar:

```tsx
  const cliente = criarClienteAdmin()
  const estado = await carregarPorToken(cliente, token)
```

E acrescentar ao objeto `estado={{...}}`:

```tsx
          encerramento: montarEncerramento(
            evento ?? { data: null, horario: null, local: null, texto_encerramento: null },
          ),
```

com o import:

```tsx
import { montarEncerramento } from '@/lib/encerramento'
```

- [ ] **Step 6b: Acrescentar os campos ao tipo `Evento`**

Em `lib/supabase/tipos.ts`, dentro de `interface Evento`, antes de `ativo`:

```typescript
  /** "9h às 19h" — texto livre, o formato varia por evento. */
  horario: string | null
  /** Quando preenchido, substitui a mensagem montada de data/horário/local. */
  texto_encerramento: string | null
```

Isso evita espalhar `as Evento & { horario: … }` pelas telas.

- [ ] **Step 7: Deixar o admin editar os campos**

Em `app/admin/[evento]/acoes.ts`, acrescentar ao `esquemaEvento`:

```typescript
  horario: z.string().trim().optional(),
  texto_encerramento: z.string().trim().optional(),
```

e ao objeto passado a `criarEvento` — mas `criarEvento` não conhece esses campos. Em vez de estendê-la, acrescentar uma ação nova no mesmo arquivo:

```typescript
export async function acaoAtualizarEncerramento(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const slug = String(form.get('evento_slug') ?? '')
  const horario = String(form.get('horario') ?? '').trim()
  const local = String(form.get('local') ?? '').trim()
  const texto = String(form.get('texto_encerramento') ?? '').trim()

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('eventos')
    .update({
      horario: horario || null,
      local: local || null,
      texto_encerramento: texto || null,
    })
    .eq('slug', slug)

  if (error) return { erro: error.message }
  revalidatePath(`/admin/${slug}`)
}
```

E em `app/admin/[evento]/page.tsx`, uma seção com o formulário:

```tsx
      <section className="max-w-xl">
        <h2 className="mb-3 text-lg font-semibold">Mensagem de encerramento</h2>
        <p className="mb-3 text-sm text-neutral-600">
          É o que a Lara mostra quando o check-in termina. Deixando o texto livre em branco,
          ela monta a partir da data, do horário e do local.
        </p>
        <FormularioEncerramento
          eventoSlug={slug}
          horario={(atual as Evento).horario ?? ''}
          local={(atual as Evento).local ?? ''}
          textoEncerramento={(atual as Evento).texto_encerramento ?? ''}
        />
      </section>
```

com o componente `app/admin/[evento]/formulario-encerramento.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { acaoAtualizarEncerramento, type ResultadoForm } from './acoes'

export function FormularioEncerramento({
  eventoSlug,
  horario,
  local,
  textoEncerramento,
}: {
  eventoSlug: string
  horario: string
  local: string
  textoEncerramento: string
}) {
  const [resultado, acao, salvando] = useActionState<ResultadoForm, FormData>(
    acaoAtualizarEncerramento,
    undefined,
  )

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="evento_slug" value={eventoSlug} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Horário</span>
        <input
          name="horario"
          defaultValue={horario}
          placeholder="9h às 19h"
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Local</span>
        <input
          name="local"
          defaultValue={local}
          placeholder="Rua Gualaxo, 285 - Paraíso (Tênis Clube Paulista)"
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Texto livre (opcional)</span>
        <textarea
          name="texto_encerramento"
          defaultValue={textoEncerramento}
          rows={4}
          className="rounded border px-3 py-2"
        />
        <span className="text-xs text-neutral-500">
          Preenchendo isto, ele substitui a mensagem montada automaticamente.
        </span>
      </label>

      {resultado?.erro ? (
        <p role="alert" className="text-sm text-red-600">
          {resultado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={salvando}
        className="self-start rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  )
}
```

E acrescentar ao `select` de `app/admin/[evento]/page.tsx` os campos novos, trocando a constante `COLUNAS`:

```tsx
const COLUNAS =
  'id, nome, slug, prefixo_codigo, data, local, ativo, horario, texto_encerramento'
```

- [ ] **Step 8: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add lib/encerramento.ts lib/encerramento.test.ts lib/checkin.ts "app/checkin" "app/admin/[evento]"
git commit -m "feat: copy da lara e encerramento montado a partir do evento"
```

---

### Task 6: Seed das 22 perguntas

**Files:**
- Create: `supabase/seeds/roteiro-engrenagem.sql`
- Test: `lib/supabase/seed-roteiro.test.ts`

**Interfaces:**
- Consumes: `perguntas` com os campos da Task 2

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/seed-roteiro.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/seeds/roteiro-engrenagem.sql'),
  'utf-8',
)

describe('seed do roteiro da Engrenagem', () => {
  it('cria as sete notas de dificuldade', () => {
    // Batem uma a uma com as sete colunas de nota da planilha.
    for (const chave of [
      'dif_expectativas', 'dif_calculo', 'dif_materiais', 'dif_logistica',
      'dif_planejamento', 'dif_equipe', 'dif_mesas',
    ]) {
      expect(sql).toContain(chave)
    }
  })

  it('a escala das notas e 0 a 5, como na planilha', () => {
    // O enunciado do Typebot diz "de 1 a 5", mas a legenda comeca em 0 e a
    // planilha tem zeros.
    expect(sql).toMatch(/0 = nenhuma dificuldade/i)
    expect(sql).not.toMatch(/1 = nenhuma dificuldade/i)
  })

  it('as tres perguntas condicionais apontam para o gatilho', () => {
    expect(sql).toMatch(/'mais_de_um_evento_dia'/)
    expect(sql).toMatch(/max_eventos_dia/)
    expect(sql).toMatch(/obstaculo_multiplos/)
  })

  it('o cargo tem as duas vozes em cada opcao', () => {
    // Quatro papeis viraram oito strings na planilha porque o Typebot
    // pergunta em voz diferente ao titular e ao acompanhante.
    expect(sql).toMatch(/rotulo_acompanhante/)
  })

  it('e parametrizado pelo slug, nao por id fixo', () => {
    expect(sql).toMatch(/where slug = /i)
  })

  it('pode rodar duas vezes sem duplicar', () => {
    // `unique (evento_id, chave)` recusaria; o `on conflict` deixa o seed
    // ser reaplicado depois de um ajuste.
    expect(sql).toMatch(/on conflict/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- seed-roteiro`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Escrever o seed**

Criar `supabase/seeds/roteiro-engrenagem.sql`. Trocar `'escalada'` pelo slug do evento antes de rodar.

```sql
-- As 22 perguntas do roteiro da Engrenagem, transcritas do Typebot.
-- Ver docs/superpowers/specs/2026-08-19-roteiro-do-typebot.md
--
-- Parametrizado pelo slug: troque na linha abaixo antes de rodar.
-- `on conflict` deixa reaplicar depois de um ajuste, sem duplicar.

with e as (select id from eventos where slug = 'escalada')
insert into perguntas
  (evento_id, chave, rotulo, texto_chat, tipo, escopo, obrigatoria, ordem, opcoes, ajuda,
   depende_de, depende_valor)
select e.id, v.* from e, (values

  -- A primeira linha carrega os casts: sem eles o Postgres nao consegue
  -- inferir o tipo das colunas que comecam com NULL nas linhas seguintes.
  ('cargo'::text, 'Cargo'::text,
   'É você quem faz o planejamento, a organização e a coordenação do evento?'::text,
   'selecao_unica'::tipo_pergunta, 'participante'::escopo_pergunta, true::boolean, 1::int,
   '[{"chave":"faz_tudo","rotulo":"Eu que planejo, organizo, coordeno e faço a comida.","rotulo_acompanhante":"Planeja, organiza, coordena e faz a comida."},
     {"chave":"menos_comida","rotulo":"Só não faço a comida, o restante é comigo.","rotulo_acompanhante":"Só não faz a comida, o restante faz tudo."},
     {"chave":"so_planejamento","rotulo":"Faço o planejamento, mas outra pessoa executa.","rotulo_acompanhante":"Faz o planejamento, mas outra pessoa executa."},
     {"chave":"equipe_faz","rotulo":"A equipe faz todo o trabalho de organização e gestão do evento, eu acompanho e atuo quando necessário.","rotulo_acompanhante":"A equipe faz todo o trabalho de organização e gestão do evento, acompanha e atua quando necessário."},
     {"chave":"administrativo","rotulo":"Sou responsável pela parte administrativa apenas. Outras pessoas organizam o evento.","rotulo_acompanhante":"Responsável pela parte administrativa. Outras pessoas organizam o evento."}]'::jsonb,
   'Escolha a resposta mais próxima da sua realidade.'::text, null::text, null::jsonb),

  ('tempo_buffet', 'Tempo de buffet',
   'Há quanto tempo tem e/ou trabalha com buffet?',
   'texto_curto', 'inscricao', false, 2, null,
   'Queremos conhecer o seu momento para entregar o melhor treinamento. Não divulgaremos as suas informações.',
   null, null),

  ('media_publico', 'Média de público',
   'Qual é a média de público que atende?',
   'selecao_unica', 'inscricao', false, 3,
   '[{"chave":"sem_evento","rotulo":"Não fiz evento ainda"},
     {"chave":"ate_50","rotulo":"Até 50 pessoas"},
     {"chave":"51_250","rotulo":"Entre 51 e 250"},
     {"chave":"251_500","rotulo":"Entre 251 e 500"},
     {"chave":"mais_500","rotulo":"Mais de 500"}]'::jsonb,
   null, null, null),

  ('maior_evento', 'Maior evento',
   'Qual foi o maior número de convidados que atendeu em um evento?',
   'numero', 'inscricao', false, 4, null, null, null, null),

  ('mais_de_um_evento_dia', 'Mais de um evento por dia',
   'Você já faz mais de um evento por dia?',
   'sim_nao', 'inscricao', false, 5, null, null, null, null),

  ('max_eventos_dia', 'Máximo de eventos no dia',
   'Qual foi o máximo de eventos que realizou em um mesmo dia?',
   'numero', 'inscricao', false, 6, null, null,
   'mais_de_um_evento_dia', '["sim"]'::jsonb),

  ('qualidade_multiplos', 'Qualidade com múltiplos eventos',
   'De 1 a 10, como fica a qualidade da entrega quando faz mais do que um evento?',
   'numero', 'inscricao', false, 7, null, null,
   'mais_de_um_evento_dia', '["sim"]'::jsonb),

  ('obstaculo_multiplos', 'Obstáculo para múltiplos eventos',
   'Qual o maior obstáculo que impede você de realizar mais de 1 evento no mesmo dia?',
   'texto_longo', 'inscricao', false, 8, null, null,
   'mais_de_um_evento_dia', '["nao"]'::jsonb),

  ('tipos_eventos', 'Tipos de eventos',
   'Quais são os tipos de festas/eventos que você faz?',
   'selecao_multipla', 'inscricao', false, 9,
   '[{"chave":"casamento","rotulo":"Casamento"},
     {"chave":"aniversarios","rotulo":"Aniversários"},
     {"chave":"corporativo","rotulo":"Corporativo"},
     {"chave":"formatura","rotulo":"Formatura"},
     {"chave":"outros","rotulo":"Outros"}]'::jsonb,
   'Pode marcar mais de uma alternativa, se for o seu caso.', null, null),

  ('tipos_servicos', 'Tipos de serviços',
   'E quais os tipos de serviços que realiza?',
   'selecao_multipla', 'inscricao', false, 10,
   '[{"chave":"coquetel","rotulo":"Coquetel"},
     {"chave":"ilha","rotulo":"Ilha gastronômica/mesa de frios"},
     {"chave":"almoco_jantar","rotulo":"Almoço e jantar buffet"},
     {"chave":"estacoes","rotulo":"Estações gourmet"},
     {"chave":"coffee","rotulo":"Coffee Break"},
     {"chave":"brunch","rotulo":"Brunch"},
     {"chave":"cafe_manha","rotulo":"Café da manhã"},
     {"chave":"outros","rotulo":"Outros"}]'::jsonb,
   null, null, null),

  ('dif_expectativas', 'Dificuldade: expectativas do cliente',
   'Você ou sua equipe sente dificuldade em alinhar com o cliente as expectativas dele e o que você pode oferecer?',
   'nota_estrela', 'inscricao', false, 11, null,
   'Classifique os desafios de logística e organização que encontra no seu trabalho. 0 = nenhuma dificuldade, entre 2 e 4 = alguma dificuldade, 5 = muita dificuldade.',
   null, null),

  ('dif_calculo', 'Dificuldade: cálculo e produção',
   'Cálculo por pessoa, compras e produção dos alimentos.',
   'nota_estrela', 'inscricao', false, 12, null, null, null, null),

  ('dif_materiais', 'Dificuldade: materiais',
   'Escolha e organização dos materiais.',
   'nota_estrela', 'inscricao', false, 13, null, null, null, null),

  ('dif_logistica', 'Dificuldade: logística',
   'Logística de transporte.',
   'nota_estrela', 'inscricao', false, 14, null, null, null, null),

  ('dif_planejamento', 'Dificuldade: planejamento',
   'Planejamento e organização do evento com checklists, manuais e cronogramas.',
   'nota_estrela', 'inscricao', false, 15, null,
   'Estamos quase acabando, essas são as últimas classificações.',
   null, null),

  ('dif_equipe', 'Dificuldade: equipe',
   'Coordenação da equipe. Alinhar funções e delegar.',
   'nota_estrela', 'inscricao', false, 16, null, null, null, null),

  ('dif_mesas', 'Dificuldade: montagem de mesas',
   'Técnicas e criatividade para a montagem de mesas.',
   'nota_estrela', 'inscricao', false, 17, null, null, null, null),

  ('expectativa', 'Expectativa',
   'Antes de concluirmos, escreva em uma frase o que deseja alcançar após o treinamento.',
   'texto_longo', 'inscricao', false, 18, null, null, null, null)

) as v(chave, rotulo, texto_chat, tipo, escopo, obrigatoria, ordem, opcoes, ajuda,
       depende_de, depende_valor)
on conflict (evento_id, chave) do update set
  rotulo = excluded.rotulo,
  texto_chat = excluded.texto_chat,
  tipo = excluded.tipo,
  obrigatoria = excluded.obrigatoria,
  ordem = excluded.ordem,
  opcoes = excluded.opcoes,
  ajuda = excluded.ajuda,
  depende_de = excluded.depende_de,
  depende_valor = excluded.depende_valor;
```

- [ ] **Step 4: Rodar o teste, aplicar e commitar**

Run: `npm test -- seed-roteiro` → PASS, 6 testes.

Colar o arquivo no SQL Editor, trocando o slug se necessário.

```bash
git add supabase/seeds/roteiro-engrenagem.sql lib/supabase/seed-roteiro.test.ts
git commit -m "feat: seed das 22 perguntas do roteiro da engrenagem"
```

---

## Verificação final no navegador

Limpe o `.next` antes, se mexeu em código de cliente.

1. `/admin/<evento>/roteiro` — as 18 perguntas cadastradas aparecem na ordem, e as três condicionais mostram **"só se `mais_de_um_evento_dia`"**
2. Na prévia com 2 vagas: **Cargo aparece duas vezes**, as demais uma vez
3. `/admin/<evento>` — preencher **Horário** `9h às 19h` e **Local** `Rua Gualaxo, 285 - Paraíso (Tênis Clube Paulista)`
4. Criar uma inscrição de 1 vaga e abrir o link do check-in
5. A abertura diz **"Eu sou Lara"**, "A inscrição já está confirmada" e "menos de 5 minutos"
6. Responder até "Você já faz mais de um evento por dia?" e escolher **Sim** → as próximas são "máximo de eventos" e "qualidade da entrega"; **"o maior obstáculo" não aparece**
7. Voltar pela revisão, corrigir para **Não** → agora aparece "o maior obstáculo", e as outras duas somem
8. Concluir → a mensagem final traz **Data**, **Horário** e **Local** preenchidos

O passo 7 é o que prova a ramificação: o roteiro se refaz conforme a resposta muda.

## O que a Fatia E entrega

A conversa da Lara igual à do Typebot — ramificação, copy e fechamento — com as perguntas cadastradas e editáveis pela tela.

## Deixado de fora

- **Condição composta** (E/OU entre duas perguntas). O Typebot não usa; uma condição por pergunta cobre o roteiro atual.
- **Condição sobre campo do núcleo** (nome, email, crachá). Só perguntas cadastradas servem de gatilho.
- **Clonar o roteiro de outro evento.** Continua valendo a pena depois do segundo evento — o seed resolve o primeiro.
