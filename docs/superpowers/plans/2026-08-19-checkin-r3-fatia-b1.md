# Check-in R3 — Fatia B1 (Entrar e cadastrar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um admin entra com email e senha, escolhe o evento, cadastra um evento novo e cadastra uma inscrição manual com seus participantes — tudo pelo navegador.

**Architecture:** Next.js 16 App Router. `proxy.ts` (o antigo `middleware.ts`) renova a sessão e barra `/admin` para quem não está autenticado. As telas são Server Components finos que delegam para Server Actions; a lógica testável vive em componentes de cliente e nas funções puras já entregues na Fatia A. A RLS do banco continua sendo a última palavra: nenhuma tela usa `service_role`.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript strict, Tailwind 4, zod 4, `@supabase/ssr`, vitest 4 com jsdom e testing-library.

## Global Constraints

- **Diretório do projeto:** `C:\Users\regra\Downloads\Checkin R3`, branch `main`, remoto `github.com/regratech/Checkin`.
- **Spec de referência:** `docs/superpowers/specs/2026-08-18-checkin-r3-design.md`.
- **A Fatia A já está entregue e aplicada no banco.** Existem: as 8 tabelas, RLS, `eh_admin()`, `gerar_codigo_inscricao()`, `vw_participantes`, e em TypeScript `lib/identidade.ts`, `lib/eventos.ts`, `lib/inscricoes.ts`, `lib/supabase/{tipos,browser,servidor}.ts`.
- **Idioma:** nomes de arquivo, função, variável, rota e teste em **português**. `snake_case` no SQL, `camelCase` no TypeScript, `kebab-case` nos nomes de arquivo de componente.
- **Estilo TypeScript:** sem ponto e vírgula, aspas simples, `import type` quando for só tipo.
- **Migrations** seguem numeradas em `supabase/migrations/`, aplicadas **à mão** no SQL Editor. A próxima é a `005`.
- **Next.js 16 renomeou `middleware.ts` para `proxy.ts`**, e o export chama-se `proxy`, não `middleware`. Confirmado em `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Antes de escrever rota, layout ou Server Action, ler o guia correspondente em `node_modules/next/dist/docs/01-app/`.
- **`service_role` não aparece em nenhuma tela.** Toda leitura do admin passa pela sessão do usuário e pela RLS. `criarClienteAdmin()` fica reservado para a Fatia D (webhook do Guru), que não tem usuário.
- **Não existe cadastro público.** Contas de admin nascem no painel do Supabase e são promovidas por SQL. A aplicação só tem tela de entrar.
- **Verificação:** `npm test`, `npm run typecheck` e `npm run lint` precisam passar ao fim de cada tarefa.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/005_perfil_automatico.sql` | Cria o perfil por trigger, na mesma transação do cadastro |
| `lib/supabase/config.ts` | Lê e **valida** as variáveis de ambiente |
| `proxy.ts` | Renova a sessão e barra `/admin` sem login |
| `lib/auth/esquemas.ts` | Esquemas zod do login |
| `app/entrar/acoes.ts` | Server Actions `entrar` e `sair` |
| `app/entrar/page.tsx` | Tela de entrar |
| `app/entrar/formulario-entrar.tsx` | Componente de cliente do formulário |
| `app/admin/layout.tsx` | Guarda de papel admin + moldura |
| `app/admin/seletor-evento.tsx` | Troca de evento (as "pastas") |
| `app/admin/page.tsx` | Lista de eventos + criar evento |
| `app/admin/acoes.ts` | Server Action `acaoCriarEvento` |
| `app/admin/formulario-evento.tsx` | Componente de cliente |
| `app/admin/[evento]/inscricoes/nova/page.tsx` | Tela de inscrição manual |
| `app/admin/[evento]/inscricoes/nova/acoes.ts` | Server Action `acaoCriarInscricao` |
| `app/admin/[evento]/inscricoes/nova/formulario-inscricao.tsx` | Componente de cliente, com os campos de participante repetidos por `vagas` |

Testes ficam ao lado do arquivo testado, com sufixo `.test.ts` ou `.test.tsx`.

---

### Task 1: Migration 005 — perfil automático por trigger

**Files:**
- Create: `supabase/migrations/005_perfil_automatico.sql`
- Test: `lib/supabase/perfil.test.ts`

**Interfaces:**
- Consumes: a tabela `perfis` da migration 001
- Produces: a função SQL `criar_perfil_do_usuario()` e o trigger `perfil_apos_cadastro` em `auth.users`

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/perfil.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/005_perfil_automatico.sql'),
  'utf-8',
)

describe('migration 005 - perfil automatico', () => {
  it('dispara depois de inserir em auth.users', () => {
    expect(sql).toMatch(/after insert on auth\.users/i)
  })

  it('a funcao do trigger e security definer com search_path fixo', () => {
    expect(sql).toMatch(/security definer/i)
    expect(sql).toMatch(/set search_path = public/i)
  })

  it('insere em perfis a partir do novo usuario', () => {
    expect(sql).toMatch(/insert into perfis/i)
    expect(sql).toMatch(/new\.id/)
    expect(sql).toMatch(/new\.email/)
  })

  it('fixa o papel em publico literal, nunca vindo dos metadados', () => {
    // raw_user_meta_data e controlado por quem se cadastra. Se `papel` for
    // lido de la, o trigger security definer vira caminho de escalada de
    // privilegio que passa por cima da RLS de perfis.
    expect(sql).not.toMatch(/raw_user_meta_data->>'papel'/i)
    expect(sql).not.toMatch(/new\.papel/i)
    const valores = sql.match(/values\s*\(([\s\S]*?)\);/i)?.[1] ?? ''
    expect(valores).toMatch(/'publico'/)
  })

  it('tem nome mesmo quando o cadastro nao mandou metadados', () => {
    // perfis.nome e not null. Conta criada pelo painel do Supabase nao
    // manda metadado nenhum; sem fallback o trigger derruba o cadastro.
    expect(sql).toMatch(/coalesce\(/i)
    expect(sql).toMatch(/split_part\(new\.email/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- perfil`
Expected: FAIL — `ENOENT ... 005_perfil_automatico.sql`

- [ ] **Step 3: Escrever a migration**

Criar `supabase/migrations/005_perfil_automatico.sql`:

```sql
-- O perfil nasce na mesma transacao do cadastro. Fazer isso pela aplicacao
-- criaria uma janela em que auth.signUp da certo e o insert em perfis
-- falha depois, deixando a pessoa autenticada e sem perfil, sem caminho de
-- recuperacao.
--
-- `papel` e o literal 'publico'. Nunca leia de raw_user_meta_data: aquilo
-- vem do navegador de quem se cadastra, e uma funcao security definer que
-- confie nesse dado vira escalada de privilegio.
create function criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nome'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    'publico'
  );
  return new;
end;
$$;

create trigger perfil_apos_cadastro
  after insert on auth.users
  for each row execute function criar_perfil_do_usuario();
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- perfil`
Expected: PASS, 5 testes.

- [ ] **Step 5: Aplicar no Supabase**

Colar o arquivo **inteiro** no SQL Editor do projeto `vyjxyczbscdkfhdabrxk` e executar.

Depois, criar a conta de admin em `Authentication → Users → Add user` (marcar **Auto Confirm User**), e promover:

```sql
update perfis set papel = 'admin' where email = 'seu@email.com';
select email, papel from perfis;
```

O `select` precisa devolver a linha com `admin`. Se devolver vazio, o trigger não rodou — confira que a migration foi aplicada antes de criar o usuário.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/005_perfil_automatico.sql lib/supabase/perfil.test.ts
git commit -m "feat: perfil criado por trigger na mesma transacao do cadastro"
```

---

### Task 2: Guarda de configuração

**Files:**
- Create: `lib/supabase/config.ts`
- Test: `lib/supabase/config.test.ts`
- Modify: `lib/supabase/browser.ts`, `lib/supabase/servidor.ts`

**Interfaces:**
- Consumes: nada
- Produces: `lerConfigSupabase(env: Record<string, string | undefined>): { url: string; anon: string }` e `lerChaveServico(env): string`, exportados de `@/lib/supabase/config`

Esta tarefa existe por causa de um erro real cometido na configuração: a URL foi preenchida com o endpoint REST (`https://xxx.supabase.co/rest/v1/`) em vez do Project URL. A biblioteca acrescenta `/rest/v1` sozinha, então as consultas passaram a devolver `null` silenciosamente em vez de erro. Uma validação de duas linhas transforma isso numa mensagem clara.

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { lerConfigSupabase, lerChaveServico } from './config'

const valido = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://vyjxyczbscdkfhdabrxk.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc123',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc123',
}

describe('lerConfigSupabase', () => {
  it('devolve url e chave quando esta tudo certo', () => {
    expect(lerConfigSupabase(valido)).toEqual({
      url: 'https://vyjxyczbscdkfhdabrxk.supabase.co',
      anon: 'sb_publishable_abc123',
    })
  })

  it('recusa a URL com /rest/v1 no fim, explicando o erro', () => {
    // Erro real cometido: copiaram o endpoint REST do painel em vez do
    // Project URL. A biblioteca acrescenta /rest/v1 sozinha, e o resultado
    // era consulta devolvendo null em silencio.
    expect(() =>
      lerConfigSupabase({
        ...valido,
        NEXT_PUBLIC_SUPABASE_URL: 'https://vyjxyczbscdkfhdabrxk.supabase.co/rest/v1/',
      }),
    ).toThrow(/Project URL/i)
  })

  it('recusa a URL do painel', () => {
    expect(() =>
      lerConfigSupabase({
        ...valido,
        NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.com/dashboard/project/vyjxyczbscdkfhdabrxk',
      }),
    ).toThrow(/supabase\.co/i)
  })

  it('recusa espaco sobrando, que passa despercebido ao colar', () => {
    expect(() =>
      lerConfigSupabase({ ...valido, NEXT_PUBLIC_SUPABASE_URL: ' ' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('diz qual variavel falta, em vez de estourar mais adiante', () => {
    expect(() =>
      lerConfigSupabase({ ...valido, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })
})

describe('lerChaveServico', () => {
  it('devolve a chave de servico', () => {
    expect(lerChaveServico(valido)).toBe('sb_secret_abc123')
  })

  it('reclama quando falta', () => {
    expect(() => lerChaveServico({ ...valido, SUPABASE_SERVICE_ROLE_KEY: '' })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    )
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- config`
Expected: FAIL — `Cannot find module './config'`

- [ ] **Step 3: Implementar**

Criar `lib/supabase/config.ts`:

```typescript
type Ambiente = Record<string, string | undefined>

function exigir(env: Ambiente, chave: string): string {
  const valor = env[chave]?.trim()
  if (!valor) {
    throw new Error(
      `${chave} não está definida. Preencha o .env.local — veja .env.local.example.`,
    )
  }
  return valor
}

export function lerConfigSupabase(env: Ambiente): { url: string; anon: string } {
  const url = exigir(env, 'NEXT_PUBLIC_SUPABASE_URL')

  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL inválida: "${url}".\n` +
        'Use o Project URL, no formato https://SEU-REF.supabase.co — sem /rest/v1 ' +
        'no fim, e não a URL do painel (supabase.com/dashboard/...).',
    )
  }

  return { url: url.replace(/\/$/, ''), anon: exigir(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY') }
}

export function lerChaveServico(env: Ambiente): string {
  return exigir(env, 'SUPABASE_SERVICE_ROLE_KEY')
}
```

- [ ] **Step 4: Passar os clientes a usar a validação**

Substituir o conteúdo de `lib/supabase/browser.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { lerConfigSupabase } from './config'

export function criarClienteBrowser() {
  const { url, anon } = lerConfigSupabase(process.env)
  return createBrowserClient(url, anon)
}
```

Em `lib/supabase/servidor.ts`, trocar o `import` e as duas leituras diretas de `process.env`:

```typescript
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { lerConfigSupabase, lerChaveServico } from './config'

export async function criarClienteServidor() {
  const { url, anon } = lerConfigSupabase(process.env)
  const store = await cookies()
  return createServerClient(url, anon, {
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
  })
}

/**
 * Cliente com service_role. Ignora RLS por completo.
 * NUNCA importar em codigo que roda no navegador.
 */
export function criarClienteAdmin() {
  const { url } = lerConfigSupabase(process.env)
  return createClient(url, lerChaveServico(process.env), {
    auth: { persistSession: false },
  })
}
```

- [ ] **Step 5: Rodar tudo**

```bash
npm test
npm run typecheck
```

Expected: PASS, 86 testes (79 da Fatia A + 7 novos).

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/config.ts lib/supabase/config.test.ts lib/supabase/browser.ts lib/supabase/servidor.ts
git commit -m "feat: valida as variaveis do supabase com mensagem util"
```

---

### Task 3: proxy.ts — sessão e proteção de /admin

**Files:**
- Create: `proxy.ts`
- Test: `lib/auth/proxy.test.ts`

**Interfaces:**
- Consumes: `lerConfigSupabase` de `@/lib/supabase/config`
- Produces: o export `proxy` e o `config.matcher`

- [ ] **Step 1: Escrever o teste**

O `proxy.ts` depende do runtime de requisição do Next, então é testado por asserção sobre o texto, no mesmo espírito dos testes de migration.

Criar `lib/auth/proxy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, '../../proxy.ts'), 'utf-8')

describe('proxy', () => {
  it('exporta `proxy`, nao `middleware`', () => {
    // Next 16 renomeou o arquivo e o export. `middleware` nao e chamado.
    expect(fonte).toMatch(/export async function proxy\(/)
    expect(fonte).not.toMatch(/export (async )?function middleware\(/)
  })

  it('usa getUser, nunca getSession, para decidir acesso', () => {
    // getSession le o cookie sem validar a assinatura no servidor; um cookie
    // forjado passaria. getUser confere com o servidor de auth.
    expect(fonte).toMatch(/auth\.getUser\(\)/)
    expect(fonte).not.toMatch(/auth\.getSession\(\)/)
  })

  it('manda quem nao esta autenticado para /entrar', () => {
    expect(fonte).toMatch(/\/entrar/)
    expect(fonte).toMatch(/NextResponse\.redirect/)
  })

  it('protege /admin', () => {
    expect(fonte).toMatch(/\/admin/)
  })

  it('nao roda em arquivos estaticos', () => {
    expect(fonte).toMatch(/matcher/)
    expect(fonte).toMatch(/_next\/static/)
  })

  it('nunca toca na chave de servico', () => {
    expect(fonte).not.toMatch(/SERVICE_ROLE/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- proxy`
Expected: FAIL — `ENOENT ... proxy.ts`

- [ ] **Step 3: Escrever o proxy**

Criar `proxy.ts` na raiz do projeto:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { lerConfigSupabase } from '@/lib/supabase/config'

// Next 16 renomeou `middleware.ts` para `proxy.ts`, e o export passou a se
// chamar `proxy`. Ver node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/proxy.md
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })
  const { url, anon } = lerConfigSupabase(process.env)

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value))
        resposta = NextResponse.next({ request })
        lista.forEach(({ name, value, options }) =>
          resposta.cookies.set(name, value, options),
        )
      },
    },
  })

  // getUser, nunca getSession: getSession apenas le o cookie, sem validar a
  // assinatura contra o servidor de auth. Um cookie forjado passaria.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const caminho = request.nextUrl.pathname

  if (!user && caminho.startsWith('/admin')) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/entrar'
    destino.searchParams.set('proximo', caminho)
    return NextResponse.redirect(destino)
  }

  if (user && caminho === '/entrar') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/admin'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  return resposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- proxy`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add proxy.ts lib/auth/proxy.test.ts
git commit -m "feat: proxy renova a sessao e barra /admin sem login"
```

---

### Task 4: Tela de entrar

**Files:**
- Create: `lib/auth/esquemas.ts`, `app/entrar/acoes.ts`, `app/entrar/formulario-entrar.tsx`, `app/entrar/page.tsx`
- Test: `lib/auth/esquemas.test.ts`, `app/entrar/acoes.test.ts`, `app/entrar/formulario-entrar.test.tsx`

**Interfaces:**
- Consumes: `criarClienteServidor` de `@/lib/supabase/servidor`
- Produces:
  - `esquemaLogin` de `@/lib/auth/esquemas`
  - `type ResultadoAuth = { erro: string } | undefined`
  - `entrar(_anterior: ResultadoAuth, form: FormData): Promise<ResultadoAuth>` e `sair(): Promise<void>` de `@/app/entrar/acoes`
  - `FormularioEntrar` (componente de cliente) de `@/app/entrar/formulario-entrar`

- [ ] **Step 1: Escrever o teste dos esquemas**

Criar `lib/auth/esquemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { esquemaLogin } from './esquemas'

describe('esquemaLogin', () => {
  it('aceita email e senha validos', () => {
    const r = esquemaLogin.safeParse({ email: 'a@b.com', senha: 'segredo123' })
    expect(r.success).toBe(true)
  })

  it('normaliza o email para minusculas e sem espacos', () => {
    const r = esquemaLogin.safeParse({ email: '  A@B.COM ', senha: 'segredo123' })
    expect(r.success && r.data.email).toBe('a@b.com')
  })

  it('recusa email malformado com mensagem em portugues', () => {
    const r = esquemaLogin.safeParse({ email: 'nao-e-email', senha: 'segredo123' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0].message).toMatch(/email/i)
  })

  it('recusa senha vazia', () => {
    const r = esquemaLogin.safeParse({ email: 'a@b.com', senha: '' })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0].message).toMatch(/senha/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- esquemas`
Expected: FAIL — `Cannot find module './esquemas'`

- [ ] **Step 3: Implementar os esquemas**

Criar `lib/auth/esquemas.ts`:

```typescript
import { z } from 'zod'

export const esquemaLogin = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Informe um email válido' })),
  senha: z.string().min(1, { message: 'Informe a senha' }),
})

export type EntradaLogin = z.infer<typeof esquemaLogin>
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- esquemas`
Expected: PASS, 4 testes.

- [ ] **Step 5: Escrever o teste da Server Action**

Criar `app/entrar/acoes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// acoes.ts tem 'use server' e importa next/headers e next/navigation, que
// exigem contexto de requisicao. O fonte e lido como texto, no mesmo
// espirito dos testes de migration.
const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')

describe('acoes de autenticacao', () => {
  it('e um modulo de servidor', () => {
    expect(fonte).toMatch(/^'use server'/m)
  })

  it('valida a entrada com zod antes de chamar o supabase', () => {
    expect(fonte).toMatch(/esquemaLogin\.safeParse/)
    const posValidacao = fonte.indexOf('esquemaLogin.safeParse')
    const posLogin = fonte.indexOf('signInWithPassword')
    expect(posValidacao).toBeGreaterThan(-1)
    expect(posLogin).toBeGreaterThan(posValidacao)
  })

  it('nao revela se o email existe', () => {
    // "Email nao cadastrado" conta a um atacante quais enderecos tem conta.
    // A mensagem e a mesma para email errado e senha errada.
    expect(fonte).toMatch(/Email ou senha incorretos/)
    expect(fonte).not.toMatch(/não cadastrado|nao cadastrado|inexistente/i)
  })

  it('nao usa a chave de servico', () => {
    expect(fonte).not.toMatch(/criarClienteAdmin|SERVICE_ROLE/)
  })

  it('tem uma acao de sair que encerra a sessao', () => {
    expect(fonte).toMatch(/export async function sair\(/)
    expect(fonte).toMatch(/auth\.signOut\(\)/)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test -- "entrar/acoes"`
Expected: FAIL — `ENOENT ... acoes.ts`

- [ ] **Step 7: Implementar a Server Action**

Criar `app/entrar/acoes.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { esquemaLogin } from '@/lib/auth/esquemas'

export type ResultadoAuth = { erro: string } | undefined

export async function entrar(
  _anterior: ResultadoAuth,
  form: FormData,
): Promise<ResultadoAuth> {
  const analise = esquemaLogin.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email: analise.data.email,
    password: analise.data.senha,
  })

  // Mesma mensagem para email inexistente e senha errada: dizer qual dos
  // dois falhou entrega a um atacante a lista de emails com conta.
  if (error) return { erro: 'Email ou senha incorretos' }

  const proximo = form.get('proximo')
  redirect(typeof proximo === 'string' && proximo.startsWith('/admin') ? proximo : '/admin')
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect('/entrar')
}
```

- [ ] **Step 8: Rodar o teste**

Run: `npm test -- "entrar/acoes"`
Expected: PASS, 5 testes.

- [ ] **Step 9: Escrever o teste do formulário**

Criar `app/entrar/formulario-entrar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormularioEntrar } from './formulario-entrar'

vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: (_acao: unknown, inicial: unknown) => [inicial, vi.fn(), false] }
})

describe('FormularioEntrar', () => {
  it('mostra os campos de email e senha', () => {
    render(<FormularioEntrar proximo="/admin" />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
  })

  it('leva o destino pretendido junto, em campo oculto', () => {
    const { container } = render(<FormularioEntrar proximo="/admin/eventos" />)
    const oculto = container.querySelector('input[name="proximo"]')
    expect(oculto).toHaveValue('/admin/eventos')
  })

  it('marca o campo de senha como senha, para o gerenciador reconhecer', () => {
    render(<FormularioEntrar proximo="/admin" />)
    expect(screen.getByLabelText(/senha/i)).toHaveAttribute('type', 'password')
  })
})
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npm test -- formulario-entrar`
Expected: FAIL — `Cannot find module './formulario-entrar'`

- [ ] **Step 11: Implementar o formulário e a página**

Criar `app/entrar/formulario-entrar.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { entrar, type ResultadoAuth } from './acoes'

export function FormularioEntrar({ proximo }: { proximo: string }) {
  const [resultado, acao, enviando] = useActionState<ResultadoAuth, FormData>(
    entrar,
    undefined,
  )

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="proximo" value={proximo} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Senha</span>
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border px-3 py-2"
        />
      </label>

      {resultado?.erro ? (
        <p role="alert" className="text-sm text-red-600">
          {resultado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
```

Criar `app/entrar/page.tsx`:

```tsx
import { FormularioEntrar } from './formulario-entrar'

export const metadata = { title: 'Entrar · Check-in R3' }

export default async function PaginaEntrar({
  searchParams,
}: PageProps<'/entrar'>) {
  const { proximo } = await searchParams
  const destino = typeof proximo === 'string' && proximo.startsWith('/admin') ? proximo : '/admin'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-semibold">Check-in R3</h1>
      <FormularioEntrar proximo={destino} />
    </main>
  )
}
```

- [ ] **Step 12: Rodar tudo**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add lib/auth app/entrar
git commit -m "feat: tela de entrar com validacao e mensagem neutra de erro"
```

---

### Task 5: Moldura do admin e seletor de evento

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/seletor-evento.tsx`
- Test: `app/admin/seletor-evento.test.tsx`, `app/admin/layout.test.ts`

**Interfaces:**
- Consumes: `criarClienteServidor`, `sair` de `@/app/entrar/acoes`, `Evento` de `@/lib/supabase/tipos`
- Produces: `SeletorEvento({ eventos, atual }: { eventos: Evento[]; atual?: string })` de `@/app/admin/seletor-evento`

- [ ] **Step 1: Escrever o teste do seletor**

Criar `app/admin/seletor-evento.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SeletorEvento } from './seletor-evento'
import type { Evento } from '@/lib/supabase/tipos'

const empurrar = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: empurrar }) }))

const eventos: Evento[] = [
  {
    id: 'e1',
    nome: 'Engrenagem 2026',
    slug: 'engrenagem-2026',
    prefixo_codigo: 'ENG26',
    data: '2026-09-10',
    local: 'São Paulo',
    ativo: true,
  },
  {
    id: 'e2',
    nome: 'Engrenagem 2027',
    slug: 'engrenagem-2027',
    prefixo_codigo: 'ENG27',
    data: '2027-03-05',
    local: 'Rio',
    ativo: true,
  },
]

describe('SeletorEvento', () => {
  it('lista todos os eventos', () => {
    render(<SeletorEvento eventos={eventos} atual="engrenagem-2026" />)
    expect(screen.getByRole('option', { name: /Engrenagem 2026/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Engrenagem 2027/ })).toBeInTheDocument()
  })

  it('deixa o evento atual selecionado', () => {
    render(<SeletorEvento eventos={eventos} atual="engrenagem-2027" />)
    expect(screen.getByRole('combobox')).toHaveValue('engrenagem-2027')
  })

  it('avisa quando ainda nao existe evento nenhum', () => {
    render(<SeletorEvento eventos={[]} />)
    expect(screen.getByText(/nenhum evento/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- seletor-evento`
Expected: FAIL — `Cannot find module './seletor-evento'`

- [ ] **Step 3: Implementar o seletor**

Criar `app/admin/seletor-evento.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import type { Evento } from '@/lib/supabase/tipos'

export function SeletorEvento({ eventos, atual }: { eventos: Evento[]; atual?: string }) {
  const router = useRouter()

  if (eventos.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum evento cadastrado ainda.</p>
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-neutral-500">Evento</span>
      <select
        value={atual ?? ''}
        onChange={(e) => router.push(`/admin/${e.target.value}`)}
        className="rounded border px-2 py-1 text-sm"
      >
        <option value="" disabled>
          Escolha…
        </option>
        {eventos.map((evento) => (
          <option key={evento.id} value={evento.slug}>
            {evento.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 4: Escrever o teste do layout**

Criar `app/admin/layout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './layout.tsx'), 'utf-8')

describe('layout do admin', () => {
  it('confere o papel no servidor, nao no navegador', () => {
    // O proxy so garante que existe sessao. Quem e `publico` continua
    // autenticado — a checagem de papel precisa acontecer aqui.
    expect(fonte).toMatch(/from\('perfis'\)/)
    expect(fonte).toMatch(/papel/)
  })

  it('expulsa quem nao e admin', () => {
    expect(fonte).toMatch(/redirect\(/)
  })

  it('nao usa a chave de servico', () => {
    expect(fonte).not.toMatch(/criarClienteAdmin|SERVICE_ROLE/)
  })

  it('oferece o botao de sair', () => {
    expect(fonte).toMatch(/sair/)
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- "admin/layout"`
Expected: FAIL — `ENOENT ... layout.tsx`

- [ ] **Step 6: Implementar o layout**

Criar `app/admin/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { sair } from '@/app/entrar/acoes'

export const metadata = { title: 'Admin · Check-in R3' }

export default async function LayoutAdmin({ children }: LayoutProps<'/admin'>) {
  const supabase = await criarClienteServidor()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  // O proxy so garante sessao. Uma conta `publico` esta autenticada e
  // passaria por ele — o papel precisa ser conferido aqui, no servidor.
  const { data: perfil } = await supabase
    .from('perfis')
    .select('papel, nome')
    .eq('id', user.id)
    .maybeSingle()

  if (perfil?.papel !== 'admin') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-neutral-600">
          Esta conta não tem permissão de administrador.
        </p>
        <form action={sair}>
          <button type="submit" className="text-sm underline">
            Sair
          </button>
        </form>
      </main>
    )
  }

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Check-in R3</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-500">{perfil.nome}</span>
          <form action={sair}>
            <button type="submit" className="underline">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 7: Rodar tudo**

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/admin/layout.tsx app/admin/layout.test.ts app/admin/seletor-evento.tsx app/admin/seletor-evento.test.tsx
git commit -m "feat: moldura do admin com guarda de papel e seletor de evento"
```

---

### Task 6: Criar evento

**Files:**
- Create: `app/admin/acoes.ts`, `app/admin/formulario-evento.tsx`, `app/admin/page.tsx`
- Test: `app/admin/acoes.test.ts`, `app/admin/formulario-evento.test.tsx`

**Interfaces:**
- Consumes: `criarEvento`, `prefixoPadrao` de `@/lib/eventos`; `criarClienteServidor`
- Produces:
  - `type ResultadoForm = { erro: string } | undefined`
  - `acaoCriarEvento(_anterior: ResultadoForm, form: FormData): Promise<ResultadoForm>` de `@/app/admin/acoes`
  - `FormularioEvento` de `@/app/admin/formulario-evento`

- [ ] **Step 1: Escrever o teste da ação**

Criar `app/admin/acoes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')

describe('acaoCriarEvento', () => {
  it('e um modulo de servidor', () => {
    expect(fonte).toMatch(/^'use server'/m)
  })

  it('reaproveita criarEvento da Fatia A em vez de montar o insert de novo', () => {
    expect(fonte).toMatch(/from '@\/lib\/eventos'/)
    expect(fonte).toMatch(/criarEvento\(/)
    expect(fonte).not.toMatch(/\.from\(['"]eventos['"]\)\s*\n?\s*\.insert/)
  })

  it('valida a entrada com zod', () => {
    expect(fonte).toMatch(/safeParse/)
  })

  it('passa pela sessao do usuario, respeitando a RLS', () => {
    expect(fonte).toMatch(/criarClienteServidor/)
    expect(fonte).not.toMatch(/criarClienteAdmin/)
  })

  it('atualiza a lista depois de gravar', () => {
    // Sem revalidatePath a lista de eventos continua servindo o cache
    // antigo e o evento recem-criado nao aparece.
    expect(fonte).toMatch(/revalidatePath\(/)
  })

  it('devolve mensagem legivel quando o slug ja existe', () => {
    expect(fonte).toMatch(/duplicate key|23505|já existe/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "admin/acoes"`
Expected: FAIL — `ENOENT ... acoes.ts`

- [ ] **Step 3: Implementar a ação**

Criar `app/admin/acoes.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { criarEvento } from '@/lib/eventos'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export type ResultadoForm = { erro: string } | undefined

const esquemaEvento = z.object({
  nome: z.string().trim().min(2, { message: 'Informe o nome do evento' }),
  data: z.string().trim().optional(),
  local: z.string().trim().optional(),
  prefixo_codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,8}$/, { message: 'O prefixo usa de 3 a 8 letras ou números' })
    .optional()
    .or(z.literal('')),
})

export async function acaoCriarEvento(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const analise = esquemaEvento.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const { nome, data, local, prefixo_codigo } = analise.data
  const supabase = await criarClienteServidor()

  try {
    await criarEvento(supabase, {
      nome,
      data: data || undefined,
      local: local || undefined,
      prefixo_codigo: prefixo_codigo || undefined,
    })
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e)
    if (/duplicate key|23505/i.test(mensagem)) {
      return { erro: 'Já existe um evento com esse nome.' }
    }
    return { erro: mensagem }
  }

  // Sem isto a lista continua servindo o cache antigo e o evento novo
  // simplesmente nao aparece.
  revalidatePath('/admin')
}
```

- [ ] **Step 4: Escrever o teste do formulário**

Criar `app/admin/formulario-evento.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormularioEvento } from './formulario-evento'

vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: (_a: unknown, i: unknown) => [i, vi.fn(), false] }
})

describe('FormularioEvento', () => {
  it('tem os campos de nome, data, local e prefixo', () => {
    render(<FormularioEvento />)
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/data/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/local/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/prefixo/i)).toBeInTheDocument()
  })

  it('sugere o prefixo enquanto a pessoa digita o nome', async () => {
    // Digitar ENG26 a mao e trabalho que o sistema sabe fazer.
    render(<FormularioEvento />)
    await userEvent.type(screen.getByLabelText(/nome/i), 'Engrenagem')
    await userEvent.type(screen.getByLabelText(/data/i), '2026-09-10')
    expect(screen.getByLabelText(/prefixo/i)).toHaveValue('ENG26')
  })

  it('deixa o prefixo ser sobrescrito a mao', async () => {
    render(<FormularioEvento />)
    await userEvent.type(screen.getByLabelText(/nome/i), 'Engrenagem')
    await userEvent.clear(screen.getByLabelText(/prefixo/i))
    await userEvent.type(screen.getByLabelText(/prefixo/i), 'XYZ99')
    expect(screen.getByLabelText(/prefixo/i)).toHaveValue('XYZ99')
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- formulario-evento`
Expected: FAIL — `Cannot find module './formulario-evento'`

- [ ] **Step 6: Implementar o formulário**

Criar `app/admin/formulario-evento.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { acaoCriarEvento, type ResultadoForm } from './acoes'
import { prefixoPadrao } from '@/lib/eventos'

export function FormularioEvento() {
  const [resultado, acao, enviando] = useActionState<ResultadoForm, FormData>(
    acaoCriarEvento,
    undefined,
  )
  const [nome, setNome] = useState('')
  const [data, setData] = useState('')
  const [prefixo, setPrefixo] = useState('')
  const [prefixoManual, setPrefixoManual] = useState(false)

  const ano = data ? Number(data.slice(0, 4)) : new Date().getFullYear()
  const sugestao = nome.trim().length >= 2 ? prefixoPadrao(nome, ano) : ''
  const valorPrefixo = prefixoManual ? prefixo : sugestao

  return (
    <form action={acao} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nome do evento</span>
        <input
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Data</span>
        <input
          name="data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Local</span>
        <input name="local" className="rounded border px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Prefixo do código</span>
        <input
          name="prefixo_codigo"
          value={valorPrefixo}
          onChange={(e) => {
            setPrefixoManual(true)
            setPrefixo(e.target.value.toUpperCase())
          }}
          className="rounded border px-3 py-2 font-mono"
        />
        <span className="text-xs text-neutral-500">
          As inscrições ficarão {valorPrefixo || 'ENG26'}-0001, {valorPrefixo || 'ENG26'}-0002…
        </span>
      </label>

      {resultado?.erro ? (
        <p role="alert" className="text-sm text-red-600">
          {resultado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {enviando ? 'Criando…' : 'Criar evento'}
      </button>
    </form>
  )
}
```

- [ ] **Step 7: Implementar a página**

Criar `app/admin/page.tsx`:

```tsx
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { FormularioEvento } from './formulario-evento'
import type { Evento } from '@/lib/supabase/tipos'

export default async function PaginaAdmin() {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('eventos')
    .select('id, nome, slug, prefixo_codigo, data, local, ativo')
    .order('data', { ascending: false, nullsFirst: false })

  const eventos = (data ?? []) as Evento[]

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Eventos</h1>
        {eventos.length === 0 ? (
          <p className="text-neutral-500">Nenhum evento ainda. Crie o primeiro abaixo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {eventos.map((evento) => (
              <li key={evento.id}>
                <Link href={`/admin/${evento.slug}`} className="underline">
                  {evento.nome}
                </Link>
                <span className="ml-2 font-mono text-sm text-neutral-500">
                  {evento.prefixo_codigo}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Novo evento</h2>
        <FormularioEvento />
      </section>
    </div>
  )
}
```

- [ ] **Step 8: Rodar tudo**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/admin/acoes.ts app/admin/acoes.test.ts app/admin/formulario-evento.tsx app/admin/formulario-evento.test.tsx app/admin/page.tsx
git commit -m "feat: criar evento pelo admin com prefixo sugerido"
```

---

### Task 7: Inscrição manual

**Files:**
- Create: `app/admin/[evento]/page.tsx`, `app/admin/[evento]/inscricoes/nova/acoes.ts`, `app/admin/[evento]/inscricoes/nova/formulario-inscricao.tsx`, `app/admin/[evento]/inscricoes/nova/page.tsx`
- Test: `app/admin/[evento]/inscricoes/nova/acoes.test.ts`, `app/admin/[evento]/inscricoes/nova/formulario-inscricao.test.tsx`

**Interfaces:**
- Consumes: `criarInscricaoManual`, `type EntradaParticipante` de `@/lib/inscricoes`; `criarClienteServidor`
- Produces: `acaoCriarInscricao(_anterior: ResultadoForm, form: FormData): Promise<ResultadoForm>` e `FormularioInscricao({ eventoSlug }: { eventoSlug: string })`

- [ ] **Step 1: Escrever o teste da ação**

Criar `app/admin/[evento]/inscricoes/nova/acoes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')

describe('acaoCriarInscricao', () => {
  it('e um modulo de servidor', () => {
    expect(fonte).toMatch(/^'use server'/m)
  })

  it('reaproveita criarInscricaoManual da Fatia A', () => {
    // Aquela funcao ja resolve pessoa por email+nome, pede o codigo ao
    // banco e numera a ordem. Refazer isso aqui duplicaria a regra.
    expect(fonte).toMatch(/from '@\/lib\/inscricoes'/)
    expect(fonte).toMatch(/criarInscricaoManual\(/)
  })

  it('monta a lista de participantes a partir de campos indexados do form', () => {
    expect(fonte).toMatch(/participantes\[/)
  })

  it('passa pela sessao do usuario, respeitando a RLS', () => {
    expect(fonte).toMatch(/criarClienteServidor/)
    expect(fonte).not.toMatch(/criarClienteAdmin/)
  })

  it('atualiza a tela do evento depois de gravar', () => {
    expect(fonte).toMatch(/revalidatePath\(/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "nova/acoes"`
Expected: FAIL — `ENOENT ... acoes.ts`

- [ ] **Step 3: Implementar a ação**

Criar `app/admin/[evento]/inscricoes/nova/acoes.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { criarInscricaoManual, type EntradaParticipante } from '@/lib/inscricoes'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export type ResultadoForm = { erro: string } | undefined

const esquemaCabecalho = z.object({
  evento_slug: z.string().trim().min(1),
  vagas: z.coerce.number().int().min(1).max(20),
  empresa_nome: z.string().trim().optional(),
  empresa_cidade: z.string().trim().optional(),
  empresa_instagram: z.string().trim().optional(),
})

/**
 * O formulario manda os participantes em campos indexados:
 * `participantes[0].nome`, `participantes[0].email`, e assim por diante.
 * Aqui eles voltam a ser uma lista.
 */
function lerParticipantes(form: FormData, vagas: number): EntradaParticipante[] {
  const lista: EntradaParticipante[] = []

  for (let i = 0; i < vagas; i++) {
    const ler = (campo: string) => {
      const v = form.get(`participantes[${i}].${campo}`)
      return typeof v === 'string' ? v.trim() : ''
    }

    const nome = ler('nome')
    const email = ler('email')
    if (!nome && !email) continue

    lista.push({
      nome,
      email,
      telefone: ler('telefone') || undefined,
      data_nascimento: ler('data_nascimento') || undefined,
      nome_cracha: ler('nome_cracha') || undefined,
      cargo: ler('cargo') || undefined,
    })
  }

  return lista
}

export async function acaoCriarInscricao(
  _anterior: ResultadoForm,
  form: FormData,
): Promise<ResultadoForm> {
  const analise = esquemaCabecalho.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const { evento_slug, vagas, empresa_nome, empresa_cidade, empresa_instagram } =
    analise.data

  const supabase = await criarClienteServidor()

  const { data: evento, error: erroEvento } = await supabase
    .from('eventos')
    .select('id')
    .eq('slug', evento_slug)
    .maybeSingle()

  if (erroEvento) return { erro: erroEvento.message }
  if (!evento) return { erro: 'Evento não encontrado.' }

  const participantes = lerParticipantes(form, vagas)

  for (const p of participantes) {
    if (!p.nome) return { erro: 'Todo participante preenchido precisa de nome.' }
    if (!p.email) return { erro: `Falta o email de ${p.nome}.` }
  }

  try {
    await criarInscricaoManual(supabase, {
      evento_id: evento.id,
      vagas,
      empresa_nome: empresa_nome || undefined,
      empresa_cidade: empresa_cidade || undefined,
      empresa_instagram: empresa_instagram || undefined,
      participantes,
    })
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) }
  }

  revalidatePath(`/admin/${evento_slug}`)
}
```

- [ ] **Step 4: Escrever o teste do formulário**

Criar `app/admin/[evento]/inscricoes/nova/formulario-inscricao.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormularioInscricao } from './formulario-inscricao'

vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: (_a: unknown, i: unknown) => [i, vi.fn(), false] }
})

describe('FormularioInscricao', () => {
  it('comeca com uma vaga e um bloco de participante', () => {
    render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    expect(screen.getByRole('heading', { name: /participante 1/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /participante 2/i })).not.toBeInTheDocument()
  })

  it('cria um bloco por vaga ao aumentar o numero', async () => {
    // Isto e o que substitui os quatro ramos copiados do Typebot: um laco
    // sobre `vagas`, nao quatro copias do mesmo formulario.
    render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    await userEvent.selectOptions(screen.getByLabelText(/vagas/i), '3')
    expect(screen.getByRole('heading', { name: /participante 3/i })).toBeInTheDocument()
  })

  it('marca o primeiro bloco como titular', async () => {
    render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    await userEvent.selectOptions(screen.getByLabelText(/vagas/i), '2')
    expect(screen.getByRole('heading', { name: /participante 1.*titular/i })).toBeInTheDocument()
  })

  it('nomeia os campos de forma indexada, para a acao remontar a lista', () => {
    const { container } = render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    expect(container.querySelector('input[name="participantes[0].nome"]')).toBeTruthy()
    expect(container.querySelector('input[name="participantes[0].email"]')).toBeTruthy()
  })

  it('leva o slug do evento junto', () => {
    const { container } = render(<FormularioInscricao eventoSlug="engrenagem-2026" />)
    expect(container.querySelector('input[name="evento_slug"]')).toHaveValue(
      'engrenagem-2026',
    )
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- formulario-inscricao`
Expected: FAIL — `Cannot find module './formulario-inscricao'`

- [ ] **Step 6: Implementar o formulário**

Criar `app/admin/[evento]/inscricoes/nova/formulario-inscricao.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { acaoCriarInscricao, type ResultadoForm } from './acoes'

const VAGAS_POSSIVEIS = [1, 2, 3, 4, 5, 6]

export function FormularioInscricao({ eventoSlug }: { eventoSlug: string }) {
  const [resultado, acao, enviando] = useActionState<ResultadoForm, FormData>(
    acaoCriarInscricao,
    undefined,
  )
  const [vagas, setVagas] = useState(1)

  return (
    <form action={acao} className="flex max-w-2xl flex-col gap-8">
      <input type="hidden" name="evento_slug" value={eventoSlug} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Buffet</h2>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Nome do buffet</span>
          <input name="empresa_nome" className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Cidade</span>
          <input name="empresa_cidade" className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Instagram</span>
          <input name="empresa_instagram" className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Vagas</span>
          <select
            name="vagas"
            value={vagas}
            onChange={(e) => setVagas(Number(e.target.value))}
            className="w-24 rounded border px-3 py-2"
          >
            {VAGAS_POSSIVEIS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Um bloco por vaga. Isto substitui os quatro ramos copiados do
          Typebot: mudar o numero muda quantos blocos existem, e nada mais. */}
      {Array.from({ length: vagas }, (_, i) => (
        <section key={i} className="flex flex-col gap-4 rounded border p-4">
          <h3 className="font-semibold">
            Participante {i + 1}
            {i === 0 ? ' (titular)' : ''}
          </h3>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Nome completo</span>
            <input
              name={`participantes[${i}].nome`}
              required={i === 0}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Email</span>
            <input
              name={`participantes[${i}].email`}
              type="email"
              required={i === 0}
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Telefone</span>
            <input name={`participantes[${i}].telefone`} className="rounded border px-3 py-2" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Aniversário</span>
            <input
              name={`participantes[${i}].data_nascimento`}
              type="date"
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Nome no crachá</span>
            <input name={`participantes[${i}].nome_cracha`} className="rounded border px-3 py-2" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Cargo</span>
            <input name={`participantes[${i}].cargo`} className="rounded border px-3 py-2" />
          </label>
        </section>
      ))}

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
        {enviando ? 'Gravando…' : 'Criar inscrição'}
      </button>
    </form>
  )
}
```

- [ ] **Step 7: Implementar as páginas**

Criar `app/admin/[evento]/inscricoes/nova/page.tsx`:

```tsx
import { FormularioInscricao } from './formulario-inscricao'

export default async function PaginaNovaInscricao({
  params,
}: PageProps<'/admin/[evento]/inscricoes/nova'>) {
  const { evento } = await params

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Nova inscrição</h1>
      <FormularioInscricao eventoSlug={evento} />
    </div>
  )
}
```

Criar `app/admin/[evento]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { SeletorEvento } from '@/app/admin/seletor-evento'
import type { Evento } from '@/lib/supabase/tipos'

export default async function PaginaEvento({ params }: PageProps<'/admin/[evento]'>) {
  const { evento: slug } = await params
  const supabase = await criarClienteServidor()

  const colunas = 'id, nome, slug, prefixo_codigo, data, local, ativo'

  const [{ data: atual }, { data: todos }] = await Promise.all([
    supabase.from('eventos').select(colunas).eq('slug', slug).maybeSingle(),
    supabase.from('eventos').select(colunas).order('data', { ascending: false, nullsFirst: false }),
  ])

  if (!atual) notFound()

  const { count: inscricoes } = await supabase
    .from('inscricoes')
    .select('*', { count: 'exact', head: true })
    .eq('evento_id', (atual as Evento).id)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{(atual as Evento).nome}</h1>
        <SeletorEvento eventos={(todos ?? []) as Evento[]} atual={slug} />
      </div>

      <p className="text-neutral-600">
        {inscricoes ?? 0} {inscricoes === 1 ? 'inscrição' : 'inscrições'}
      </p>

      <Link
        href={`/admin/${slug}/inscricoes/nova`}
        className="self-start rounded bg-neutral-900 px-4 py-2 text-white"
      >
        Nova inscrição
      </Link>
    </div>
  )
}
```

- [ ] **Step 8: Rodar tudo**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Verificar no navegador**

Subir o servidor e conferir o caminho completo:

1. Abrir `/admin` sem sessão → deve redirecionar para `/entrar`
2. Entrar com a conta admin → deve cair em `/admin`
3. Criar o evento "Engrenagem 2026", data `2026-09-10` → o prefixo deve se preencher sozinho com `ENG26`
4. Abrir o evento → **Nova inscrição**
5. Escolher **2 vagas** → devem aparecer dois blocos, o primeiro marcado como titular
6. Preencher com o caso real: Janaína Garcia Guerrieri e Leonardo Guerrieri, **os dois com `laguerryeventos@gmail.com`**
7. Gravar

No SQL Editor do Supabase, confirmar que a regra de identidade valeu:

```sql
select nome_recente, email from pessoas order by criado_em;
-- deve devolver DUAS linhas, mesmo email, nomes diferentes

select codigo_participante, nome, titular, vagas, pessoas_preenchidas
from vw_participantes order by codigo_participante;
-- ENG26-0001-1  Janaína ...  true   2  2
-- ENG26-0001-2  Leonardo ... false  2  2
```

Se `pessoas` devolver uma linha só, a chave de identidade está errada — pare e investigue antes de seguir.

- [ ] **Step 10: Commit**

```bash
git add "app/admin/[evento]"
git commit -m "feat: inscricao manual com um bloco por vaga"
```

---

## O que a Fatia B1 entrega

Um admin entra, cria evento, cadastra inscrição com 1 a 6 participantes, e os dados chegam ao banco com identidade resolvida e código `ENG26-0001` gerado pelo Postgres.

**O que ainda não existe:** a tabela geral, as abas `1 · 2 · 3 · 4+`, a busca e o CSV — tudo isso é a Fatia B2. E o roteiro da Lara é a Fatia C.
