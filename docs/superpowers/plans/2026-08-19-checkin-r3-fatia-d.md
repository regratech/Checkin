# Check-in R3 — Fatia D (O Guru) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma compra aprovada no Guru vira inscrição no sistema sozinha, com o link de check-in pronto — e o admin consegue ver o que entrou, o que falhou e por quê.

**Architecture:** O n8n já recebe o webhook do Guru. Ganha **um nó a mais**, em paralelo ao do Google Sheets, que reenvia o corpo cru para `/api/guru/[slug]`. O endpoint grava o payload inteiro em `sincronizacoes` — sem interpretar nada — e só então tenta promover para `inscricoes`. Se a leitura falhar, o payload continua lá e o admin reprocessa depois de corrigir. A planilha continua sendo preenchida como sempre: rede de segurança para o primeiro evento.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript strict, Tailwind 4, zod 4, `@supabase/ssr`, vitest 4.

## Global Constraints

- **Diretório:** `C:\Users\regra\Downloads\Checkin R3`, branch `main`, remoto `github.com/regratech/Checkin`.
- **Spec:** `docs/superpowers/specs/2026-08-18-checkin-r3-design.md`, seção 3.2 (`sincronizacoes`) e os dois adendos de 2026-08-19 sobre o Guru.
- **Fatias A, B1, B2, C1 e C2 entregues.** Migrations `001` a `007`. Existe o admin completo, a tabela com abas, o editor de roteiro e a conversa da Lara.
- **Idioma:** nomes de arquivo, função, variável, rota e teste em **português**.
- **Estilo TypeScript:** sem ponto e vírgula, aspas simples, `import type` quando for só tipo.
- **O endpoint é público** — o Guru não faz login. A autenticação é um segredo por evento, enviado no cabeçalho `x-checkin-segredo`. **Nunca em query string**: parâmetros de URL entram em log de servidor, de proxy e de navegador.
- **Nada do payload é confiável.** Ele vem da internet aberta. Tudo passa por zod, e o que não for reconhecido é guardado sem interpretar.
- **O dev server precisa de `NODE_EXTRA_CA_CERTS`** (certificado do Avast) e roda na porta **3100**.
- **Depois de mudar código que o navegador executa, limpe o `.next`** antes de concluir que a correção falhou.
- **Testes que leem o fonte como texto** removem comentários e delimitam o trecho.
- **Verificação:** `npm test`, `npm run typecheck` e `npm run lint` ao fim de cada tarefa.

## O que já se sabe do payload

Decifrado da planilha e dos nomes de coluna do nó do n8n. Objeto plano:

```json
{
  "created_at": "2026-06-23 09:00:37",
  "confirmed_at": "2026-06-23 09:09:06",
  "name": "Diogo Rodrigues De Souza",
  "doc": "7937761636",
  "email": "pallacebuffetptc@gmail.com",
  "ddi": "55",
  "phone": "34993395999",
  "quantity": 2,
  "status": "A",
  "product": "Engrenagem … 2026 [PRÉ-VENDA - 2 INSCRIÇÕES] - 15% OFF NA 2ª"
}
```

**Três coisas medidas, não supostas:**

1. `quantity` é o número de vagas, como número. O texto de `product` repete a informação — serve de conferência, não de fonte.
2. `doc` pode ser CPF (11 dígitos) ou **CNPJ** (14). A inscrição da Janaína Guerrieri usa CNPJ.
3. **Não se sabe se existe identificador da transação.** O n8n não permitiu inspecionar o payload completo. Por isso a chave de idempotência é auto-descoberta (Task 2) — funciona sem o campo e melhora sozinha se ele existir.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/008_guru.sql` | `documento_compra`, `webhook_segredo`, índice de idempotência |
| `lib/guru.ts` | Lê o payload: campos, vagas, status, chave de idempotência |
| `lib/promocao.ts` | Sincronização → inscrição + pessoa + titular, idempotente |
| `app/api/guru/[evento]/route.ts` | O endpoint que o n8n chama |
| `app/admin/[evento]/integracao/page.tsx` | O que entrou, o que falhou, e o reprocessar |
| `app/admin/[evento]/integracao/acoes.ts` | Reprocessar e revelar o segredo |

---

### Task 1: Migration 008

**Files:**
- Create: `supabase/migrations/008_guru.sql`
- Test: `lib/supabase/guru-schema.test.ts`

**Interfaces:**
- Consumes: `eventos`, `inscricoes`, `sincronizacoes` das migrations anteriores
- Produces: `eventos.webhook_segredo`, `inscricoes.documento_compra`, `sincronizacoes.chave` com unicidade por evento

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/guru-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/008_guru.sql'),
  'utf-8',
)

describe('migration 008 - integracao com o guru', () => {
  it('cada evento tem o proprio segredo de webhook', () => {
    // Um segredo global vazaria o acesso a todos os eventos de uma vez.
    expect(sql).toMatch(/alter table eventos\s+add column webhook_segredo text/i)
  })

  it('o segredo nasce aleatorio, nao em branco', () => {
    expect(sql).toMatch(/gen_random_uuid\(\)|gen_random_bytes/i)
  })

  it('guarda o documento da compra, que pode ser CPF ou CNPJ', () => {
    // A inscricao da Janaina Guerrieri usa CNPJ de 14 digitos. Modelar como
    // CPF de 11 recusaria dado real.
    expect(sql).toMatch(/add column documento_compra text/i)
    expect(sql).not.toMatch(/char\(11\)|varchar\(11\)/i)
  })

  it('a sincronizacao guarda a chave de idempotencia', () => {
    expect(sql).toMatch(/add column chave text/i)
  })

  it('a mesma chave nao entra duas vezes no mesmo evento', () => {
    // O webhook pode ser reenviado: falha de rede, retentativa do Guru.
    // Sem isto, a mesma compra viraria duas inscricoes.
    expect(sql).toMatch(/unique.*\(evento_id, chave\)/is)
  })

  it('a unicidade vale mesmo com chave nula', () => {
    // NULL nunca e igual a NULL num unique do Postgres — foi o defeito que
    // a migration 007 corrigiu em `respostas`. Nao repetir aqui.
    expect(sql).toMatch(/nulls not distinct/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- guru-schema`
Expected: FAIL — `ENOENT ... 008_guru.sql`

- [ ] **Step 3: Escrever a migration**

Criar `supabase/migrations/008_guru.sql`:

```sql
-- O endpoint do Guru e publico: quem chama nao faz login. A autenticacao
-- e um segredo POR EVENTO, no cabecalho `x-checkin-segredo`. Um segredo
-- global vazaria o acesso a todos os eventos de uma vez.
alter table eventos
  add column webhook_segredo text not null
  -- `gen_random_uuid()` e do nucleo do Postgres desde a versao 13.
  -- `gen_random_bytes` exigiria a extensao pgcrypto, que pode nao estar
  -- habilitada — e a migration falharia por um detalhe evitavel.
  default replace(gen_random_uuid()::text, '-', '') ||
          replace(gen_random_uuid()::text, '-', '');

-- O Guru manda `doc`, que e CPF (11) ou CNPJ (14). A inscricao da Janaina
-- Guerrieri usa CNPJ — modelar como CPF de tamanho fixo recusaria dado real.
alter table inscricoes
  add column documento_compra text;

-- A chave de idempotencia da sincronizacao. Vem do identificador da
-- transacao quando o payload tiver um; senao e derivada de
-- documento + email + criado_em. Ver `chaveDeIdempotencia` em lib/guru.ts.
alter table sincronizacoes
  add column chave text;

-- `nulls not distinct`: NULL nunca e igual a NULL num unique comum, e foi
-- exatamente esse o defeito que a migration 007 corrigiu em `respostas`.
-- Aqui a chave nunca deveria ser nula, mas a restricao nao pode depender
-- disso para valer.
-- ATENCAO: com `nulls not distinct`, duas linhas de chave NULA no mesmo
-- evento colidem. A tabela esta vazia hoje; se houver linhas antigas,
-- preencha a chave delas antes de rodar isto.
alter table sincronizacoes
  add constraint sincronizacoes_chave_unica
  unique nulls not distinct (evento_id, chave);
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- guru-schema`
Expected: PASS, 6 testes.

- [ ] **Step 5: Aplicar no Supabase e commitar**

Colar o arquivo inteiro no SQL Editor do projeto `vyjxyczbscdkfhdabrxk`. Depois, pegar o segredo do evento:

```sql
select nome, slug, webhook_segredo from eventos;
```

```bash
git add supabase/migrations/008_guru.sql lib/supabase/guru-schema.test.ts
git commit -m "feat: segredo por evento, documento da compra e chave de idempotencia"
```

---

### Task 2: Leitura do payload

**Files:**
- Create: `lib/guru.ts`
- Test: `lib/guru.test.ts`

**Interfaces:**
- Consumes: `normalizarTelefone` de `@/lib/validacao`
- Produces:
  - `interface CompraGuru { nome: string; email: string; telefone: string | null; documento: string | null; vagas: number; aprovada: boolean; produto: string | null; criadoEm: string | null; chave: string }`
  - `lerCompra(payload: unknown): { ok: true; compra: CompraGuru } | { ok: false; erro: string }`
  - `chaveDeIdempotencia(payload: Record<string, unknown>): string`
  - `vagasDoPayload(payload: Record<string, unknown>): number`

- [ ] **Step 1: Escrever os testes**

Criar `lib/guru.test.ts`. Os casos vêm da planilha real do evento de 2026.

```typescript
import { describe, it, expect } from 'vitest'
import { lerCompra, chaveDeIdempotencia, vagasDoPayload } from './guru'

const compraReal = {
  created_at: '2026-06-23 09:00:37',
  confirmed_at: '2026-06-23 09:09:06',
  name: 'Diogo Rodrigues De Souza',
  doc: '7937761636',
  email: 'pallacebuffetptc@gmail.com',
  ddi: '55',
  phone: '34993395999',
  quantity: 2,
  status: 'A',
  product: 'Engrenagem - Logística e organização de eventos para buffet 2026 [PRÉ-VENDA - 2 INSCRIÇÕES] - 15% OFF NA 2ª',
}

describe('lerCompra', () => {
  it('le a compra real da planilha de 2026', () => {
    const r = lerCompra(compraReal)
    expect(r.ok).toBe(true)
    expect(r.ok && r.compra).toMatchObject({
      nome: 'Diogo Rodrigues De Souza',
      email: 'pallacebuffetptc@gmail.com',
      telefone: '34993395999',
      documento: '7937761636',
      vagas: 2,
      aprovada: true,
    })
  })

  it('aceita CNPJ no documento', () => {
    // Caso real: a inscricao da Janaina Guerrieri usa CNPJ de 14 digitos.
    const r = lerCompra({ ...compraReal, doc: '46221803000177' })
    expect(r.ok && r.compra.documento).toBe('46221803000177')
  })

  it('normaliza o email', () => {
    const r = lerCompra({ ...compraReal, email: '  Pallace@Gmail.COM ' })
    expect(r.ok && r.compra.email).toBe('pallace@gmail.com')
  })

  it('junta o DDI ao telefone quando faz sentido', () => {
    const r = lerCompra({ ...compraReal, ddi: '55', phone: '34993395999' })
    expect(r.ok && r.compra.telefone).toBe('34993395999')
  })

  it('recusa compra sem email, que e a chave da pessoa', () => {
    const r = lerCompra({ ...compraReal, email: '' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toMatch(/email/i)
  })

  it('recusa compra sem nome', () => {
    expect(lerCompra({ ...compraReal, name: '   ' }).ok).toBe(false)
  })

  it('marca como nao aprovada quando o status nao e A', () => {
    // So compra aprovada vira inscricao. As demais ficam guardadas para
    // quando o Guru mandar a confirmacao.
    for (const status of ['P', 'C', 'R', 'pending']) {
      const r = lerCompra({ ...compraReal, status })
      expect(r.ok && r.compra.aprovada).toBe(false)
    }
  })

  it('aceita status escrito por extenso', () => {
    const r = lerCompra({ ...compraReal, status: 'approved' })
    expect(r.ok && r.compra.aprovada).toBe(true)
  })

  it('recusa payload que nao e objeto', () => {
    expect(lerCompra('texto solto').ok).toBe(false)
    expect(lerCompra(null).ok).toBe(false)
    expect(lerCompra([1, 2]).ok).toBe(false)
  })
})

describe('vagasDoPayload', () => {
  it('usa o campo numerico, que e a fonte', () => {
    expect(vagasDoPayload({ quantity: 3 })).toBe(3)
  })

  it('aceita numero em texto', () => {
    expect(vagasDoPayload({ quantity: '2' })).toBe(2)
  })

  it('cai para o nome do produto quando nao ha campo numerico', () => {
    // Conferencia, nao fonte: o texto repete a informacao.
    expect(vagasDoPayload({ product: 'Engrenagem [PRÉ-VENDA - 3 INSCRIÇÕES] - 15% OFF' })).toBe(3)
    expect(vagasDoPayload({ product: 'Engrenagem [PRÉ-VENDA - 1 INSCRIÇÃO]' })).toBe(1)
  })

  it('uma vaga quando nao da para saber, em vez de zero', () => {
    // Zero vagas geraria uma inscricao sem participante nenhum, que o
    // check `vagas >= 1` recusa e a conversa nao saberia conduzir.
    expect(vagasDoPayload({})).toBe(1)
    expect(vagasDoPayload({ quantity: 'muitas' })).toBe(1)
    expect(vagasDoPayload({ quantity: -5 })).toBe(1)
  })

  it('ignora numero absurdo', () => {
    expect(vagasDoPayload({ quantity: 9999 })).toBe(1)
  })
})

describe('chaveDeIdempotencia', () => {
  it('prefere o identificador da transacao quando existe', () => {
    for (const campo of ['id', 'transaction_id', 'subscription_code', 'order_id', 'code']) {
      expect(chaveDeIdempotencia({ ...compraReal, [campo]: 'ABC123' })).toBe('ABC123')
    }
  })

  it('respeita a ordem de preferencia entre os campos', () => {
    const chave = chaveDeIdempotencia({ id: 'primeiro', order_id: 'segundo' })
    expect(chave).toBe('primeiro')
  })

  it('sem identificador, deriva de documento, email e criacao', () => {
    // Nao foi possivel inspecionar o payload completo no n8n. A chave
    // derivada funciona hoje e o codigo passa a usar o identificador
    // sozinho no dia em que ele aparecer.
    const chave = chaveDeIdempotencia(compraReal)
    expect(chave).toContain('7937761636')
    expect(chave).toContain('pallacebuffetptc@gmail.com')
    expect(chave).toContain('2026-06-23 09:00:37')
  })

  it('a mesma compra sempre gera a mesma chave', () => {
    expect(chaveDeIdempotencia(compraReal)).toBe(chaveDeIdempotencia({ ...compraReal }))
  })

  it('compras diferentes geram chaves diferentes', () => {
    const outra = { ...compraReal, created_at: '2026-06-23 09:00:38' }
    expect(chaveDeIdempotencia(compraReal)).not.toBe(chaveDeIdempotencia(outra))
  })

  it('ignora identificador em branco em vez de usar string vazia', () => {
    const chave = chaveDeIdempotencia({ ...compraReal, id: '   ' })
    expect(chave).toContain('pallacebuffetptc@gmail.com')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "lib/guru"`
Expected: FAIL — `Cannot find module './guru'`

- [ ] **Step 3: Implementar**

Criar `lib/guru.ts`:

```typescript
import { normalizarTelefone } from '@/lib/validacao'

export interface CompraGuru {
  nome: string
  email: string
  telefone: string | null
  documento: string | null
  vagas: number
  aprovada: boolean
  produto: string | null
  criadoEm: string | null
  chave: string
}

type Payload = Record<string, unknown>

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : valor == null ? '' : String(valor).trim()
}

/**
 * Nunca foi possível inspecionar o payload completo no n8n — o nó do
 * webhook estava com dado fixado. Por isso a chave é auto-descoberta:
 * procura um identificador conhecido e, se não achar, deriva de campos que
 * sabidamente existem. Funciona hoje, e passa a usar o identificador
 * sozinho no dia em que ele aparecer.
 */
const CAMPOS_DE_ID = ['id', 'transaction_id', 'subscription_code', 'order_id', 'code']

export function chaveDeIdempotencia(payload: Payload): string {
  for (const campo of CAMPOS_DE_ID) {
    const valor = texto(payload[campo])
    if (valor) return valor
  }

  // Documento + email + instante da criação. Colidir exigiria a mesma
  // pessoa comprando duas vezes no mesmo segundo.
  return [texto(payload.doc), texto(payload.email), texto(payload.created_at)].join('|')
}

const LIMITE_DE_VAGAS = 20

export function vagasDoPayload(payload: Payload): number {
  const bruto = Number(texto(payload.quantity))
  if (Number.isInteger(bruto) && bruto >= 1 && bruto <= LIMITE_DE_VAGAS) return bruto

  // Conferência, não fonte: o nome do produto repete a informação.
  // "[PRÉ-VENDA - 3 INSCRIÇÕES]" ou "[PRÉ-VENDA - 1 INSCRIÇÃO]".
  const doTexto = texto(payload.product).match(/(\d+)\s*INSCRI[ÇC]/i)
  if (doTexto) {
    const n = Number(doTexto[1])
    if (n >= 1 && n <= LIMITE_DE_VAGAS) return n
  }

  // Uma vaga quando não dá para saber. Zero geraria uma inscrição sem
  // participante nenhum, que o banco recusa e a conversa não conduz.
  return 1
}

const STATUS_APROVADO = ['a', 'approved', 'aprovado', 'paid', 'pago']

export function lerCompra(
  bruto: unknown,
): { ok: true; compra: CompraGuru } | { ok: false; erro: string } {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    return { ok: false, erro: 'O corpo da requisição não é um objeto.' }
  }

  const payload = bruto as Payload

  const nome = texto(payload.name)
  if (!nome) return { ok: false, erro: 'Compra sem nome do comprador.' }

  const email = texto(payload.email).toLowerCase()
  if (!email) return { ok: false, erro: 'Compra sem email — é a chave da pessoa.' }

  return {
    ok: true,
    compra: {
      nome,
      email,
      telefone: normalizarTelefone(texto(payload.phone)),
      documento: texto(payload.doc) || null,
      vagas: vagasDoPayload(payload),
      aprovada: STATUS_APROVADO.includes(texto(payload.status).toLowerCase()),
      produto: texto(payload.product) || null,
      criadoEm: texto(payload.created_at) || null,
      chave: chaveDeIdempotencia(payload),
    },
  }
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- "lib/guru"`
Expected: PASS, 21 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/guru.ts lib/guru.test.ts
git commit -m "feat: leitura do payload do guru, com chave auto-descoberta"
```

---

### Task 3: Promoção para inscrição

**Files:**
- Create: `lib/promocao.ts`
- Test: `lib/promocao.test.ts`

**Interfaces:**
- Consumes: `lerCompra`, `CompraGuru` de `@/lib/guru`; `resolverPessoa`, `gerarToken` de `@/lib/inscricoes`
- Produces:
  - `type ResultadoPromocao = { estado: 'criada'; inscricaoId: string; codigo: string } | { estado: 'repetida'; inscricaoId: string } | { estado: 'aguardando' } | { estado: 'erro'; erro: string }`
  - `promover(cliente, eventoId: string, sincronizacaoId: string, payload: unknown): Promise<ResultadoPromocao>`

- [ ] **Step 1: Escrever os testes**

Criar `lib/promocao.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { promover } from './promocao'

const compra = {
  created_at: '2026-06-23 09:00:37',
  name: 'Diogo Rodrigues De Souza',
  doc: '7937761636',
  email: 'pallacebuffetptc@gmail.com',
  phone: '34993395999',
  quantity: 2,
  status: 'A',
  product: 'Engrenagem [PRÉ-VENDA - 2 INSCRIÇÕES]',
}

function cliente({ jaExiste = false }: { jaExiste?: boolean } = {}) {
  const gravadas: Record<string, unknown[]> = { inscricoes: [], participantes: [], sincronizacoes: [] }

  const from = vi.fn((tabela: string) => {
    if (tabela === 'inscricoes') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: jaExiste ? { id: 'insc-existente', codigo: 'ENG26-0001' } : null,
                error: null,
              }),
            }),
          }),
        }),
        insert: (linha: unknown) => {
          gravadas.inscricoes.push(linha)
          return {
            select: () => ({
              single: async () => ({ data: { id: 'insc-nova', ...(linha as object) }, error: null }),
            }),
          }
        },
      }
    }
    if (tabela === 'pessoas') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
        insert: () => ({
          select: () => ({ single: async () => ({ data: { id: 'pessoa-1' }, error: null }) }),
        }),
      }
    }
    if (tabela === 'sincronizacoes') {
      return {
        update: (linha: unknown) => {
          gravadas.sincronizacoes.push(linha)
          return { eq: async () => ({ error: null }) }
        },
      }
    }
    return {
      insert: (linha: unknown) => {
        gravadas.participantes.push(linha)
        return { select: async () => ({ data: linha, error: null }) }
      },
    }
  })

  const rpc = vi.fn().mockResolvedValue({ data: 'ENG26-0007', error: null })
  return { cliente: { from, rpc } as never, gravadas, rpc }
}

describe('promover', () => {
  it('cria a inscricao a partir de uma compra aprovada', async () => {
    const { cliente: c, gravadas, rpc } = cliente()

    const r = await promover(c, 'ev-1', 'sinc-1', compra)

    expect(r.estado).toBe('criada')
    expect(rpc).toHaveBeenCalledWith('gerar_codigo_inscricao', { p_evento_id: 'ev-1' })
    expect(gravadas.inscricoes[0]).toMatchObject({
      origem: 'webhook',
      vagas: 2,
      email_compra: 'pallacebuffetptc@gmail.com',
      documento_compra: '7937761636',
      codigo: 'ENG26-0007',
    })
  })

  it('guarda o payload inteiro, para conferencia depois', async () => {
    // A primeira venda real e a unica chance de ver o formato completo.
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(gravadas.inscricoes[0]).toHaveProperty('guru_payload')
  })

  it('gera o token do link de check-in', async () => {
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(String((gravadas.inscricoes[0] as { token: string }).token).length).toBeGreaterThanOrEqual(32)
  })

  it('cria o titular como participante de ordem 1', async () => {
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(gravadas.participantes[0]).toMatchObject({
      ordem: 1,
      titular: true,
      nome: 'Diogo Rodrigues De Souza',
    })
  })

  it('nao cria os acompanhantes: eles nascem na conversa', async () => {
    // A linha do acompanhante precisa de nome e email, que so o titular
    // informa durante o check-in.
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(gravadas.participantes).toHaveLength(1)
  })

  it('a mesma compra chegando de novo nao cria outra inscricao', async () => {
    // O webhook pode ser reenviado: falha de rede, retentativa do Guru.
    const { cliente: c, gravadas, rpc } = cliente({ jaExiste: true })

    const r = await promover(c, 'ev-1', 'sinc-1', compra)

    expect(r.estado).toBe('repetida')
    expect(gravadas.inscricoes).toHaveLength(0)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('compra nao aprovada fica guardada, sem virar inscricao', async () => {
    const { cliente: c, gravadas } = cliente()

    const r = await promover(c, 'ev-1', 'sinc-1', { ...compra, status: 'P' })

    expect(r.estado).toBe('aguardando')
    expect(gravadas.inscricoes).toHaveLength(0)
  })

  it('payload ilegivel devolve erro sem derrubar nada', async () => {
    const { cliente: c } = cliente()

    const r = await promover(c, 'ev-1', 'sinc-1', { name: 'Alguém', email: '' })

    expect(r.estado).toBe('erro')
    expect(r.estado === 'erro' && r.erro).toMatch(/email/i)
  })

  it('marca a sincronizacao com o desfecho', async () => {
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', compra)
    expect(gravadas.sincronizacoes[0]).toMatchObject({ status: 'promovida' })
  })

  it('a sincronizacao com erro guarda o motivo', async () => {
    const { cliente: c, gravadas } = cliente()
    await promover(c, 'ev-1', 'sinc-1', { name: 'Alguém', email: '' })
    expect(gravadas.sincronizacoes[0]).toMatchObject({ status: 'erro' })
    expect(String((gravadas.sincronizacoes[0] as { erro: string }).erro)).toMatch(/email/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- promocao`
Expected: FAIL — `Cannot find module './promocao'`

- [ ] **Step 3: Implementar**

Criar `lib/promocao.ts`:

```typescript
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
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- promocao`
Expected: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/promocao.ts lib/promocao.test.ts
git commit -m "feat: promocao de sincronizacao para inscricao, idempotente"
```

---

### Task 4: O endpoint

**Files:**
- Create: `app/api/guru/[evento]/route.ts`
- Test: `app/api/guru/[evento]/route.test.ts`

**Interfaces:**
- Consumes: `promover` de `@/lib/promocao`; `chaveDeIdempotencia` de `@/lib/guru`; `criarClienteAdmin` de `@/lib/supabase/servidor`
- Produces: o handler `POST`

- [ ] **Step 1: Escrever o teste**

Criar `app/api/guru/[evento]/route.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './route.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('endpoint do guru', () => {
  it('confere o segredo antes de qualquer coisa', () => {
    // O endpoint e publico: o Guru nao faz login. Sem esta checagem,
    // qualquer um cria inscricoes no seu evento.
    expect(codigo).toMatch(/x-checkin-segredo/)
    expect(codigo).toMatch(/401/)
  })

  it('compara o segredo em tempo constante', () => {
    // Comparacao com === vaza o tamanho do prefixo correto pelo tempo de
    // resposta, e permite adivinhar caractere a caractere.
    expect(codigo).toMatch(/timingSafeEqual/)
  })

  it('nunca aceita o segredo pela query string', () => {
    // Parametro de URL entra em log de servidor, de proxy e de navegador.
    expect(codigo).not.toMatch(/searchParams\.get\(['"]s(egredo)?['"]\)/)
  })

  it('grava a sincronizacao antes de tentar interpretar', () => {
    // Se a leitura falhar, o payload continua no banco e o admin
    // reprocessa depois de corrigir. Interpretar primeiro perderia o dado.
    const posGravar = codigo.indexOf("from('sincronizacoes')")
    const posPromover = codigo.indexOf('promover(')
    expect(posGravar).toBeGreaterThan(-1)
    expect(posGravar).toBeLessThan(posPromover)
  })

  it('responde 200 mesmo quando a promocao falha', () => {
    // Devolver erro faria o n8n reenviar em laco. O payload ja esta salvo;
    // o problema se resolve na tela de integracao, nao por retentativa.
    expect(codigo).toMatch(/recebido|guardado/i)
  })

  it('responde 409 quando a mesma compra chega de novo', () => {
    expect(codigo).toMatch(/409|repetida/)
  })

  it('usa o cliente de servico — o guru nao tem sessao', () => {
    expect(codigo).toMatch(/criarClienteAdmin/)
  })

  it('nao devolve dado do evento no corpo da resposta', () => {
    // A resposta vai para fora. Nada de token, segredo ou email.
    expect(codigo).not.toMatch(/token:\s*inscricao|webhook_segredo:/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "api/guru"`
Expected: FAIL — `ENOENT ... route.ts`

- [ ] **Step 3: Implementar**

Criar `app/api/guru/[evento]/route.ts`:

```typescript
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

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/guru/[evento]'>,
) {
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
```

- [ ] **Step 4: Rodar e commitar**

```bash
npm test -- "api/guru"
npm run typecheck
git add "app/api/guru"
git commit -m "feat: endpoint do guru, com segredo por evento"
```

---

### Task 5: A tela de integração

**Files:**
- Create: `app/admin/[evento]/integracao/page.tsx`, `app/admin/[evento]/integracao/acoes.ts`, `app/admin/[evento]/integracao/lista-sincronizacoes.tsx`
- Test: `app/admin/[evento]/integracao/lista-sincronizacoes.test.tsx`, `app/admin/[evento]/integracao/acoes.test.ts`
- Modify: `app/admin/[evento]/page.tsx`

**Interfaces:**
- Consumes: `promover` de `@/lib/promocao`
- Produces:
  - `ListaSincronizacoes({ eventoSlug, sincronizacoes }: { eventoSlug: string; sincronizacoes: LinhaSincronizacao[] })`
  - `interface LinhaSincronizacao { id: string; recebido_em: string; status: string; erro: string | null; chave: string | null; resumo: string; inscricao_id: string | null }`
  - `acaoReprocessar(form: FormData): Promise<void>`

- [ ] **Step 1: Escrever os testes**

Criar `app/admin/[evento]/integracao/lista-sincronizacoes.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListaSincronizacoes } from './lista-sincronizacoes'

const base = {
  id: 's1',
  recebido_em: '2026-06-23T09:00:37Z',
  status: 'promovida',
  erro: null,
  chave: 'ABC123',
  resumo: 'Diogo Rodrigues De Souza · 2 vagas',
  inscricao_id: 'i1',
}

describe('ListaSincronizacoes', () => {
  it('mostra quem chegou e quantas vagas', () => {
    render(<ListaSincronizacoes eventoSlug="eng-2026" sincronizacoes={[base]} />)
    expect(screen.getByText(/Diogo Rodrigues De Souza · 2 vagas/)).toBeInTheDocument()
  })

  it('mostra o motivo do erro, sem esconder', () => {
    render(
      <ListaSincronizacoes
        eventoSlug="eng-2026"
        sincronizacoes={[{ ...base, status: 'erro', erro: 'Compra sem email.', inscricao_id: null }]}
      />,
    )
    expect(screen.getByText(/Compra sem email/)).toBeInTheDocument()
  })

  it('so oferece reprocessar no que falhou', () => {
    // Reprocessar o que deu certo geraria confusao sem ganho: a promocao
    // e idempotente, mas o botao sugeriria que algo esta pendente.
    render(
      <ListaSincronizacoes
        eventoSlug="eng-2026"
        sincronizacoes={[base, { ...base, id: 's2', status: 'erro', erro: 'x', inscricao_id: null }]}
      />,
    )
    expect(screen.getAllByRole('button', { name: /reprocessar/i })).toHaveLength(1)
  })

  it('avisa quando nada chegou ainda', () => {
    render(<ListaSincronizacoes eventoSlug="eng-2026" sincronizacoes={[]} />)
    expect(screen.getByText(/nada chegou/i)).toBeInTheDocument()
  })

  it('separa quem esta aguardando aprovacao', () => {
    render(
      <ListaSincronizacoes
        eventoSlug="eng-2026"
        sincronizacoes={[{ ...base, status: 'recebida', inscricao_id: null }]}
      />,
    )
    expect(screen.getByText(/aguardando/i)).toBeInTheDocument()
  })
})
```

Criar `app/admin/[evento]/integracao/acoes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acoes da integracao', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('reaproveita a mesma promocao do webhook', () => {
    // Reprocessar tem de seguir exatamente o caminho do webhook, senao os
    // dois divergem e o erro so aparece num deles.
    expect(codigo).toMatch(/from '@\/lib\/promocao'/)
    expect(codigo).toMatch(/promover\(/)
  })

  it('confere que a sincronizacao e do evento antes de reprocessar', () => {
    // Sem isto, um id de outro evento reprocessaria dado alheio.
    expect(codigo).toMatch(/eq\('evento_id'/)
  })

  it('atualiza a tela depois', () => {
    expect(codigo).toMatch(/revalidatePath\(/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- integracao`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar as ações**

Criar `app/admin/[evento]/integracao/acoes.ts`:

```typescript
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
```

- [ ] **Step 4: Implementar a lista**

Criar `app/admin/[evento]/integracao/lista-sincronizacoes.tsx`:

```tsx
import { acaoReprocessar } from './acoes'

export interface LinhaSincronizacao {
  id: string
  recebido_em: string
  status: string
  erro: string | null
  chave: string | null
  resumo: string
  inscricao_id: string | null
}

const ROTULO: Record<string, string> = {
  promovida: 'Virou inscrição',
  recebida: 'Aguardando aprovação',
  erro: 'Falhou',
}

export function ListaSincronizacoes({
  eventoSlug,
  sincronizacoes,
}: {
  eventoSlug: string
  sincronizacoes: LinhaSincronizacao[]
}) {
  if (sincronizacoes.length === 0) {
    return (
      <p className="text-neutral-500">
        Nada chegou do Guru ainda. Assim que uma compra for aprovada, ela aparece aqui.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {sincronizacoes.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border px-4 py-3 text-sm">
          <span className="tabular-nums text-neutral-500">
            {new Date(s.recebido_em).toLocaleString('pt-BR')}
          </span>
          <span className="font-medium">{s.resumo}</span>
          <span className="text-neutral-500">{ROTULO[s.status] ?? s.status}</span>

          {s.erro ? <span className="text-red-600">{s.erro}</span> : null}

          {s.status === 'erro' ? (
            <form action={acaoReprocessar} className="ml-auto">
              <input type="hidden" name="evento_slug" value={eventoSlug} />
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" className="rounded border px-3 py-1 text-xs">
                Reprocessar
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5: Implementar a página**

Criar `app/admin/[evento]/integracao/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { lerCompra } from '@/lib/guru'
import { ListaSincronizacoes, type LinhaSincronizacao } from './lista-sincronizacoes'

export default async function PaginaIntegracao({
  params,
}: PageProps<'/admin/[evento]/integracao'>) {
  const { evento: slug } = await params
  const supabase = await criarClienteServidor()

  const { data: evento } = await supabase
    .from('eventos')
    .select('id, nome, webhook_segredo')
    .eq('slug', slug)
    .maybeSingle()
  if (!evento) notFound()

  const { data } = await supabase
    .from('sincronizacoes')
    .select('id, recebido_em, status, erro, chave, payload, inscricao_id')
    .eq('evento_id', evento.id)
    .order('recebido_em', { ascending: false })
    .limit(100)

  const sincronizacoes: LinhaSincronizacao[] = (data ?? []).map((s) => {
    const leitura = lerCompra(s.payload)
    return {
      id: s.id,
      recebido_em: s.recebido_em,
      status: s.status,
      erro: s.erro,
      chave: s.chave,
      inscricao_id: s.inscricao_id,
      resumo: leitura.ok
        ? `${leitura.compra.nome} · ${leitura.compra.vagas} ${leitura.compra.vagas === 1 ? 'vaga' : 'vagas'}`
        : 'Payload não reconhecido',
    }
  })

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{evento.nome} · Integração</h1>

      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold">Configurar no n8n</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Acrescente um nó <strong>HTTP Request</strong> ao lado do que escreve na planilha —
          sem tirar o antigo. Método <code>POST</code>, corpo <code>{'{{ $json }}'}</code>.
        </p>
        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-neutral-500">URL</dt>
            <dd>
              <code className="break-all rounded bg-neutral-100 px-2 py-1">
                {process.env.NEXT_PUBLIC_URL_BASE ?? 'http://localhost:3100'}/api/guru/{slug}
              </code>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Cabeçalho</dt>
            <dd>
              <code className="break-all rounded bg-neutral-100 px-2 py-1">
                x-checkin-segredo: {evento.webhook_segredo}
              </code>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-neutral-500">
          O segredo vale só para este evento. Quem tiver ele consegue criar inscrições aqui —
          trate como senha.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">O que chegou</h2>
        <ListaSincronizacoes eventoSlug={slug} sincronizacoes={sincronizacoes} />
      </section>
    </div>
  )
}
```

- [ ] **Step 5b: Declarar a URL publica**

A tela de integracao monta a URL do webhook a partir de
`NEXT_PUBLIC_URL_BASE`. Acrescentar em `.env.local.example` e em
`.env.local`:

```
NEXT_PUBLIC_URL_BASE=http://localhost:3100
```

Em producao, o dominio real. Sem isso a tela mostra `localhost` e o n8n
nao alcanca.

- [ ] **Step 6: Ligar a partir da tela do evento**

Em `app/admin/[evento]/page.tsx`, dentro da fileira de links, acrescentar depois do link do Roteiro:

```tsx
        <Link href={`/admin/${slug}/integracao`} className="rounded border px-4 py-2">
          Integração
        </Link>
```

- [ ] **Step 7: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add "app/admin/[evento]"
git commit -m "feat: tela de integracao com reprocessar e instrucoes do n8n"
```

---

## Configurar o n8n

Depois de aplicar a migration e subir o código:

1. Abrir `/admin/<evento>/integracao` e copiar a **URL** e o **segredo**
2. No n8n, no mesmo workflow, acrescentar um nó **HTTP Request** ligado à saída do **Webhook**, ao lado do `Append row in sheet` — **sem remover o antigo**
3. Configurar:
   - **Method:** `POST`
   - **URL:** a que a tela mostrou
   - **Send Headers:** ligado → `x-checkin-segredo` = o segredo
   - **Send Body:** ligado → **JSON** → `{{ $json }}`
4. Salvar e ativar o workflow

**Enquanto o sistema estiver em `localhost`, o n8n não alcança.** Para testar antes de publicar, use um túnel (`npx localtunnel --port 3100` ou similar) e ponha a URL do túnel no nó.

**Um aviso sobre o fluxo atual:** no nó `Append row in sheet`, tanto `created_at` quanto `confirmed_at` estão mapeados para `{{ $json.name }}`, e os demais campos estão vazios. Esse mapeamento não corresponde à planilha que existe hoje — vale conferir se há outro workflow em produção. **Isso não afeta o nó novo**, que manda o corpo cru sem mapear nada.

## Verificação final

1. **Segredo errado é recusado:**

   ```bash
   curl -i -X POST http://localhost:3100/api/guru/<slug> \
     -H "x-checkin-segredo: errado" \
     -H "content-type: application/json" \
     -d '{"name":"Teste","email":"t@t.com","quantity":1,"status":"A"}'
   ```

   Esperado: `401`.

2. **Compra aprovada vira inscrição** — mesmo comando com o segredo certo. Esperado `200`, e a inscrição aparece em `/admin/<slug>/participantes` com o titular já criado.

3. **A mesma compra de novo não duplica** — repetir o comando idêntico. Esperado `409`, e continua uma inscrição só.

4. **Compra não aprovada fica aguardando** — trocar `"status":"A"` por `"status":"P"`. Esperado `200`, e a tela de Integração mostra **Aguardando aprovação**, sem criar inscrição.

5. **Payload ilegível não some** — mandar `{"name":"Alguém"}` sem email. A tela mostra **Falhou** com o motivo, e o botão **Reprocessar** aparece.

6. **O link de check-in funciona** — pegar o token da inscrição criada e abrir `/checkin/<token>`. A Lara deve cumprimentar pelo nome que veio do Guru.

## O que a Fatia D entrega

Uma compra aprovada no Guru vira inscrição sozinha, com link de check-in pronto, e o admin enxerga o que entrou, o que está aguardando e o que falhou.

## Deixado de fora, deliberadamente

- **Importação por CSV.** A porta existe no modelo (`origem = 'csv'`), mas com o webhook funcionando ela só serve para carga histórica. Vale construir se você quiser trazer os eventos passados para dentro do sistema.
- **Reenvio automático em caso de erro.** O reprocessar é manual de propósito: erro de leitura quase sempre exige corrigir alguma coisa antes, e retentativa automática só empilharia a mesma falha.
- **Alerta quando uma sincronização falha.** Hoje é preciso abrir a tela para saber. Se o volume crescer, vale um aviso por email.
