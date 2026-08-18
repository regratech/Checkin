# Check-in R3 — Fatia A (Fundação) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ter o banco do Check-in R3 de pé — sete tabelas, RLS, código legível de inscrição e a view da tabela geral — mais as funções de servidor que criam um evento e uma inscrição manual com seus participantes.

**Architecture:** Next.js 16 App Router com Supabase Postgres. As migrations são arquivos SQL numerados, aplicados à mão pelo SQL Editor (mesmo processo do projeto Engrenagem). A lógica de identidade (normalizar email e nome para achar a mesma pessoa entre eventos) vive em funções puras de TypeScript, testadas isoladamente. As migrations são testadas por asserção sobre o texto do SQL — não há banco de teste, é o padrão já usado no Engrenagem.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript strict, Tailwind 4, zod 4, `@supabase/ssr` + `@supabase/supabase-js`, vitest 4 com jsdom.

## Global Constraints

- **Diretório do projeto:** `C:\Users\regra\Downloads\Checkin R3`. O repositório git já existe e já contém `docs/superpowers/`.
- **Spec de referência:** `docs/superpowers/specs/2026-08-18-checkin-r3-design.md`. Toda estrutura de tabela vem de lá.
- **Idioma do código:** nomes de tabela, coluna, função, variável e teste em **português**, `snake_case` no SQL e `camelCase` no TypeScript. Mensagens de commit em português.
- **Estilo TypeScript:** sem ponto e vírgula no fim das linhas, aspas simples, `import type` quando for só tipo. É o estilo do projeto Engrenagem, que este espelha.
- **Migrations:** arquivos em `supabase/migrations/`, numerados `NNN_nome.sql`, aplicados **manualmente** pelo SQL Editor do Supabase. Nunca gerar migration por CLI. Cada migration deve poder ser colada inteira de uma vez.
- **Chave de identidade de pessoa:** `(email, nome_chave)` — nunca só email. Ver justificativa na seção 3.2 do spec.
- **Escala de nota:** as perguntas de auto-avaliação vão de **0 a 5**, não de 1 a 5.
- **Next.js 16 tem mudanças de API em relação a versões anteriores.** Antes de escrever qualquer código de rota, layout ou Server Action, ler o guia correspondente em `node_modules/next/dist/docs/01-app/`. O `AGENTS.md` gerado pelo `next dev` reforça isso; commitá-lo junto com o trabalho mantém a árvore limpa.
- **`SUPABASE_SERVICE_ROLE_KEY` nunca pode ser importada em código que roda no navegador.** Só em arquivos com `import 'server-only'` ou Server Actions.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/001_schema.sql` | Enums e as sete tabelas |
| `supabase/migrations/002_rls.sql` | RLS e políticas em todas as tabelas |
| `supabase/migrations/003_codigo_inscricao.sql` | Função que gera `ENG26-0042` de forma sequencial e segura |
| `supabase/migrations/004_view_participantes.sql` | `vw_participantes` |
| `lib/supabase/tipos.ts` | Enums do domínio como `as const` + interfaces das linhas |
| `lib/supabase/browser.ts` | Cliente para o navegador |
| `lib/supabase/servidor.ts` | Cliente com cookies + cliente `service_role` |
| `lib/identidade.ts` | Normalização de email e nome; a chave de dedup |
| `lib/eventos.ts` | Criar e listar evento |
| `lib/inscricoes.ts` | Criar inscrição manual com participantes |

Cada arquivo de teste fica ao lado do arquivo testado, com sufixo `.test.ts`.

---

### Task 1: Esqueleto do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `.env.local.example`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Test: `lib/sanidade.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `npm test` funcionando com o alias `@/` apontando para a raiz do projeto.

- [ ] **Step 1: Criar o projeto num subdiretório e trazer para a raiz**

`create-next-app` recusa rodar num diretório que já tem conteúdo desconhecido, e aqui já existem `docs/` e `.git/`. Por isso ele gera num subdiretório temporário e o conteúdo é movido para a raiz:

```bash
cd "/c/Users/regra/Downloads/Checkin R3"
npx --yes create-next-app@16.3.0 _scaffold --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --skip-install
```

```bash
cd "/c/Users/regra/Downloads/Checkin R3"
rm -f _scaffold/README.md
cp -r _scaffold/. .
rm -rf _scaffold
```

Conferir que `app/`, `package.json`, `tsconfig.json` e `next.config.ts` chegaram na raiz e que `docs/` continua lá.

- [ ] **Step 2: Instalar as dependências**

```bash
cd "/c/Users/regra/Downloads/Checkin R3"
npm install
npm install @supabase/ssr @supabase/supabase-js zod server-only
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Configurar o vitest**

Criar `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Criar `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

Adicionar em `package.json`, dentro de `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Criar o `.env.local.example` vazio**

```bash
cd "/c/Users/regra/Downloads/Checkin R3"
printf 'NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nSUPABASE_SERVICE_ROLE_KEY=\n' > .env.local.example
```

Conferir que `.gitignore` contém `.env*.local`. Se não contiver, acrescentar a linha.

- [ ] **Step 5: Escrever o teste de sanidade**

Criar `lib/formato.ts`:

```typescript
/** Corta espaços das pontas e colapsa os repetidos do meio. */
export function limpar(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}
```

Criar `lib/sanidade.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { limpar } from '@/lib/formato'

describe('esqueleto do projeto', () => {
  it('o alias @ resolve para a raiz do projeto', () => {
    expect(limpar('  a   b  ')).toBe('a b')
  })

  it('o exemplo de ambiente tem as tres chaves e nenhuma preenchida', () => {
    const exemplo = readFileSync(resolve(__dirname, '../.env.local.example'), 'utf-8')
    expect(exemplo).toMatch(/^NEXT_PUBLIC_SUPABASE_URL=\s*$/m)
    expect(exemplo).toMatch(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=\s*$/m)
    expect(exemplo).toMatch(/^SUPABASE_SERVICE_ROLE_KEY=\s*$/m)
  })

  it('o gitignore protege o arquivo de ambiente real', () => {
    const ignore = readFileSync(resolve(__dirname, '../.gitignore'), 'utf-8')
    expect(ignore).toMatch(/\.env\*?\.local/)
  })
})
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test`
Expected: PASS, 3 testes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: esqueleto do projeto com next, supabase e vitest"
```

Se o `next dev` tiver rodado e criado ou reescrito o `AGENTS.md`, commitá-lo junto — ele é regerado a cada execução e deixá-lo de fora só recria a alteração pendente.

---

### Task 2: Migration 001 — enums e tabelas

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `lib/supabase/tipos.ts`
- Test: `lib/supabase/tipos.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: as constantes `ORIGENS_INSCRICAO`, `STATUS_CHECKIN`, `ESCOPOS_PERGUNTA`, `TIPOS_PERGUNTA`, `PAPEIS`, `STATUS_SINCRONIZACAO` e os tipos `Evento`, `Pessoa`, `Inscricao`, `Participante`, `Pergunta`, `Resposta`, exportados de `@/lib/supabase/tipos`.

- [ ] **Step 1: Escrever o teste de paridade entre SQL e TypeScript**

Criar `lib/supabase/tipos.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ORIGENS_INSCRICAO,
  STATUS_CHECKIN,
  ESCOPOS_PERGUNTA,
  TIPOS_PERGUNTA,
  PAPEIS,
  STATUS_SINCRONIZACAO,
} from './tipos'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/001_schema.sql'),
  'utf-8',
)

function enumsDoSql(texto: string): Record<string, string[]> {
  const regex = /create type (\w+) as enum \(((?:'[^']*'(?:,\s*)?)+)\);/g
  const encontrados: Record<string, string[]> = {}
  let achado
  while ((achado = regex.exec(texto)) !== null) {
    encontrados[achado[1]] = achado[2]
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
  }
  return encontrados
}

describe('enums do dominio', () => {
  const enums = enumsDoSql(sql)

  it('todo enum do SQL tem uma constante TypeScript igual', () => {
    expect(enums['origem_inscricao']).toEqual(ORIGENS_INSCRICAO)
    expect(enums['status_checkin']).toEqual(STATUS_CHECKIN)
    expect(enums['escopo_pergunta']).toEqual(ESCOPOS_PERGUNTA)
    expect(enums['tipo_pergunta']).toEqual(TIPOS_PERGUNTA)
    expect(enums['papel_usuario']).toEqual(PAPEIS)
    expect(enums['status_sincronizacao']).toEqual(STATUS_SINCRONIZACAO)
  })

  it('o escopo tem exatamente dois valores', () => {
    expect(ESCOPOS_PERGUNTA).toEqual(['inscricao', 'participante'])
  })
})

describe('tabelas da migration 001', () => {
  const tabelas = [
    'perfis',
    'eventos',
    'pessoas',
    'inscricoes',
    'participantes',
    'perguntas',
    'respostas',
    'sincronizacoes',
  ]

  it.each(tabelas)('cria a tabela %s', (tabela) => {
    expect(sql).toMatch(new RegExp(`create table ${tabela} \\(`, 'i'))
  })
})

describe('regras de integridade que o banco precisa garantir', () => {
  it('identidade da pessoa e o par email + nome_chave, nunca so o email', () => {
    // Medido na planilha do ultimo evento: em 7 dos 13 grupos o acompanhante
    // foi cadastrado com o email do titular. Unique so no email fundiria dois
    // seres humanos numa ficha.
    expect(sql).toMatch(/unique \(email, nome_chave\)/i)
    expect(sql).not.toMatch(/email text not null unique/i)
  })

  it('o codigo da inscricao e unico dentro do evento', () => {
    expect(sql).toMatch(/unique \(evento_id, codigo\)/i)
  })

  it('a transacao do guru nao pode entrar duas vezes', () => {
    expect(sql).toMatch(/unique \(evento_id, guru_transacao_id\)/i)
  })

  it('cada ordem de participante e unica dentro da inscricao', () => {
    expect(sql).toMatch(/unique \(inscricao_id, ordem\)/i)
  })

  it('perguntas tem chave estavel unica por evento', () => {
    expect(sql).toMatch(/unique \(evento_id, chave\)/i)
  })

  it('perguntas tem unique em (id, escopo) para a FK composta de respostas', () => {
    expect(sql).toMatch(/unique \(id, escopo\)/i)
  })

  it('resposta de escopo participante exige participante_id, e o contrario o proibe', () => {
    expect(sql).toMatch(/\(escopo = 'participante'\) = \(participante_id is not null\)/i)
  })

  it('resposta aponta para pergunta pela FK composta, travando o escopo', () => {
    expect(sql).toMatch(/foreign key \(pergunta_id, escopo\) references perguntas \(id, escopo\)/i)
  })

  it('vagas e sempre positivo', () => {
    expect(sql).toMatch(/vagas int not null check \(vagas >= 1\)/i)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- tipos`
Expected: FAIL — `Cannot find module './tipos'`.

- [ ] **Step 3: Escrever a migration 001**

Criar `supabase/migrations/001_schema.sql`:

```sql
create type papel_usuario as enum ('publico', 'admin');
create type origem_inscricao as enum ('webhook', 'api', 'csv', 'manual');
create type status_checkin as enum ('pendente', 'em_andamento', 'concluido');
create type escopo_pergunta as enum ('inscricao', 'participante');
create type tipo_pergunta as enum (
  'texto_curto', 'texto_longo', 'email', 'telefone', 'numero', 'data',
  'selecao_unica', 'selecao_multipla', 'nota_estrela', 'sim_nao'
);
create type status_sincronizacao as enum ('recebida', 'promovida', 'erro');

create table perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  email text not null,
  papel papel_usuario not null default 'publico',
  criado_em timestamptz not null default now()
);

create table eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  prefixo_codigo text not null,
  proximo_codigo int not null default 1,
  data date,
  local text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Identidade da pessoa entre eventos. A chave e o PAR email + nome_chave.
-- Email sozinho funde pessoas distintas: acompanhantes costumam ser
-- cadastrados com o email do titular (7 dos 13 grupos do ultimo evento).
-- Duplicar e reversivel; fundir dois seres humanos nao e.
create table pessoas (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome_chave text not null,
  nome_recente text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (email, nome_chave)
);

create table inscricoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  codigo text not null,
  pessoa_titular_id uuid references pessoas on delete set null,
  origem origem_inscricao not null,
  guru_transacao_id text,
  guru_payload jsonb,
  email_compra text,
  nome_compra text,
  telefone_compra text,
  valor numeric(10, 2),
  status_pagamento text,
  vagas int not null check (vagas >= 1),
  empresa_nome text,
  empresa_cidade text,
  empresa_instagram text,
  token text not null unique,
  status_checkin status_checkin not null default 'pendente',
  passo_atual text,
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (evento_id, codigo),
  unique (evento_id, guru_transacao_id)
);

create index inscricoes_evento_vagas_idx on inscricoes (evento_id, vagas);

-- Os dados aqui sao um retrato do que foi digitado NAQUELE evento.
-- Nome e telefone nao vem de `pessoas`: acompanhantes sao sempre coletados
-- em branco, entao o dado do evento e o mais recente por definicao.
create table participantes (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references inscricoes on delete cascade,
  pessoa_id uuid not null references pessoas on delete restrict,
  ordem int not null check (ordem >= 1),
  titular boolean not null default false,
  nome text not null,
  email text,
  telefone text,
  data_nascimento date,
  nome_cracha text,
  cargo text,
  criado_em timestamptz not null default now(),
  unique (inscricao_id, ordem)
);

create index participantes_pessoa_idx on participantes (pessoa_id);

create table perguntas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  chave text not null,
  rotulo text not null,
  texto_chat text not null,
  tipo tipo_pergunta not null,
  escopo escopo_pergunta not null,
  obrigatoria boolean not null default false,
  ordem int not null,
  opcoes jsonb,
  ajuda text,
  ativa boolean not null default true,
  criada_em timestamptz not null default now(),
  unique (evento_id, chave),
  unique (id, escopo)
);

create index perguntas_ordem_idx on perguntas (evento_id, ativa, ordem);

-- `escopo` e denormalizado de proposito: com ele a FK composta abaixo
-- impede que uma resposta de escopo `inscricao` carregue participante_id,
-- e vice-versa. Sem isso a regra so existiria no codigo da aplicacao.
create table respostas (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null,
  escopo escopo_pergunta not null,
  inscricao_id uuid not null references inscricoes on delete cascade,
  participante_id uuid references participantes on delete cascade,
  valor jsonb not null,
  respondido_em timestamptz not null default now(),
  foreign key (pergunta_id, escopo) references perguntas (id, escopo) on delete cascade,
  check ((escopo = 'participante') = (participante_id is not null)),
  unique (pergunta_id, inscricao_id, participante_id)
);

create index respostas_inscricao_idx on respostas (inscricao_id);

create table sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  origem origem_inscricao not null,
  recebido_em timestamptz not null default now(),
  payload jsonb not null,
  status status_sincronizacao not null default 'recebida',
  erro text,
  inscricao_id uuid references inscricoes on delete set null
);

create index sincronizacoes_triagem_idx on sincronizacoes (evento_id, status, recebido_em);
```

- [ ] **Step 4: Escrever os tipos TypeScript**

Criar `lib/supabase/tipos.ts`:

```typescript
export const PAPEIS = ['publico', 'admin'] as const
export const ORIGENS_INSCRICAO = ['webhook', 'api', 'csv', 'manual'] as const
export const STATUS_CHECKIN = ['pendente', 'em_andamento', 'concluido'] as const
export const ESCOPOS_PERGUNTA = ['inscricao', 'participante'] as const
export const TIPOS_PERGUNTA = [
  'texto_curto',
  'texto_longo',
  'email',
  'telefone',
  'numero',
  'data',
  'selecao_unica',
  'selecao_multipla',
  'nota_estrela',
  'sim_nao',
] as const
export const STATUS_SINCRONIZACAO = ['recebida', 'promovida', 'erro'] as const

export type Papel = (typeof PAPEIS)[number]
export type OrigemInscricao = (typeof ORIGENS_INSCRICAO)[number]
export type StatusCheckin = (typeof STATUS_CHECKIN)[number]
export type EscopoPergunta = (typeof ESCOPOS_PERGUNTA)[number]
export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number]
export type StatusSincronizacao = (typeof STATUS_SINCRONIZACAO)[number]

export interface Evento {
  id: string
  nome: string
  slug: string
  /** Prefixo do codigo legivel das inscricoes, ex.: `ENG26`. */
  prefixo_codigo: string
  data: string | null
  local: string | null
  ativo: boolean
}

export interface Pessoa {
  id: string
  email: string
  /** Nome normalizado. Junto com o email forma a chave de identidade. */
  nome_chave: string
  /** Ultimo nome visto. Serve para busca, nao e fonte de verdade. */
  nome_recente: string
}

export interface Inscricao {
  id: string
  evento_id: string
  /** Codigo legivel, ex.: `ENG26-0042`. Unico dentro do evento. */
  codigo: string
  pessoa_titular_id: string | null
  origem: OrigemInscricao
  guru_transacao_id: string | null
  email_compra: string | null
  nome_compra: string | null
  telefone_compra: string | null
  vagas: number
  empresa_nome: string | null
  empresa_cidade: string | null
  empresa_instagram: string | null
  token: string
  status_checkin: StatusCheckin
  passo_atual: string | null
  concluido_em: string | null
}

export interface Participante {
  id: string
  inscricao_id: string
  pessoa_id: string
  ordem: number
  titular: boolean
  nome: string
  email: string | null
  telefone: string | null
  data_nascimento: string | null
  nome_cracha: string | null
  cargo: string | null
}

export interface Pergunta {
  id: string
  evento_id: string
  chave: string
  rotulo: string
  texto_chat: string
  tipo: TipoPergunta
  escopo: EscopoPergunta
  obrigatoria: boolean
  ordem: number
  opcoes: unknown
  ajuda: string | null
  ativa: boolean
}

export interface Resposta {
  id: string
  pergunta_id: string
  escopo: EscopoPergunta
  inscricao_id: string
  participante_id: string | null
  valor: unknown
}
```

- [ ] **Step 5: Rodar o teste**

Run: `npm test -- tipos`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/001_schema.sql lib/supabase/tipos.ts lib/supabase/tipos.test.ts
git commit -m "feat: schema do banco com as sete tabelas do check-in"
```

---

### Task 3: Normalização de identidade

**Files:**
- Create: `lib/identidade.ts`
- Test: `lib/identidade.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `normalizarEmail(bruto: string): string`, `normalizarNome(bruto: string): string`, `chaveIdentidade(email: string, nome: string): { email: string; nome_chave: string }` — todos exportados de `@/lib/identidade`.

- [ ] **Step 1: Escrever os testes**

Criar `lib/identidade.test.ts`. Os casos vêm de dados reais do último evento.

```typescript
import { describe, it, expect } from 'vitest'
import { normalizarEmail, normalizarNome, chaveIdentidade } from './identidade'

describe('normalizarEmail', () => {
  it('baixa a caixa', () => {
    expect(normalizarEmail('Regina@Hotmail.com')).toBe('regina@hotmail.com')
  })

  it('remove espacos nas pontas', () => {
    expect(normalizarEmail('  zedanyrj@gmail.com  ')).toBe('zedanyrj@gmail.com')
  })

  it('preserva hifen e ponto do endereco', () => {
    expect(normalizarEmail('GUI-LHERMETOLEDO@hotmail.com')).toBe(
      'gui-lhermetoledo@hotmail.com',
    )
  })
})

describe('normalizarNome', () => {
  it('baixa a caixa e tira acento', () => {
    expect(normalizarNome('Janaína Garcia Guerrieri')).toBe(
      'janaina garcia guerrieri',
    )
  })

  it('colapsa espacos repetidos e das pontas', () => {
    expect(normalizarNome('  Leonardo   Guerrieri ')).toBe('leonardo guerrieri')
  })

  it('trata cedilha e til', () => {
    expect(normalizarNome('João Paulo Silva')).toBe('joao paulo silva')
    expect(normalizarNome('Conceição')).toBe('conceicao')
  })
})

describe('chaveIdentidade', () => {
  it('separa duas pessoas que compartilham o mesmo email', () => {
    // Caso real: Janaina e Leonardo, ambos sob laguerryeventos@gmail.com.
    // Se a chave fosse so o email, virariam uma pessoa so.
    const janaina = chaveIdentidade(
      'laguerryeventos@gmail.com',
      'Janaína Garcia Guerrieri',
    )
    const leonardo = chaveIdentidade(
      'laguerryeventos@gmail.com',
      'Leonardo Guerrieri',
    )
    expect(janaina.email).toBe(leonardo.email)
    expect(janaina.nome_chave).not.toBe(leonardo.nome_chave)
  })

  it('reconhece a mesma pessoa em eventos diferentes', () => {
    const antes = chaveIdentidade('Cenise@bol.com.br ', 'Cenise Jonsson')
    const depois = chaveIdentidade('cenise@bol.com.br', ' cenise  jonsson')
    expect(antes).toEqual(depois)
  })

  it('nome escrito diferente gera fichas diferentes, de proposito', () => {
    // Custo assumido no spec: duplicar e reversivel, fundir nao e.
    const completo = chaveIdentidade('r@x.com', 'Regina De Morais Pereira')
    const curto = chaveIdentidade('r@x.com', 'Regina Morais')
    expect(completo.nome_chave).not.toBe(curto.nome_chave)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- identidade`
Expected: FAIL — `Cannot find module './identidade'`.

- [ ] **Step 3: Implementar**

Criar `lib/identidade.ts`:

```typescript
/**
 * A identidade de uma pessoa entre eventos e o PAR email + nome normalizado.
 *
 * Email sozinho nao serve: no ultimo evento, 7 dos 13 grupos cadastraram o
 * acompanhante com o email do titular. Chavear so por email fundiria dois
 * seres humanos num registro, e isso nao se desfaz depois. Duplicar por
 * variacao de escrita do nome, sim, se desfaz.
 */
export function normalizarEmail(bruto: string): string {
  return bruto.trim().toLowerCase()
}

export function normalizarNome(bruto: string): string {
  return bruto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function chaveIdentidade(
  email: string,
  nome: string,
): { email: string; nome_chave: string } {
  return {
    email: normalizarEmail(email),
    nome_chave: normalizarNome(nome),
  }
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- identidade`
Expected: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/identidade.ts lib/identidade.test.ts
git commit -m "feat: chave de identidade por email mais nome normalizado"
```

---

### Task 4: Migration 002 — RLS

**Files:**
- Create: `supabase/migrations/002_rls.sql`
- Test: `lib/supabase/rls.test.ts`

**Interfaces:**
- Consumes: as tabelas da Task 2
- Produces: a função SQL `eh_admin()`, usada por todas as políticas.

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/rls.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/002_rls.sql'),
  'utf-8',
)

const tabelas = [
  'perfis',
  'eventos',
  'pessoas',
  'inscricoes',
  'participantes',
  'perguntas',
  'respostas',
  'sincronizacoes',
]

describe('migration 002 - row level security', () => {
  it.each(tabelas)('liga RLS na tabela %s', (tabela) => {
    expect(sql).toMatch(new RegExp(`alter table ${tabela} enable row level security`, 'i'))
  })

  it.each(tabelas)('a tabela %s tem ao menos uma politica', (tabela) => {
    expect(sql).toMatch(new RegExp(`create policy "[^"]+" on ${tabela}`, 'i'))
  })

  it('eh_admin e security definer com search_path fixo', () => {
    // Sem `set search_path`, uma funcao security definer pode ser enganada
    // por uma tabela homonima criada num schema que venha antes no caminho.
    expect(sql).toMatch(/create function eh_admin\(\) returns boolean/i)
    expect(sql).toMatch(/security definer/i)
    expect(sql).toMatch(/set search_path = public/i)
  })

  it('nao existe politica que libere leitura para quem nao esta autenticado', () => {
    // Os dados das inscricoes sao pessoais. O participante nunca le tabela:
    // chega pelo token e as rotas de servidor devolvem so o passo dele.
    expect(sql).not.toMatch(/using \(true\)/i)
  })

  it('perfil nao pode se auto-promover a admin', () => {
    expect(sql).toMatch(/papel = 'publico'/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- rls`
Expected: FAIL — arquivo `002_rls.sql` não existe.

- [ ] **Step 3: Escrever a migration 002**

Criar `supabase/migrations/002_rls.sql`:

```sql
alter table perfis enable row level security;
alter table eventos enable row level security;
alter table pessoas enable row level security;
alter table inscricoes enable row level security;
alter table participantes enable row level security;
alter table perguntas enable row level security;
alter table respostas enable row level security;
alter table sincronizacoes enable row level security;

-- `set search_path` e obrigatorio numa funcao security definer: sem ele
-- alguem pode criar uma tabela `perfis` num schema que venha antes no
-- caminho e a funcao passa a consultar a tabela errada, com privilegio.
create function eh_admin() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from perfis where id = auth.uid() and papel = 'admin'
  );
$$;

-- Perfil: a linha nasce no cadastro e nunca e editada pela aplicacao.
-- Promocao a admin e manual, pelo SQL Editor com service role.
create policy "perfil proprio leitura" on perfis
  for select using (id = auth.uid() or eh_admin());
create policy "perfil proprio insercao" on perfis
  for insert with check (id = auth.uid() and papel = 'publico');

-- Todo o resto do check-in e dado pessoal de terceiros: so admin le.
-- O participante nunca consulta tabela — ele chega pelo token e as rotas
-- de servidor, com service_role, devolvem apenas o passo dele.
create policy "eventos somente admin" on eventos
  for all using (eh_admin()) with check (eh_admin());
create policy "pessoas somente admin" on pessoas
  for all using (eh_admin()) with check (eh_admin());
create policy "inscricoes somente admin" on inscricoes
  for all using (eh_admin()) with check (eh_admin());
create policy "participantes somente admin" on participantes
  for all using (eh_admin()) with check (eh_admin());
create policy "perguntas somente admin" on perguntas
  for all using (eh_admin()) with check (eh_admin());
create policy "respostas somente admin" on respostas
  for all using (eh_admin()) with check (eh_admin());
create policy "sincronizacoes somente admin" on sincronizacoes
  for all using (eh_admin()) with check (eh_admin());
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- rls`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/002_rls.sql lib/supabase/rls.test.ts
git commit -m "feat: RLS em todas as tabelas, leitura so para admin"
```

---

### Task 5: Migration 003 — código legível da inscrição

**Files:**
- Create: `supabase/migrations/003_codigo_inscricao.sql`
- Test: `lib/supabase/codigo.test.ts`

**Interfaces:**
- Consumes: `eventos.prefixo_codigo`, `eventos.proximo_codigo` da Task 2
- Produces: a função SQL `gerar_codigo_inscricao(uuid) returns text`.

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/codigo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/003_codigo_inscricao.sql'),
  'utf-8',
)

describe('migration 003 - codigo legivel da inscricao', () => {
  it('cria a funcao que recebe o evento e devolve texto', () => {
    expect(sql).toMatch(/create function gerar_codigo_inscricao\(p_evento_id uuid\)\s*returns text/i)
  })

  it('incrementa o contador do evento na mesma instrucao que le', () => {
    // Um `select` seguido de `update` permite que duas transacoes leiam o
    // mesmo numero e gerem codigos iguais. `update ... returning` trava a
    // linha do evento e resolve leitura e escrita de uma vez.
    expect(sql).toMatch(/update eventos[\s\S]*set proximo_codigo = proximo_codigo \+ 1[\s\S]*returning/i)
  })

  it('formata com quatro digitos e zero a esquerda', () => {
    expect(sql).toMatch(/lpad\(/i)
    expect(sql).toMatch(/'0'/)
    expect(sql).toMatch(/, 4, /)
  })

  it('junta prefixo e numero com hifen', () => {
    expect(sql).toMatch(/\|\| '-' \|\|/)
  })

  it('a funcao e volatile, nunca stable ou immutable', () => {
    // Ela escreve: marcar como stable faria o planejador cachear o
    // resultado e devolver o mesmo codigo duas vezes na mesma query.
    expect(sql).not.toMatch(/language plpgsql\s+stable/i)
    expect(sql).not.toMatch(/language plpgsql\s+immutable/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- codigo`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Escrever a migration 003**

Criar `supabase/migrations/003_codigo_inscricao.sql`:

```sql
-- Gera o codigo legivel da inscricao, ex.: ENG26-0042.
--
-- O contador vive em eventos.proximo_codigo. Ler com `select` e depois
-- gravar com `update` deixaria duas compras simultaneas pegarem o mesmo
-- numero; `update ... returning` trava a linha do evento e resolve leitura
-- e incremento numa instrucao so.
create function gerar_codigo_inscricao(p_evento_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefixo text;
  v_numero int;
begin
  update eventos
    set proximo_codigo = proximo_codigo + 1
    where id = p_evento_id
    returning prefixo_codigo, proximo_codigo - 1
    into v_prefixo, v_numero;

  if v_prefixo is null then
    raise exception 'evento % nao encontrado', p_evento_id;
  end if;

  return v_prefixo || '-' || lpad(v_numero::text, 4, '0');
end;
$$;
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- codigo`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_codigo_inscricao.sql lib/supabase/codigo.test.ts
git commit -m "feat: codigo legivel sequencial por evento"
```

---

### Task 6: Migration 004 — a view da tabela geral

**Files:**
- Create: `supabase/migrations/004_view_participantes.sql`
- Test: `lib/supabase/view.test.ts`

**Interfaces:**
- Consumes: `participantes`, `inscricoes` da Task 2
- Produces: a view `vw_participantes`, com as colunas `codigo_participante`, `vagas` e `pessoas_preenchidas`.

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/view.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/004_view_participantes.sql'),
  'utf-8',
)

describe('migration 004 - vw_participantes', () => {
  it('cria a view', () => {
    expect(sql).toMatch(/create view vw_participantes as/i)
  })

  it('conta as pessoas preenchidas por inscricao com window function', () => {
    // O numero nunca e digitado: e a contagem real das linhas de
    // participantes. E a correcao dos checkboxes "N insc - mesmos dados".
    expect(sql).toMatch(/count\(\*\) over \(partition by p\.inscricao_id\) as pessoas_preenchidas/i)
  })

  it('expoe vagas, que e o numero que define a aba de tamanho de grupo', () => {
    expect(sql).toMatch(/i\.vagas/)
  })

  it('monta o codigo do participante juntando o codigo da inscricao e a ordem', () => {
    expect(sql).toMatch(/i\.codigo \|\| '-' \|\| p\.ordem as codigo_participante/i)
  })

  it('roda com os privilegios de quem consulta, nao os do dono', () => {
    // Sem security_invoker a view ignoraria a RLS das tabelas de baixo.
    expect(sql).toMatch(/security_invoker\s*=\s*(on|true)/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- view`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Escrever a migration 004**

Criar `supabase/migrations/004_view_participantes.sql`:

```sql
-- Uma linha por participante, com os dados do buffet repetidos em cada
-- linha do grupo. E o formato que a operacao hoje monta a mao depois de
-- cada evento; aqui ele sai do join.
--
-- security_invoker: sem isso a view roda com o privilegio de quem a criou
-- e passaria por cima da RLS das tabelas de baixo.
create view vw_participantes
with (security_invoker = on) as
select
  p.id,
  p.inscricao_id,
  p.pessoa_id,
  p.ordem,
  p.titular,
  p.nome,
  p.email,
  p.telefone,
  p.data_nascimento,
  p.nome_cracha,
  p.cargo,
  i.evento_id,
  i.codigo,
  i.vagas,
  i.empresa_nome,
  i.empresa_cidade,
  i.empresa_instagram,
  i.status_checkin,
  i.codigo || '-' || p.ordem as codigo_participante,
  count(*) over (partition by p.inscricao_id) as pessoas_preenchidas
from participantes p
join inscricoes i on i.id = p.inscricao_id;
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- view`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004_view_participantes.sql lib/supabase/view.test.ts
git commit -m "feat: view vw_participantes com contagem e codigo do participante"
```

---

### Task 7: Clientes Supabase e criação de evento

**Files:**
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/servidor.ts`
- Create: `lib/eventos.ts`
- Test: `lib/eventos.test.ts`

**Interfaces:**
- Consumes: `Evento` de `@/lib/supabase/tipos`
- Produces:
  - `criarClienteBrowser()`, `criarClienteServidor()`, `criarClienteAdmin()` de `@/lib/supabase/servidor` e `@/lib/supabase/browser`
  - `slugificar(texto: string): string`
  - `prefixoPadrao(nome: string, ano: number): string`
  - `criarEvento(cliente, entrada: NovoEvento): Promise<Evento>` de `@/lib/eventos`, onde `NovoEvento = { nome: string; data?: string; local?: string; prefixo_codigo?: string }`

- [ ] **Step 1: Escrever os testes**

Criar `lib/eventos.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { slugificar, prefixoPadrao, criarEvento } from './eventos'

describe('slugificar', () => {
  it('baixa a caixa, tira acento e troca espaco por hifen', () => {
    expect(slugificar('Engrenagem São Paulo 2026')).toBe('engrenagem-sao-paulo-2026')
  })

  it('remove pontuacao', () => {
    expect(slugificar('Check-in: Buffets & Cia.')).toBe('check-in-buffets-cia')
  })

  it('nao deixa hifen sobrando nas pontas', () => {
    expect(slugificar('  Engrenagem!  ')).toBe('engrenagem')
  })
})

describe('prefixoPadrao', () => {
  it('junta as tres primeiras letras com os dois digitos do ano', () => {
    expect(prefixoPadrao('Engrenagem', 2026)).toBe('ENG26')
  })

  it('ignora espacos e acentos ao montar as letras', () => {
    expect(prefixoPadrao('Só Buffet', 2027)).toBe('SOB27')
  })
})

function clienteFalso(retorno: unknown, erro: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: retorno, error: erro })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  const from = vi.fn().mockReturnValue({ insert })
  return { cliente: { from } as never, from, insert }
}

describe('criarEvento', () => {
  it('grava slug e prefixo derivados do nome quando nao sao informados', async () => {
    const { cliente, from, insert } = clienteFalso({ id: 'e1', nome: 'Engrenagem' })

    await criarEvento(cliente, { nome: 'Engrenagem', data: '2026-09-10' })

    expect(from).toHaveBeenCalledWith('eventos')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Engrenagem',
        slug: 'engrenagem',
        prefixo_codigo: 'ENG26',
        data: '2026-09-10',
      }),
    )
  })

  it('respeita o prefixo informado a mao', async () => {
    const { cliente, insert } = clienteFalso({ id: 'e1' })

    await criarEvento(cliente, {
      nome: 'Engrenagem',
      data: '2026-09-10',
      prefixo_codigo: 'ENGX',
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ prefixo_codigo: 'ENGX' }),
    )
  })

  it('propaga o erro do banco em vez de devolver dado vazio', async () => {
    const { cliente } = clienteFalso(null, { message: 'slug duplicado' })

    await expect(criarEvento(cliente, { nome: 'Engrenagem' })).rejects.toThrow(
      'slug duplicado',
    )
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- eventos`
Expected: FAIL — `Cannot find module './eventos'`.

- [ ] **Step 3: Criar os clientes Supabase**

Criar `lib/supabase/browser.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function criarClienteBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

Criar `lib/supabase/servidor.ts`:

```typescript
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function criarClienteServidor() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {
            // chamado de um Server Component: a sessao ja foi renovada antes
          }
        },
      },
    },
  )
}

/**
 * Cliente com service_role. Ignora RLS por completo.
 * NUNCA importar em codigo que roda no navegador.
 */
export function criarClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
```

O `import 'server-only'` faz o build falhar se este arquivo for puxado por engano para um componente de cliente. O pacote já foi instalado na Task 1.

- [ ] **Step 4: Implementar `lib/eventos.ts`**

```typescript
import type { Evento } from '@/lib/supabase/tipos'

export interface NovoEvento {
  nome: string
  data?: string
  local?: string
  prefixo_codigo?: string
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function slugificar(texto: string): string {
  return semAcento(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** `Engrenagem` + 2026 -> `ENG26`. So um padrao: o admin pode sobrescrever. */
export function prefixoPadrao(nome: string, ano: number): string {
  const letras = semAcento(nome)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
  return `${letras}${String(ano).slice(-2)}`
}

type ClienteSupabase = {
  from: (tabela: string) => {
    insert: (linha: Record<string, unknown>) => {
      select: () => { single: () => Promise<{ data: unknown; error: unknown }> }
    }
  }
}

export async function criarEvento(
  cliente: ClienteSupabase,
  entrada: NovoEvento,
): Promise<Evento> {
  const ano = entrada.data ? Number(entrada.data.slice(0, 4)) : new Date().getFullYear()

  const { data, error } = await cliente
    .from('eventos')
    .insert({
      nome: entrada.nome,
      slug: slugificar(entrada.nome),
      prefixo_codigo: entrada.prefixo_codigo ?? prefixoPadrao(entrada.nome, ano),
      data: entrada.data ?? null,
      local: entrada.local ?? null,
    })
    .select()
    .single()

  if (error) throw new Error((error as { message: string }).message)
  return data as Evento
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm test -- eventos`
Expected: PASS, 8 testes.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/browser.ts lib/supabase/servidor.ts lib/eventos.ts lib/eventos.test.ts package.json package-lock.json
git commit -m "feat: clientes supabase e criacao de evento"
```

---

### Task 8: Inscrição manual com participantes

**Files:**
- Create: `lib/inscricoes.ts`
- Test: `lib/inscricoes.test.ts`

**Interfaces:**
- Consumes: `chaveIdentidade` de `@/lib/identidade`; `Inscricao`, `Participante` de `@/lib/supabase/tipos`
- Produces:
  - `gerarToken(): string`
  - `resolverPessoa(cliente, email: string, nome: string): Promise<string>` — devolve o `id` da pessoa, criando se não existir
  - `criarInscricaoManual(cliente, entrada: NovaInscricao): Promise<{ inscricao: Inscricao; participantes: Participante[] }>`, onde `NovaInscricao = { evento_id: string; vagas: number; empresa_nome?: string; empresa_cidade?: string; empresa_instagram?: string; participantes: EntradaParticipante[] }` e `EntradaParticipante = { nome: string; email: string; telefone?: string; data_nascimento?: string; nome_cracha?: string; cargo?: string }`

- [ ] **Step 1: Escrever os testes**

Criar `lib/inscricoes.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { gerarToken, resolverPessoa, criarInscricaoManual } from './inscricoes'

describe('gerarToken', () => {
  it('tem pelo menos 32 caracteres', () => {
    // O token e a unica credencial do link de check-in. Curto demais e
    // adivinhavel, e adivinhar um token expoe os dados de um buffet inteiro.
    expect(gerarToken().length).toBeGreaterThanOrEqual(32)
  })

  it('nao repete', () => {
    const gerados = new Set(Array.from({ length: 200 }, () => gerarToken()))
    expect(gerados.size).toBe(200)
  })

  it('usa so caracteres seguros para URL', () => {
    expect(gerarToken()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('resolverPessoa', () => {
  function clientePessoas(existente: { id: string } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: existente, error: null })
    const eqNome = vi.fn().mockReturnValue({ maybeSingle })
    const eqEmail = vi.fn().mockReturnValue({ eq: eqNome })
    const select = vi.fn().mockReturnValue({ eq: eqEmail })

    const singleInsert = vi.fn().mockResolvedValue({ data: { id: 'nova' }, error: null })
    const selectInsert = vi.fn().mockReturnValue({ single: singleInsert })
    const insert = vi.fn().mockReturnValue({ select: selectInsert })

    const from = vi.fn().mockReturnValue({ select, insert })
    return { cliente: { from } as never, insert, eqEmail, eqNome }
  }

  it('reaproveita a ficha quando email e nome batem', async () => {
    const { cliente, insert } = clientePessoas({ id: 'p-existente' })

    const id = await resolverPessoa(cliente, ' Cenise@BOL.com.br ', 'Cenise  Jonsson')

    expect(id).toBe('p-existente')
    expect(insert).not.toHaveBeenCalled()
  })

  it('procura pela chave normalizada, nao pelo texto cru', async () => {
    const { cliente, eqEmail, eqNome } = clientePessoas({ id: 'p1' })

    await resolverPessoa(cliente, ' Cenise@BOL.com.br ', 'Cenise  Jonsson')

    expect(eqEmail).toHaveBeenCalledWith('email', 'cenise@bol.com.br')
    expect(eqNome).toHaveBeenCalledWith('nome_chave', 'cenise jonsson')
  })

  it('cria ficha nova quando o nome difere, mesmo com o email igual', async () => {
    // Caso real: Leonardo Guerrieri cadastrado sob laguerryeventos@gmail.com,
    // o email da Janaina. Sao duas pessoas.
    const { cliente, insert } = clientePessoas(null)

    const id = await resolverPessoa(
      cliente,
      'laguerryeventos@gmail.com',
      'Leonardo Guerrieri',
    )

    expect(id).toBe('nova')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'laguerryeventos@gmail.com',
        nome_chave: 'leonardo guerrieri',
        nome_recente: 'Leonardo Guerrieri',
      }),
    )
  })
})

describe('criarInscricaoManual', () => {
  function clienteCompleto() {
    const chamadas: Record<string, unknown[]> = { inscricoes: [], participantes: [] }

    const rpc = vi.fn().mockResolvedValue({ data: 'ENG26-0042', error: null })

    const from = vi.fn((tabela: string) => {
      if (tabela === 'pessoas') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          }),
          insert: (linha: unknown) => ({
            select: () => ({ single: async () => ({ data: { id: `pessoa-${(linha as { nome_chave: string }).nome_chave}` }, error: null }) }),
          }),
        }
      }
      if (tabela === 'inscricoes') {
        return {
          insert: (linha: unknown) => {
            chamadas.inscricoes.push(linha)
            return {
              select: () => ({ single: async () => ({ data: { id: 'insc-1', ...(linha as object) }, error: null }) }),
            }
          },
        }
      }
      return {
        insert: (linhas: unknown) => {
          chamadas.participantes.push(linhas)
          return { select: async () => ({ data: linhas, error: null }) }
        },
      }
    })

    return { cliente: { from, rpc } as never, rpc, chamadas }
  }

  const entrada = {
    evento_id: 'ev-1',
    vagas: 2,
    empresa_nome: 'La Guerry Gastronomia',
    empresa_cidade: 'Porto Alegre / RS',
    participantes: [
      { nome: 'Janaína Garcia Guerrieri', email: 'laguerryeventos@gmail.com' },
      { nome: 'Leonardo Guerrieri', email: 'laguerryeventos@gmail.com' },
    ],
  }

  it('pede o codigo ao banco em vez de inventar um', async () => {
    const { cliente, rpc, chamadas } = clienteCompleto()

    await criarInscricaoManual(cliente, entrada)

    expect(rpc).toHaveBeenCalledWith('gerar_codigo_inscricao', { p_evento_id: 'ev-1' })
    expect(chamadas.inscricoes[0]).toMatchObject({ codigo: 'ENG26-0042', origem: 'manual' })
  })

  it('marca so o primeiro como titular e numera a ordem a partir de 1', async () => {
    const { cliente, chamadas } = clienteCompleto()

    await criarInscricaoManual(cliente, entrada)

    const linhas = chamadas.participantes[0] as Array<Record<string, unknown>>
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toMatchObject({ ordem: 1, titular: true })
    expect(linhas[1]).toMatchObject({ ordem: 2, titular: false })
  })

  it('liga cada participante a uma pessoa diferente apesar do email igual', async () => {
    const { cliente, chamadas } = clienteCompleto()

    await criarInscricaoManual(cliente, entrada)

    const linhas = chamadas.participantes[0] as Array<Record<string, unknown>>
    expect(linhas[0].pessoa_id).not.toBe(linhas[1].pessoa_id)
  })

  it('recusa mais participantes do que vagas', async () => {
    const { cliente } = clienteCompleto()

    await expect(
      criarInscricaoManual(cliente, { ...entrada, vagas: 1 }),
    ).rejects.toThrow(/vagas/i)
  })

  it('recusa inscricao sem nenhum participante', async () => {
    const { cliente } = clienteCompleto()

    await expect(
      criarInscricaoManual(cliente, { ...entrada, participantes: [] }),
    ).rejects.toThrow(/participante/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- inscricoes`
Expected: FAIL — `Cannot find module './inscricoes'`.

- [ ] **Step 3: Implementar `lib/inscricoes.ts`**

```typescript
import { chaveIdentidade } from '@/lib/identidade'
import type { Inscricao, Participante } from '@/lib/supabase/tipos'

export interface EntradaParticipante {
  nome: string
  email: string
  telefone?: string
  data_nascimento?: string
  nome_cracha?: string
  cargo?: string
}

export interface NovaInscricao {
  evento_id: string
  vagas: number
  empresa_nome?: string
  empresa_cidade?: string
  empresa_instagram?: string
  participantes: EntradaParticipante[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClienteSupabase = any

/**
 * O token e a unica credencial do link de check-in: quem tem o link entra.
 * 32 bytes de `crypto.getRandomValues` em base64url dao 43 caracteres
 * imprevisiveis, seguros dentro de uma URL.
 */
export function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function resolverPessoa(
  cliente: ClienteSupabase,
  email: string,
  nome: string,
): Promise<string> {
  const chave = chaveIdentidade(email, nome)

  const { data: achada } = await cliente
    .from('pessoas')
    .select('id')
    .eq('email', chave.email)
    .eq('nome_chave', chave.nome_chave)
    .maybeSingle()

  if (achada) return achada.id

  const { data: criada, error } = await cliente
    .from('pessoas')
    .insert({ ...chave, nome_recente: nome.trim() })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return criada.id
}

export async function criarInscricaoManual(
  cliente: ClienteSupabase,
  entrada: NovaInscricao,
): Promise<{ inscricao: Inscricao; participantes: Participante[] }> {
  if (entrada.participantes.length === 0) {
    throw new Error('A inscricao precisa de ao menos um participante.')
  }
  if (entrada.participantes.length > entrada.vagas) {
    throw new Error(
      `A inscricao tem ${entrada.vagas} vagas e recebeu ${entrada.participantes.length} participantes.`,
    )
  }

  const { data: codigo, error: erroCodigo } = await cliente.rpc(
    'gerar_codigo_inscricao',
    { p_evento_id: entrada.evento_id },
  )
  if (erroCodigo) throw new Error(erroCodigo.message)

  const pessoaIds: string[] = []
  for (const p of entrada.participantes) {
    pessoaIds.push(await resolverPessoa(cliente, p.email, p.nome))
  }

  const { data: inscricao, error: erroInscricao } = await cliente
    .from('inscricoes')
    .insert({
      evento_id: entrada.evento_id,
      codigo,
      origem: 'manual',
      vagas: entrada.vagas,
      empresa_nome: entrada.empresa_nome ?? null,
      empresa_cidade: entrada.empresa_cidade ?? null,
      empresa_instagram: entrada.empresa_instagram ?? null,
      token: gerarToken(),
      pessoa_titular_id: pessoaIds[0],
    })
    .select()
    .single()
  if (erroInscricao) throw new Error(erroInscricao.message)

  const linhas = entrada.participantes.map((p, i) => ({
    inscricao_id: inscricao.id,
    pessoa_id: pessoaIds[i],
    ordem: i + 1,
    titular: i === 0,
    nome: p.nome.trim(),
    email: p.email.trim().toLowerCase(),
    telefone: p.telefone ?? null,
    data_nascimento: p.data_nascimento ?? null,
    nome_cracha: p.nome_cracha ?? null,
    cargo: p.cargo ?? null,
  }))

  const { data: participantes, error: erroParticipantes } = await cliente
    .from('participantes')
    .insert(linhas)
    .select()
  if (erroParticipantes) throw new Error(erroParticipantes.message)

  return { inscricao, participantes }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- inscricoes`
Expected: PASS, 11 testes.

- [ ] **Step 5: Rodar a suíte inteira e o type-check**

```bash
npm test
npx tsc --noEmit
```

Expected: todos verdes, sem erro de tipo.

- [ ] **Step 6: Commit**

```bash
git add lib/inscricoes.ts lib/inscricoes.test.ts
git commit -m "feat: inscricao manual com participantes e resolucao de pessoa"
```

---

## Aplicar no Supabase

As migrations não rodam sozinhas. Depois da Task 6, no painel do projeto:

1. `Project Settings → API` — copiar as três chaves para `.env.local`
2. `SQL Editor` — colar **cada arquivo inteiro**, na ordem `001` → `002` → `003` → `004`

Comentário que perde um traço (`--` virando `-`) quebra a execução na primeira linha. Colar o arquivo completo, não trechos.

3. Criar a conta do admin pela tela de cadastro (ou pelo painel `Authentication`), depois promover:

```sql
update perfis set papel = 'admin' where email = 'seu@email.com';
```

## O que a Fatia A entrega

Banco de pé, com as sete tabelas, RLS, código legível e a view. Em TypeScript: identidade resolvida corretamente, evento criado, inscrição manual criada com seus participantes ligados às pessoas certas.

**O que ainda não existe:** telas. Nem admin, nem check-in. É a Fatia B (tabela geral e abas por tamanho de grupo) e a Fatia C (roteiro e chat).
