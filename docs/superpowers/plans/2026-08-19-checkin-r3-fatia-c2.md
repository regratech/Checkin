# Check-in R3 — Fatia C2 (A conversa) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O participante abre o link com token e a Lara conduz a conversa — uma pergunta por vez, gravando cada resposta na hora, retomando de onde parou, e terminando numa revisão onde tudo pode ser corrigido.

**Architecture:** A rota `/checkin/[token]` é pública e o token é a única credencial. O servidor resolve o token, expande o roteiro e devolve ao cliente **apenas o passo atual** — nunca o roteiro inteiro nem dados de outra inscrição. Cada resposta é uma Server Action que valida, grava e devolve o próximo passo. O cliente guarda a transcrição só para exibir; a verdade está no banco, e `inscricoes.passo_atual` é o marcador de retomada.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript strict, Tailwind 4, zod 4, `@supabase/ssr`, vitest 4 com jsdom e testing-library.

## Global Constraints

- **Diretório:** `C:\Users\regra\Downloads\Checkin R3`, branch `main`, remoto `github.com/regratech/Checkin`.
- **Spec:** `docs/superpowers/specs/2026-08-18-checkin-r3-design.md`, seção 5 (a conversa).
- **Fatias A, B1, B2 e C1 entregues.** Existem: as 8 tabelas com RLS, `vw_participantes`, `gerar_codigo_inscricao`, autenticação, admin completo, tabela de participantes com abas e CSV, recuperação de senha, e o **motor de roteiro** (`lib/roteiro.ts`) com o editor de perguntas. Migrations `001` a `006`.
- **Idioma:** nomes de arquivo, função, variável, rota e teste em **português**.
- **Estilo TypeScript:** sem ponto e vírgula, aspas simples, `import type` quando for só tipo.
- **O participante nunca lê tabela.** A RLS diz "somente admin" em tudo. As rotas do check-in usam `criarClienteAdmin()` (service_role) **e por isso carregam a responsabilidade de filtrar**: toda consulta é presa ao `inscricao_id` resolvido pelo token, nunca a um id vindo do cliente.
- **Nunca confie no cliente sobre qual passo é o atual.** A Server Action re-expande o roteiro no servidor e compara com `passo_atual` gravado. Um cliente adulterado não pode pular a validação de um campo obrigatório nem responder pela inscrição de outro.
- **Código de cliente lê variáveis públicas por `lerConfigPublica()`**, nunca `lerConfigSupabase(process.env)`.
- **Depois de mudar código que o navegador executa, limpe o `.next`** antes de concluir que a correção falhou.
- **Testes que leem o fonte como texto** removem comentários e delimitam o trecho.
- **Verificação:** `npm test`, `npm run typecheck` e `npm run lint` ao fim de cada tarefa.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/007_resposta_unica_com_nulo.sql` | Corrige a unicidade que não valia para o escopo `inscricao` |
| `lib/validacao.ts` | Valida e normaliza a resposta conforme o tipo da pergunta |
| `lib/checkin.ts` | Resolve o token, monta o estado da conversa, grava resposta e avança |
| `app/checkin/[token]/page.tsx` | Resolve o token e entrega o estado inicial |
| `app/checkin/[token]/acoes.ts` | Server Actions `responder`, `voltarPara` e `concluir` |
| `app/checkin/[token]/conversa.tsx` | A transcrição e o fluxo |
| `app/checkin/[token]/campo-resposta.tsx` | O campo de entrada certo para cada tipo |
| `app/checkin/[token]/revisao.tsx` | O resumo final, com editar |

---

### Task 0: Migration 007 — a unicidade que não valia para o buffet

**Files:**
- Create: `supabase/migrations/007_resposta_unica_com_nulo.sql`
- Test: `lib/supabase/resposta-unica.test.ts`

**Interfaces:**
- Consumes: a tabela `respostas` da migration 001
- Produces: a restrição `respostas_unica_por_alvo`, agora com `nulls not distinct`

**Descoberto por sonda no banco real, antes de escrever este plano.** O
`unique (pergunta_id, inscricao_id, participante_id)` da Fatia A **não protege
nada quando `participante_id` é nulo** — e ele é nulo em toda resposta de escopo
`inscricao`, que são justamente faturamento, notas e expectativa. No Postgres,
`NULL ≠ NULL` para efeito de unicidade, então duas gravações da mesma resposta
criam duas linhas.

Consequência prática: corrigir o faturamento na revisão final geraria uma
**segunda** linha em vez de sobrescrever, e a tabela e o CSV escolheriam uma
delas por acaso. O `upsert` da Task 3 depende desta correção para funcionar.

`nulls not distinct` existe a partir do Postgres 15; o projeto roda 17.

- [ ] **Step 1: Escrever o teste**

Criar `lib/supabase/resposta-unica.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/007_resposta_unica_com_nulo.sql'),
  'utf-8',
)

describe('migration 007 - resposta unica mesmo com participante nulo', () => {
  it('recria a unicidade com nulls not distinct', () => {
    // Sem isto, duas respostas da mesma pergunta de escopo `inscricao`
    // convivem: `NULL != NULL` para efeito de unique no Postgres.
    expect(sql).toMatch(/unique nulls not distinct/i)
    expect(sql).toMatch(/\(pergunta_id, inscricao_id, participante_id\)/i)
  })

  it('remove a restricao antiga achando o nome, em vez de chutar', () => {
    // O nome gerado automaticamente e longo e pode variar; procurar no
    // catalogo e mais seguro do que escrever o nome na mao.
    expect(sql).toMatch(/pg_constraint/i)
    expect(sql).toMatch(/drop constraint/i)
  })

  it('limpa duplicatas antes de criar, senao a restricao nao nasce', () => {
    expect(sql).toMatch(/delete from respostas/i)
    expect(sql).toMatch(/row_number\(\)/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- resposta-unica`
Expected: FAIL — `ENOENT ... 007_resposta_unica_com_nulo.sql`

- [ ] **Step 3: Escrever a migration**

Criar `supabase/migrations/007_resposta_unica_com_nulo.sql`:

```sql
-- A unicidade de `respostas` nao valia para o buffet.
--
-- `unique (pergunta_id, inscricao_id, participante_id)` nao protege nada
-- quando participante_id e NULL — e ele e NULL em toda resposta de escopo
-- `inscricao`. No Postgres, NULL nunca e igual a NULL para efeito de
-- unicidade, entao duas gravacoes da mesma resposta criam duas linhas.
--
-- Na pratica: corrigir o faturamento na revisao final geraria uma segunda
-- linha em vez de sobrescrever, e a tabela e o CSV escolheriam uma delas
-- por acaso.
--
-- `nulls not distinct` existe desde o Postgres 15.

-- 1. Limpa duplicatas que ja possam existir, mantendo a mais recente.
delete from respostas r
using (
  select id, row_number() over (
    partition by pergunta_id, inscricao_id, participante_id
    order by respondido_em desc, id desc
  ) as posicao
  from respostas
) as ordenadas
where r.id = ordenadas.id and ordenadas.posicao > 1;

-- 2. Remove a restricao antiga. O nome e gerado automaticamente e pode
--    variar, entao vem do catalogo em vez de ser escrito a mao.
do $$
declare
  v_nome text;
begin
  select conname into v_nome
  from pg_constraint
  where conrelid = 'respostas'::regclass
    and contype = 'u'
    and array_length(conkey, 1) = 3;

  if v_nome is not null then
    execute format('alter table respostas drop constraint %I', v_nome);
  end if;
end $$;

-- 3. Recria contando NULL como valor comparavel.
alter table respostas
  add constraint respostas_unica_por_alvo
  unique nulls not distinct (pergunta_id, inscricao_id, participante_id);
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- resposta-unica`
Expected: PASS, 3 testes.

- [ ] **Step 5: Aplicar no Supabase**

Colar o arquivo inteiro no SQL Editor do projeto `vyjxyczbscdkfhdabrxk`. O painel vai avisar que a query tem operação destrutiva — é o `delete` do passo 1, que só remove duplicata deixando a mais recente.

Conferir depois:

```sql
select conname, connoinherit, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'respostas'::regclass and contype = 'u';
```

Deve aparecer `UNIQUE NULLS NOT DISTINCT (pergunta_id, inscricao_id, participante_id)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/007_resposta_unica_com_nulo.sql lib/supabase/resposta-unica.test.ts
git commit -m "fix: unicidade de respostas nao valia para o escopo inscricao"
```

---

### Task 1: Validação por tipo

**Files:**
- Create: `lib/validacao.ts`
- Test: `lib/validacao.test.ts`

**Interfaces:**
- Consumes: `lerOpcoes` de `@/lib/opcoes`; `Pergunta`, `TipoPergunta` de `@/lib/supabase/tipos`
- Produces:
  - `type Validado = { ok: true; valor: unknown } | { ok: false; erro: string }`
  - `validarPorTipo(tipo: TipoPergunta, bruto: unknown, opcoes?: unknown): Validado`
  - `validarResposta(pergunta: Pergunta, bruto: unknown): Validado`
  - `normalizarTelefone(bruto: string): string | null`
  - `normalizarData(bruto: string): string | null`
  - `normalizarNumero(bruto: string): number | null`

**Esta é a tarefa que apaga a sujeira do modelo antigo.** Na planilha do último evento, a coluna de aniversário tinha seis formatos — `5101978`, `25091980`, `21/04/1973`, `28 071964`, `24021996` e um `00/00/0000` — porque a coleta era texto livre. Aqui cada tipo tem uma porta estreita.

- [ ] **Step 1: Escrever os testes**

Criar `lib/validacao.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  validarPorTipo,
  normalizarData,
  normalizarNumero,
  normalizarTelefone,
} from './validacao'

describe('normalizarData', () => {
  it('aceita o formato do seletor de data', () => {
    expect(normalizarData('1978-10-05')).toBe('1978-10-05')
  })

  it('aceita o formato brasileiro com barras', () => {
    // Caso real: "21/04/1973"
    expect(normalizarData('21/04/1973')).toBe('1973-04-21')
  })

  it('aceita oito digitos colados', () => {
    // Caso real: "25091980" e "24021996"
    expect(normalizarData('25091980')).toBe('1980-09-25')
  })

  it('aceita espaco no meio dos digitos', () => {
    // Caso real: "28 071964"
    expect(normalizarData('28 071964')).toBe('1964-07-28')
  })

  it('recusa sete digitos, que sao ambiguos', () => {
    // Caso real: "5101978" pode ser 5/10/1978 ou 51/01/978. Recusar e mais
    // honesto do que adivinhar a data de aniversario de alguem.
    expect(normalizarData('5101978')).toBeNull()
  })

  it('recusa a data de preenchimento vazio', () => {
    // Caso real: "00/00/0000" entrou na planilha como se fosse dado.
    expect(normalizarData('00/00/0000')).toBeNull()
  })

  it('recusa dia e mes impossiveis', () => {
    expect(normalizarData('32/01/1990')).toBeNull()
    expect(normalizarData('15/13/1990')).toBeNull()
    expect(normalizarData('31/02/1990')).toBeNull()
  })

  it('recusa aniversario no futuro', () => {
    const proximoAno = new Date().getFullYear() + 1
    expect(normalizarData(`01/01/${proximoAno}`)).toBeNull()
  })

  it('recusa ano absurdamente antigo', () => {
    expect(normalizarData('01/01/1850')).toBeNull()
  })
})

describe('normalizarTelefone', () => {
  it('guarda so os digitos', () => {
    // Caso real: "(51) 99812-8616" e "51998128616" sao o mesmo numero.
    expect(normalizarTelefone('(51) 99812-8616')).toBe('51998128616')
  })

  it('aceita fixo com dez digitos', () => {
    expect(normalizarTelefone('1133334444')).toBe('1133334444')
  })

  it('remove o codigo do pais', () => {
    expect(normalizarTelefone('+55 51 99812-8616')).toBe('51998128616')
  })

  it('recusa numero curto demais para ter DDD', () => {
    expect(normalizarTelefone('99812')).toBeNull()
  })

  it('recusa texto sem digito nenhum', () => {
    expect(normalizarTelefone('não tenho')).toBeNull()
  })
})

describe('normalizarNumero', () => {
  it('le numero simples', () => {
    expect(normalizarNumero('500')).toBe(500)
  })

  it('ignora o que vem grudado', () => {
    // Caso real: "300 pss"
    expect(normalizarNumero('300 pss')).toBe(300)
  })

  it('entende ponto como separador de milhar', () => {
    expect(normalizarNumero('15.000')).toBe(15000)
  })

  it('entende virgula como decimal', () => {
    expect(normalizarNumero('1.500,50')).toBe(1500.5)
  })

  it('recusa texto sem numero', () => {
    expect(normalizarNumero('muitos')).toBeNull()
  })

  it('recusa negativo', () => {
    expect(normalizarNumero('-10')).toBeNull()
  })
})

describe('validarPorTipo', () => {
  it('texto curto recusa vazio', () => {
    expect(validarPorTipo('texto_curto', '   ')).toEqual({
      ok: false,
      erro: expect.stringMatching(/vazio|escreva/i),
    })
  })

  it('texto curto recusa texto gigante', () => {
    expect(validarPorTipo('texto_curto', 'a'.repeat(300)).ok).toBe(false)
  })

  it('email normaliza e aceita', () => {
    expect(validarPorTipo('email', '  Regina@Hotmail.COM ')).toEqual({
      ok: true,
      valor: 'regina@hotmail.com',
    })
  })

  it('email recusa malformado', () => {
    expect(validarPorTipo('email', 'nao-e-email').ok).toBe(false)
  })

  it('nota aceita de zero a cinco', () => {
    // A escala da planilha comeca em ZERO, nao em um.
    for (const n of [0, 1, 2, 3, 4, 5]) {
      expect(validarPorTipo('nota_estrela', String(n))).toEqual({ ok: true, valor: n })
    }
  })

  it('nota recusa seis', () => {
    expect(validarPorTipo('nota_estrela', '6').ok).toBe(false)
  })

  it('sim ou nao vira booleano', () => {
    expect(validarPorTipo('sim_nao', 'sim')).toEqual({ ok: true, valor: true })
    expect(validarPorTipo('sim_nao', 'NÃO')).toEqual({ ok: true, valor: false })
  })

  const opcoes = [
    { chave: 'faz_tudo', rotulo: 'Faço tudo' },
    { chave: 'so_administra', rotulo: 'Só administro' },
  ]

  it('selecao unica aceita chave existente', () => {
    expect(validarPorTipo('selecao_unica', 'faz_tudo', opcoes)).toEqual({
      ok: true,
      valor: 'faz_tudo',
    })
  })

  it('selecao unica recusa chave inventada', () => {
    // O cliente pode mandar qualquer coisa; so o servidor decide.
    expect(validarPorTipo('selecao_unica', 'chave_falsa', opcoes).ok).toBe(false)
  })

  it('selecao multipla aceita lista de chaves validas', () => {
    expect(validarPorTipo('selecao_multipla', ['faz_tudo', 'so_administra'], opcoes)).toEqual({
      ok: true,
      valor: ['faz_tudo', 'so_administra'],
    })
  })

  it('selecao multipla recusa se alguma chave nao existe', () => {
    expect(validarPorTipo('selecao_multipla', ['faz_tudo', 'inventada'], opcoes).ok).toBe(false)
  })

  it('selecao multipla aceita lista vazia — obrigatoriedade e decidida fora', () => {
    expect(validarPorTipo('selecao_multipla', [], opcoes)).toEqual({ ok: true, valor: [] })
  })

  it('a mensagem de erro da data ensina o formato', () => {
    const r = validarPorTipo('data', '5101978')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toMatch(/dia.*m[êe]s.*ano|dd\/mm/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- validacao`
Expected: FAIL — `Cannot find module './validacao'`

- [ ] **Step 3: Implementar**

Criar `lib/validacao.ts`:

```typescript
import { lerOpcoes } from '@/lib/opcoes'
import type { Pergunta, TipoPergunta } from '@/lib/supabase/tipos'

export type Validado = { ok: true; valor: unknown } | { ok: false; erro: string }

const ANO_MAIS_ANTIGO = 1900

/**
 * Aceita o que o seletor de data devolve (`1978-10-05`), o formato
 * brasileiro (`21/04/1973`) e oito dígitos colados (`25091980`).
 *
 * Recusa sete dígitos de propósito: `5101978` tanto pode ser 5/10/1978
 * quanto 51/01/978. Adivinhar a data de aniversário de alguém é pior do
 * que pedir de novo — e essa forma ambígua existe na planilha do último
 * evento.
 */
export function normalizarData(bruto: string): string | null {
  const texto = bruto.trim()
  if (!texto) return null

  let dia: number
  let mes: number
  let ano: number

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const barras = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  const digitos = texto.replace(/\D/g, '')

  if (iso) {
    ano = Number(iso[1])
    mes = Number(iso[2])
    dia = Number(iso[3])
  } else if (barras) {
    dia = Number(barras[1])
    mes = Number(barras[2])
    ano = Number(barras[3])
  } else if (digitos.length === 8) {
    dia = Number(digitos.slice(0, 2))
    mes = Number(digitos.slice(2, 4))
    ano = Number(digitos.slice(4))
  } else {
    return null
  }

  if (dia < 1 || mes < 1 || mes > 12) return null
  if (ano < ANO_MAIS_ANTIGO) return null

  const data = new Date(Date.UTC(ano, mes - 1, dia))
  // Pega 31/02: o Date "corrige" para 03/03 e o dia deixa de bater.
  if (data.getUTCDate() !== dia || data.getUTCMonth() !== mes - 1) return null
  if (data.getTime() > Date.now()) return null

  const dd = String(dia).padStart(2, '0')
  const mm = String(mes).padStart(2, '0')
  return `${ano}-${mm}-${dd}`
}

export function normalizarTelefone(bruto: string): string | null {
  let digitos = bruto.replace(/\D/g, '')
  // Código do país, quando a pessoa cola do WhatsApp.
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2)
  if (digitos.length < 10 || digitos.length > 11) return null
  return digitos
}

/**
 * Formato brasileiro: ponto separa milhar, vírgula separa decimal. Texto
 * grudado é ignorado — "300 pss" vira 300, caso real da planilha.
 */
export function normalizarNumero(bruto: string): number | null {
  const limpo = bruto.replace(/[^\d.,-]/g, '')
  if (!/\d/.test(limpo)) return null
  if (limpo.includes('-')) return null

  const semMilhar = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(/\.(?=\d{3}\b)/g, '')

  const n = Number(semMilhar)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function texto(bruto: unknown): string {
  return typeof bruto === 'string' ? bruto : String(bruto ?? '')
}

export function validarPorTipo(
  tipo: TipoPergunta,
  bruto: unknown,
  opcoes?: unknown,
): Validado {
  const cru = texto(bruto).trim()

  switch (tipo) {
    case 'texto_curto':
    case 'texto_longo': {
      const limite = tipo === 'texto_curto' ? 200 : 2000
      if (!cru) return { ok: false, erro: 'Escreva uma resposta.' }
      if (cru.length > limite) {
        return { ok: false, erro: `Use no máximo ${limite} caracteres.` }
      }
      return { ok: true, valor: cru }
    }

    case 'email': {
      const email = cru.toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, erro: 'Esse email não parece completo.' }
      }
      return { ok: true, valor: email }
    }

    case 'telefone': {
      const tel = normalizarTelefone(cru)
      if (!tel) return { ok: false, erro: 'Informe o telefone com DDD.' }
      return { ok: true, valor: tel }
    }

    case 'numero': {
      const n = normalizarNumero(cru)
      if (n === null) return { ok: false, erro: 'Informe um número.' }
      return { ok: true, valor: n }
    }

    case 'data': {
      const data = normalizarData(cru)
      if (!data) {
        return { ok: false, erro: 'Informe a data como dia/mês/ano — por exemplo 21/04/1973.' }
      }
      return { ok: true, valor: data }
    }

    case 'nota_estrela': {
      const n = Number(cru)
      // A escala começa em ZERO: é a da planilha do último evento.
      if (!Number.isInteger(n) || n < 0 || n > 5) {
        return { ok: false, erro: 'Escolha uma nota de 0 a 5.' }
      }
      return { ok: true, valor: n }
    }

    case 'sim_nao': {
      const s = cru.toLowerCase()
      if (['sim', 's', 'true', 'on'].includes(s)) return { ok: true, valor: true }
      if (['não', 'nao', 'n', 'false'].includes(s)) return { ok: true, valor: false }
      return { ok: false, erro: 'Responda sim ou não.' }
    }

    case 'selecao_unica': {
      const validas = lerOpcoes(opcoes).map((o) => o.chave)
      if (!validas.includes(cru)) return { ok: false, erro: 'Escolha uma das opções.' }
      return { ok: true, valor: cru }
    }

    case 'selecao_multipla': {
      const validas = lerOpcoes(opcoes).map((o) => o.chave)
      const escolhidas = Array.isArray(bruto) ? bruto.map(texto) : cru ? [cru] : []
      if (escolhidas.some((c) => !validas.includes(c))) {
        return { ok: false, erro: 'Escolha entre as opções disponíveis.' }
      }
      // Obrigatoriedade é decidida por quem chama, não aqui.
      return { ok: true, valor: escolhidas }
    }
  }
}

export function validarResposta(pergunta: Pergunta, bruto: unknown): Validado {
  return validarPorTipo(pergunta.tipo, bruto, pergunta.opcoes)
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- validacao`
Expected: PASS, 33 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/validacao.ts lib/validacao.test.ts
git commit -m "feat: validacao por tipo, com os formatos reais da planilha"
```

---

### Task 2: Estado da conversa

**Files:**
- Create: `lib/checkin.ts`
- Test: `lib/checkin.test.ts`

**Interfaces:**
- Consumes: `expandirRoteiro`, `indiceDoPasso`, `Passo` de `@/lib/roteiro`; `validarResposta` de `@/lib/validacao`
- Produces:
  - `interface EstadoConversa { inscricao: Inscricao; passos: Passo[]; indice: number; respostas: Record<string, unknown>; participantes: Participante[]; concluida: boolean }`
  - `carregarPorToken(cliente, token: string): Promise<EstadoConversa | null>`
  - `chaveDeResposta(passo: Passo): string`
  - `proximoIndice(passos: Passo[], indice: number): number`
  - `podeAvancar(passo: Passo, valor: unknown): { ok: true } | { ok: false; erro: string }`

- [ ] **Step 1: Escrever os testes**

Criar `lib/checkin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { chaveDeResposta, proximoIndice, podeAvancar } from './checkin'
import { expandirRoteiro } from './roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

const cargo: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual sua função?', tipo: 'selecao_unica', escopo: 'participante',
  obrigatoria: true, ordem: 1,
  opcoes: [{ chave: 'faz_tudo', rotulo: 'Faço tudo' }],
  ajuda: null, ativa: true,
}

const opcional: Pergunta = { ...cargo, id: 'q2', chave: 'instagram', tipo: 'texto_curto', obrigatoria: false }

describe('chaveDeResposta', () => {
  it('e a mesma chave do passo', () => {
    const passos = expandirRoteiro([cargo], 2)
    const doSegundo = passos.find((p) => p.chave === 'p2.cargo')
    expect(chaveDeResposta(doSegundo!)).toBe('p2.cargo')
  })
})

describe('proximoIndice', () => {
  it('avanca um passo', () => {
    expect(proximoIndice(expandirRoteiro([], 1), 0)).toBe(1)
  })

  it('para no ultimo, em vez de estourar o fim', () => {
    const passos = expandirRoteiro([], 1)
    expect(proximoIndice(passos, passos.length - 1)).toBe(passos.length - 1)
  })
})

describe('podeAvancar', () => {
  function passoDe(pergunta: Pergunta) {
    return expandirRoteiro([pergunta], 1).find((p) => p.pergunta?.id === pergunta.id)!
  }

  it('aceita resposta valida', () => {
    expect(podeAvancar(passoDe(cargo), 'faz_tudo')).toEqual({ ok: true })
  })

  it('recusa resposta invalida', () => {
    const r = podeAvancar(passoDe(cargo), 'inventada')
    expect(r.ok).toBe(false)
  })

  it('pergunta obrigatoria nao aceita vazio', () => {
    const r = podeAvancar(passoDe(cargo), '')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toMatch(/obrigat/i)
  })

  it('pergunta opcional aceita vazio', () => {
    expect(podeAvancar(passoDe(opcional), '')).toEqual({ ok: true })
  })

  it('passo fixo de abertura nao exige resposta', () => {
    const abertura = expandirRoteiro([], 1)[0]
    expect(podeAvancar(abertura, undefined)).toEqual({ ok: true })
  })

  it('nome do participante e sempre obrigatorio', () => {
    // Os campos do nucleo nao sao configuraveis: sem nome, o cracha nao sai.
    const passoNome = expandirRoteiro([], 2).find((p) => p.chave === 'p2.nome')!
    expect(podeAvancar(passoNome, '').ok).toBe(false)
    expect(podeAvancar(passoNome, 'Leonardo Guerrieri')).toEqual({ ok: true })
  })

  it('email do participante e validado como email', () => {
    const passoEmail = expandirRoteiro([], 2).find((p) => p.chave === 'p2.email')!
    expect(podeAvancar(passoEmail, 'nao-e-email').ok).toBe(false)
    expect(podeAvancar(passoEmail, 'leo@guerry.com')).toEqual({ ok: true })
  })

  it('telefone e aniversario do participante sao opcionais', () => {
    // Na planilha real varios acompanhantes vieram sem um ou outro. Travar
    // a conversa por isso faria o titular abandonar o check-in.
    const passos = expandirRoteiro([], 2)
    expect(podeAvancar(passos.find((p) => p.chave === 'p2.telefone')!, '')).toEqual({ ok: true })
    expect(podeAvancar(passos.find((p) => p.chave === 'p2.data_nascimento')!, '')).toEqual({
      ok: true,
    })
  })

  it('aniversario preenchido ainda precisa ser data valida', () => {
    const passo = expandirRoteiro([], 2).find((p) => p.chave === 'p2.data_nascimento')!
    expect(podeAvancar(passo, '00/00/0000').ok).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "lib/checkin"`
Expected: FAIL — `Cannot find module './checkin'`

- [ ] **Step 3: Implementar**

Criar `lib/checkin.ts`:

```typescript
import { expandirRoteiro, indiceDoPasso, type CampoFixo, type Passo } from '@/lib/roteiro'
import { validarPorTipo, validarResposta } from '@/lib/validacao'
import type {
  Inscricao,
  Participante,
  Pergunta,
  TipoPergunta,
} from '@/lib/supabase/tipos'

export interface EstadoConversa {
  inscricao: Inscricao
  passos: Passo[]
  indice: number
  /** Chaveado pela chave do passo. */
  respostas: Record<string, unknown>
  participantes: Participante[]
  concluida: boolean
}

/**
 * O recorte do estado que vai para o navegador. Vive aqui, e nao em
 * `conversa.tsx`, porque `revisao.tsx` tambem precisa dele — e conversa ja
 * importa revisao, o que fecharia um ciclo.
 */
export interface EstadoSerializado {
  passos: Passo[]
  indice: number
  respostas: Record<string, unknown>
  nomeTitular: string
  vagas: number
  concluida: boolean
}

export function chaveDeResposta(passo: Passo): string {
  return passo.chave
}

export function proximoIndice(passos: Passo[], indice: number): number {
  return Math.min(indice + 1, passos.length - 1)
}

/**
 * Como cada campo do núcleo é validado. Não é configurável: sem nome não
 * sai crachá, e um email torto quebra o contato depois.
 */
const NUCLEO: Partial<Record<CampoFixo, { tipo: TipoPergunta; obrigatorio: boolean }>> = {
  nome: { tipo: 'texto_curto', obrigatorio: true },
  email: { tipo: 'email', obrigatorio: true },
  // Telefone e aniversário faltaram em vários acompanhantes na planilha
  // real. Travar a conversa por isso faria o titular abandonar o check-in.
  telefone: { tipo: 'telefone', obrigatorio: false },
  data_nascimento: { tipo: 'data', obrigatorio: false },
  nome_cracha: { tipo: 'texto_curto', obrigatorio: false },
}

function vazio(valor: unknown): boolean {
  if (valor === undefined || valor === null) return true
  if (Array.isArray(valor)) return valor.length === 0
  return String(valor).trim() === ''
}

export function podeAvancar(
  passo: Passo,
  valor: unknown,
): { ok: true } | { ok: false; erro: string } {
  if (passo.pergunta) {
    const p: Pergunta = passo.pergunta
    if (vazio(valor)) {
      return p.obrigatoria
        ? { ok: false, erro: 'Essa resposta é obrigatória.' }
        : { ok: true }
    }
    const r = validarResposta(p, valor)
    return r.ok ? { ok: true } : { ok: false, erro: r.erro }
  }

  const regra = passo.fixo ? NUCLEO[passo.fixo] : undefined
  // Passos sem regra — abertura, confirmação, buffet, revisão — não pedem
  // resposta; são conduzidos pela própria tela.
  if (!regra) return { ok: true }

  if (vazio(valor)) {
    return regra.obrigatorio
      ? { ok: false, erro: 'Esse campo é obrigatório.' }
      : { ok: true }
  }

  const r = validarPorTipo(regra.tipo, valor)
  return r.ok ? { ok: true } : { ok: false, erro: r.erro }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClienteSupabase = any

/**
 * Resolve o token e monta o estado da conversa.
 *
 * Roda com `service_role` porque a RLS não abre nada para o público — e
 * **por isso** toda consulta abaixo é presa ao `inscricao_id` que o token
 * resolveu. Nenhum id vem do cliente.
 */
export async function carregarPorToken(
  cliente: ClienteSupabase,
  token: string,
): Promise<EstadoConversa | null> {
  const { data: inscricao } = await cliente
    .from('inscricoes')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!inscricao) return null

  const [{ data: perguntas }, { data: participantes }, { data: respostas }] =
    await Promise.all([
      cliente
        .from('perguntas')
        .select('*')
        .eq('evento_id', inscricao.evento_id)
        .eq('ativa', true)
        .order('ordem'),
      cliente
        .from('participantes')
        .select('*')
        .eq('inscricao_id', inscricao.id)
        .order('ordem'),
      cliente.from('respostas').select('*').eq('inscricao_id', inscricao.id),
    ])

  const passos = expandirRoteiro((perguntas ?? []) as Pergunta[], inscricao.vagas)

  // O marcador pode apontar para um passo que não existe mais, se uma
  // pergunta foi removida entre a interrupção e a volta. `indiceDoPasso`
  // devolve zero nesse caso, em vez de travar.
  const indice = inscricao.passo_atual ? indiceDoPasso(passos, inscricao.passo_atual) : 0

  const porChave: Record<string, unknown> = {}
  for (const r of (respostas ?? []) as Array<{
    pergunta_id: string
    participante_id: string | null
    valor: unknown
  }>) {
    const passo = passos.find((p) => {
      if (p.pergunta?.id !== r.pergunta_id) return false
      if (r.participante_id === null) return p.alvo.tipo === 'inscricao'
      const dono = (participantes ?? []).find(
        (x: Participante) => x.id === r.participante_id,
      )
      return p.alvo.tipo === 'participante' && dono?.ordem === p.alvo.ordem
    })
    if (passo) porChave[passo.chave] = r.valor
  }

  return {
    inscricao: inscricao as Inscricao,
    passos,
    indice,
    respostas: porChave,
    participantes: (participantes ?? []) as Participante[],
    concluida: inscricao.status_checkin === 'concluido',
  }
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- "lib/checkin"`
Expected: PASS, 12 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/checkin.ts lib/checkin.test.ts
git commit -m "feat: estado da conversa resolvido pelo token"
```

---

### Task 3: Server Actions do check-in

**Files:**
- Create: `app/checkin/[token]/acoes.ts`
- Test: `app/checkin/[token]/acoes.test.ts`

**Interfaces:**
- Consumes: `carregarPorToken`, `podeAvancar`, `proximoIndice` de `@/lib/checkin`; `criarClienteAdmin` de `@/lib/supabase/servidor`
- Produces:
  - `type RespostaAcao = { ok: true } | { ok: false; erro: string }`
  - `responder(token: string, chavePasso: string, valor: unknown): Promise<RespostaAcao>`
  - `voltarPara(token: string, chavePasso: string): Promise<RespostaAcao>`
  - `concluir(token: string): Promise<RespostaAcao>`

- [ ] **Step 1: Escrever o teste**

Criar `app/checkin/[token]/acoes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('acoes do check-in', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('resolve tudo pelo token, nunca por id vindo do cliente', () => {
    // O token e a unica credencial. Aceitar um inscricao_id do cliente
    // deixaria qualquer um escrever na inscricao de outro buffet.
    expect(codigo).toMatch(/carregarPorToken\(/)
    expect(codigo).not.toMatch(/inscricao_id:\s*(form|entrada|dados)\./)
  })

  it('re-expande o roteiro no servidor antes de gravar', () => {
    // Nao confiar no cliente sobre qual e o passo atual: um cliente
    // adulterado pularia a validacao de um campo obrigatorio.
    expect(codigo).toMatch(/podeAvancar\(/)
  })

  it('recusa responder um passo que nao e o atual', () => {
    expect(codigo).toMatch(/passo_atual|indice/)
  })

  it('grava a resposta e avanca o marcador', () => {
    expect(codigo).toMatch(/passo_atual:/)
  })

  it('marca em_andamento ao primeiro passo e concluido no fim', () => {
    expect(codigo).toMatch(/em_andamento/)
    expect(codigo).toMatch(/concluido/)
  })

  it('recusa escrever numa inscricao ja concluida', () => {
    // Sem isso, o link continua editavel para sempre depois de fechado.
    expect(codigo).toMatch(/concluida/)
  })

  it('usa o cliente de servico, que ignora RLS — e por isso filtra por token', () => {
    expect(codigo).toMatch(/criarClienteAdmin/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "checkin/\[token\]/acoes"`
Expected: FAIL — `ENOENT ... acoes.ts`

- [ ] **Step 3: Implementar**

Criar `app/checkin/[token]/acoes.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteAdmin } from '@/lib/supabase/servidor'
import { carregarPorToken, podeAvancar, proximoIndice } from '@/lib/checkin'
import type { Passo } from '@/lib/roteiro'

export type RespostaAcao = { ok: true } | { ok: false; erro: string }

/* eslint-disable @typescript-eslint/no-explicit-any */

async function gravarValor(cliente: any, inscricaoId: string, passo: Passo, valor: unknown) {
  if (passo.pergunta) {
    const participanteId =
      passo.alvo.tipo === 'participante'
        ? (
            await cliente
              .from('participantes')
              .select('id')
              .eq('inscricao_id', inscricaoId)
              .eq('ordem', passo.alvo.ordem)
              .maybeSingle()
          ).data?.id ?? null
        : null

    await cliente.from('respostas').upsert(
      {
        pergunta_id: passo.pergunta.id,
        escopo: passo.pergunta.escopo,
        inscricao_id: inscricaoId,
        participante_id: participanteId,
        valor,
      },
      { onConflict: 'pergunta_id,inscricao_id,participante_id' },
    )
    return
  }

  // Campos do núcleo vão para a própria linha do participante. A lista é
  // fechada de propósito: `confirmar_titular`, `abertura`, `buffet` e
  // `revisao` também são passos com `fixo`, e usá-los como nome de coluna
  // quebraria a gravação.
  const COLUNAS_DO_NUCLEO = ['nome', 'email', 'telefone', 'data_nascimento', 'nome_cracha']

  if (
    passo.alvo.tipo === 'participante' &&
    passo.fixo &&
    COLUNAS_DO_NUCLEO.includes(passo.fixo)
  ) {
    await cliente
      .from('participantes')
      .update({ [passo.fixo]: valor })
      .eq('inscricao_id', inscricaoId)
      .eq('ordem', passo.alvo.ordem)
  }
}

export async function responder(
  token: string,
  chavePasso: string,
  valor: unknown,
): Promise<RespostaAcao> {
  const cliente = criarClienteAdmin()
  const estado = await carregarPorToken(cliente, token)

  if (!estado) return { ok: false, erro: 'Link inválido.' }
  if (estado.concluida) return { ok: false, erro: 'Este check-in já foi concluído.' }

  // Nunca confiar no cliente sobre qual é o passo atual: um cliente
  // adulterado pularia a validação de um campo obrigatório.
  const passo = estado.passos[estado.indice]
  if (!passo || passo.chave !== chavePasso) {
    return { ok: false, erro: 'Esse passo já foi respondido. Recarregue a página.' }
  }

  const permitido = podeAvancar(passo, valor)
  if (!permitido.ok) return permitido

  await gravarValor(cliente, estado.inscricao.id, passo, valor)

  const seguinte = estado.passos[proximoIndice(estado.passos, estado.indice)]
  await cliente
    .from('inscricoes')
    .update({ passo_atual: seguinte.chave, status_checkin: 'em_andamento' })
    .eq('id', estado.inscricao.id)

  revalidatePath(`/checkin/${token}`)
  return { ok: true }
}

/** Usado pela revisão final, para corrigir um campo já respondido. */
export async function voltarPara(token: string, chavePasso: string): Promise<RespostaAcao> {
  const cliente = criarClienteAdmin()
  const estado = await carregarPorToken(cliente, token)

  if (!estado) return { ok: false, erro: 'Link inválido.' }
  if (!estado.passos.some((p) => p.chave === chavePasso)) {
    return { ok: false, erro: 'Esse passo não existe mais.' }
  }

  await cliente
    .from('inscricoes')
    .update({ passo_atual: chavePasso })
    .eq('id', estado.inscricao.id)

  revalidatePath(`/checkin/${token}`)
  return { ok: true }
}

export async function concluir(token: string): Promise<RespostaAcao> {
  const cliente = criarClienteAdmin()
  const estado = await carregarPorToken(cliente, token)

  if (!estado) return { ok: false, erro: 'Link inválido.' }

  await cliente
    .from('inscricoes')
    .update({ status_checkin: 'concluido', concluido_em: new Date().toISOString() })
    .eq('id', estado.inscricao.id)

  revalidatePath(`/checkin/${token}`)
  return { ok: true }
}
```

- [ ] **Step 4: Rodar e commitar**

```bash
npm test -- "checkin"
npm run typecheck
git add "app/checkin"
git commit -m "feat: acoes do check-in, com o passo validado no servidor"
```

---

### Task 4: O campo de resposta

**Files:**
- Create: `app/checkin/[token]/campo-resposta.tsx`
- Test: `app/checkin/[token]/campo-resposta.test.tsx`

**Interfaces:**
- Consumes: `Passo` de `@/lib/roteiro`; `lerOpcoes`, `rotuloDaOpcao` de `@/lib/opcoes`
- Produces: `CampoResposta({ passo, valorInicial, onResponder, enviando }: { passo: Passo; valorInicial?: unknown; onResponder: (valor: unknown) => void; enviando: boolean })`

- [ ] **Step 1: Escrever o teste**

Criar `app/checkin/[token]/campo-resposta.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoResposta } from './campo-resposta'
import { expandirRoteiro } from '@/lib/roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

function passoDe(pergunta: Pergunta, vagas = 1) {
  return expandirRoteiro([pergunta], vagas).find((p) => p.pergunta?.id === pergunta.id)!
}

const base: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual sua função?', tipo: 'selecao_unica', escopo: 'participante',
  obrigatoria: true, ordem: 1,
  opcoes: [
    { chave: 'faz_tudo', rotulo: 'Faço tudo', rotulo_acompanhante: 'Faz tudo' },
    { chave: 'administra', rotulo: 'Só administro', rotulo_acompanhante: 'Só administra' },
  ],
  ajuda: null, ativa: true,
}

describe('CampoResposta', () => {
  it('selecao unica vira botoes, um por opcao', () => {
    render(
      <CampoResposta passo={passoDe(base)} onResponder={vi.fn()} enviando={false} />,
    )
    expect(screen.getByRole('button', { name: 'Faço tudo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Só administro' })).toBeInTheDocument()
  })

  it('o titular ve a primeira pessoa', () => {
    render(<CampoResposta passo={passoDe(base, 1)} onResponder={vi.fn()} enviando={false} />)
    expect(screen.getByRole('button', { name: 'Faço tudo' })).toBeInTheDocument()
  })

  it('o acompanhante ve a terceira pessoa', () => {
    // O mesmo papel, dito na voz certa. E o que impede quatro funcoes
    // virarem oito valores distintos, como aconteceu na planilha.
    const passoDoSegundo = expandirRoteiro([base], 2).find((p) => p.chave === 'p2.cargo')!
    render(<CampoResposta passo={passoDoSegundo} onResponder={vi.fn()} enviando={false} />)
    expect(screen.getByRole('button', { name: 'Faz tudo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Faço tudo' })).not.toBeInTheDocument()
  })

  it('clicar numa opcao responde com a chave, nao com o texto', async () => {
    const responder = vi.fn()
    render(<CampoResposta passo={passoDe(base)} onResponder={responder} enviando={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Faço tudo' }))
    expect(responder).toHaveBeenCalledWith('faz_tudo')
  })

  it('nota vira seis botoes, de zero a cinco', () => {
    const nota = { ...base, id: 'q2', tipo: 'nota_estrela' as const, opcoes: null }
    render(<CampoResposta passo={passoDe(nota)} onResponder={vi.fn()} enviando={false} />)
    for (const n of ['0', '1', '2', '3', '4', '5']) {
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
    }
  })

  it('data usa o seletor nativo', () => {
    const data = { ...base, id: 'q3', tipo: 'data' as const, opcoes: null }
    const { container } = render(
      <CampoResposta passo={passoDe(data)} onResponder={vi.fn()} enviando={false} />,
    )
    expect(container.querySelector('input[type="date"]')).toBeTruthy()
  })

  it('telefone usa teclado numerico no celular', () => {
    const tel = { ...base, id: 'q4', tipo: 'telefone' as const, opcoes: null }
    const { container } = render(
      <CampoResposta passo={passoDe(tel)} onResponder={vi.fn()} enviando={false} />,
    )
    expect(container.querySelector('input[type="tel"]')).toBeTruthy()
  })

  it('texto longo usa area de texto', () => {
    const longo = { ...base, id: 'q5', tipo: 'texto_longo' as const, opcoes: null }
    const { container } = render(
      <CampoResposta passo={passoDe(longo)} onResponder={vi.fn()} enviando={false} />,
    )
    expect(container.querySelector('textarea')).toBeTruthy()
  })

  it('tudo fica desabilitado enquanto grava', () => {
    render(<CampoResposta passo={passoDe(base)} onResponder={vi.fn()} enviando />)
    expect(screen.getByRole('button', { name: 'Faço tudo' })).toBeDisabled()
  })

  it('campo opcional oferece pular', () => {
    const opcional = { ...base, id: 'q6', tipo: 'texto_curto' as const, obrigatoria: false, opcoes: null }
    render(<CampoResposta passo={passoDe(opcional)} onResponder={vi.fn()} enviando={false} />)
    expect(screen.getByRole('button', { name: /pular/i })).toBeInTheDocument()
  })

  it('campo obrigatorio nao oferece pular', () => {
    render(<CampoResposta passo={passoDe(base)} onResponder={vi.fn()} enviando={false} />)
    expect(screen.queryByRole('button', { name: /pular/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- campo-resposta`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `app/checkin/[token]/campo-resposta.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { lerOpcoes, rotuloDaOpcao } from '@/lib/opcoes'
import type { Passo } from '@/lib/roteiro'
import type { TipoPergunta } from '@/lib/supabase/tipos'

const TIPO_DO_CAMPO: Record<string, TipoPergunta> = {
  nome: 'texto_curto',
  email: 'email',
  telefone: 'telefone',
  data_nascimento: 'data',
  nome_cracha: 'texto_curto',
}

/** O tipo efetivo do passo: da pergunta, ou do campo do núcleo. */
function tipoDoPasso(passo: Passo): TipoPergunta | null {
  if (passo.pergunta) return passo.pergunta.tipo
  return passo.fixo ? (TIPO_DO_CAMPO[passo.fixo] ?? null) : null
}

function ehObrigatorio(passo: Passo): boolean {
  if (passo.pergunta) return passo.pergunta.obrigatoria
  return passo.fixo === 'nome' || passo.fixo === 'email'
}

const ATRIBUTO: Partial<Record<TipoPergunta, string>> = {
  email: 'email',
  telefone: 'tel',
  numero: 'number',
  data: 'date',
}

export function CampoResposta({
  passo,
  valorInicial,
  onResponder,
  enviando,
}: {
  passo: Passo
  valorInicial?: unknown
  onResponder: (valor: unknown) => void
  enviando: boolean
}) {
  const [texto, setTexto] = useState(valorInicial === undefined ? '' : String(valorInicial))
  const [marcadas, setMarcadas] = useState<string[]>(
    Array.isArray(valorInicial) ? (valorInicial as string[]) : [],
  )

  const tipo = tipoDoPasso(passo)
  if (!tipo) return null

  const opcoes = lerOpcoes(passo.pergunta?.opcoes)
  const opcional = !ehObrigatorio(passo)

  const botaoPular = opcional ? (
    <button
      type="button"
      disabled={enviando}
      onClick={() => onResponder('')}
      className="text-sm text-neutral-500 underline disabled:opacity-50"
    >
      Pular
    </button>
  ) : null

  if (tipo === 'selecao_unica') {
    return (
      <div className="flex flex-col items-start gap-2">
        {opcoes.map((o) => (
          <button
            key={o.chave}
            type="button"
            disabled={enviando}
            onClick={() => onResponder(o.chave)}
            className="rounded-full border px-4 py-2 text-left text-sm disabled:opacity-50"
          >
            {rotuloDaOpcao(o, passo.titular)}
          </button>
        ))}
        {botaoPular}
      </div>
    )
  }

  if (tipo === 'selecao_multipla') {
    return (
      <div className="flex flex-col items-start gap-2">
        {opcoes.map((o) => {
          const marcada = marcadas.includes(o.chave)
          return (
            <button
              key={o.chave}
              type="button"
              aria-pressed={marcada}
              disabled={enviando}
              onClick={() =>
                setMarcadas((atual) =>
                  marcada ? atual.filter((c) => c !== o.chave) : [...atual, o.chave],
                )
              }
              className={`rounded-full border px-4 py-2 text-left text-sm disabled:opacity-50 ${
                marcada ? 'border-neutral-900 bg-neutral-900 text-white' : ''
              }`}
            >
              {rotuloDaOpcao(o, passo.titular)}
            </button>
          )
        })}
        <button
          type="button"
          disabled={enviando}
          onClick={() => onResponder(marcadas)}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    )
  }

  if (tipo === 'nota_estrela') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={enviando}
            onClick={() => onResponder(String(n))}
            className="h-10 w-10 rounded-full border text-sm disabled:opacity-50"
          >
            {n}
          </button>
        ))}
        {botaoPular}
      </div>
    )
  }

  if (tipo === 'sim_nao') {
    return (
      <div className="flex items-center gap-2">
        {[
          ['sim', 'Sim'],
          ['nao', 'Não'],
        ].map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            disabled={enviando}
            onClick={() => onResponder(valor)}
            className="rounded-full border px-5 py-2 text-sm disabled:opacity-50"
          >
            {rotulo}
          </button>
        ))}
        {botaoPular}
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onResponder(texto)
      }}
      className="flex flex-col items-start gap-2"
    >
      {tipo === 'texto_longo' ? (
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={enviando}
          rows={3}
          autoFocus
          className="w-full rounded border px-3 py-2"
        />
      ) : (
        <input
          type={ATRIBUTO[tipo] ?? 'text'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={enviando}
          autoFocus
          className="w-full rounded border px-3 py-2"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {enviando ? 'Gravando…' : 'Continuar'}
        </button>
        {botaoPular}
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Rodar e commitar**

```bash
npm test -- campo-resposta
npm run typecheck
git add "app/checkin"
git commit -m "feat: campo de resposta por tipo, com a voz certa nas opcoes"
```

---

### Task 5: A conversa

**Files:**
- Create: `app/checkin/[token]/conversa.tsx`, `app/checkin/[token]/page.tsx`
- Test: `app/checkin/[token]/conversa.test.tsx`

**Interfaces:**
- Consumes: `CampoResposta`; `responder` de `./acoes`; `EstadoConversa` de `@/lib/checkin`
- Produces: `Conversa({ token, estado }: { token: string; estado: EstadoSerializado })` onde `EstadoSerializado = { passos: Passo[]; indice: number; respostas: Record<string, unknown>; nomeTitular: string; vagas: number; concluida: boolean }`

- [ ] **Step 1: Escrever o teste**

Criar `app/checkin/[token]/conversa.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Conversa } from './conversa'
import { expandirRoteiro } from '@/lib/roteiro'
import type { Pergunta } from '@/lib/supabase/tipos'

vi.mock('./acoes', () => ({
  responder: vi.fn().mockResolvedValue({ ok: true }),
  voltarPara: vi.fn().mockResolvedValue({ ok: true }),
  concluir: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const cargo: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual sua função no buffet?', tipo: 'selecao_unica',
  escopo: 'participante', obrigatoria: true, ordem: 1,
  opcoes: [{ chave: 'faz_tudo', rotulo: 'Faço tudo' }], ajuda: null, ativa: true,
}

function estado(indice: number, vagas = 2) {
  return {
    passos: expandirRoteiro([cargo], vagas),
    indice,
    respostas: {},
    nomeTitular: 'Marina',
    vagas,
    concluida: false,
  }
}

describe('Conversa', () => {
  it('cumprimenta pelo nome e diz quantas vagas', () => {
    render(<Conversa token="t" estado={estado(0)} />)
    expect(screen.getByText(/Marina/)).toBeInTheDocument()
    expect(screen.getByText(/2 vagas/)).toBeInTheDocument()
  })

  it('mostra o contador de pessoa quando o passo e de participante', () => {
    // "pessoa 2 de 2" e o que impede a sensacao de conversa infinita.
    const e = estado(0)
    const indice = e.passos.findIndex((p) => p.chave === 'p2.nome')
    render(<Conversa token="t" estado={{ ...e, indice }} />)
    expect(screen.getByText(/pessoa 2 de 2/i)).toBeInTheDocument()
  })

  it('nao mostra contador nos passos do buffet', () => {
    const e = estado(0)
    const indice = e.passos.findIndex((p) => p.fixo === 'buffet')
    render(<Conversa token="t" estado={{ ...e, indice }} />)
    expect(screen.queryByText(/pessoa \d+ de/i)).not.toBeInTheDocument()
  })

  it('mostra a pergunta do passo atual', () => {
    const e = estado(0)
    const indice = e.passos.findIndex((p) => p.chave === 'p1.cargo')
    render(<Conversa token="t" estado={{ ...e, indice }} />)
    expect(screen.getByText(/Qual sua função no buffet\?/)).toBeInTheDocument()
  })

  it('mostra a barra de progresso', () => {
    render(<Conversa token="t" estado={estado(3)} />)
    const barra = screen.getByRole('progressbar')
    expect(barra).toHaveAttribute('aria-valuenow', '3')
  })

  it('no fim, mostra a revisao em vez de um campo', () => {
    const e = estado(0)
    const indice = e.passos.findIndex((p) => p.fixo === 'revisao')
    render(<Conversa token="t" estado={{ ...e, indice }} />)
    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument()
  })

  it('check-in ja concluido nao mostra campo nenhum', () => {
    render(<Conversa token="t" estado={{ ...estado(0), concluida: true }} />)
    expect(screen.getByText(/já foi concluído|tudo certo/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- conversa`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar a conversa**

Criar `app/checkin/[token]/conversa.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CampoResposta } from './campo-resposta'
import { Revisao } from './revisao'
import { responder } from './acoes'
import type { EstadoSerializado } from '@/lib/checkin'

const TEXTO_FIXO: Record<string, string> = {
  confirmar_titular: 'Começando por você. Confere se está certo?',
  nome: 'Qual o nome completo?',
  email: 'Qual o email?',
  telefone: 'Qual o telefone, com DDD?',
  data_nascimento: 'Qual a data de aniversário?',
  nome_cracha: 'Como quer o nome no crachá?',
  buffet: 'Agora me conta sobre o buffet.',
}

export function Conversa({ token, estado }: { token: string; estado: EstadoSerializado }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [enviando, iniciarTransicao] = useTransition()

  const passo = estado.passos[estado.indice]

  if (estado.concluida) {
    return (
      <div className="rounded border p-6 text-center">
        <p className="text-lg font-medium">Tudo certo!</p>
        <p className="mt-2 text-neutral-600">
          Seu check-in já foi concluído. Ao chegar, o nome estará na lista de presença e o
          crachá será retirado na entrada.
        </p>
      </div>
    )
  }

  function enviar(valor: unknown) {
    setErro('')
    iniciarTransicao(async () => {
      const r = await responder(token, passo.chave, valor)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  const contador =
    passo.alvo.tipo === 'participante'
      ? `Pessoa ${passo.alvo.ordem} de ${estado.vagas}`
      : null

  const fala = passo.pergunta
    ? passo.pergunta.texto_chat
    : passo.fixo === 'abertura'
      ? `Oi, ${estado.nomeTitular}! Você garantiu ${estado.vagas} ${
          estado.vagas === 1 ? 'vaga' : 'vagas'
        }. Vou precisar dos dados de cada pessoa — leva uns 4 minutos.`
      : (TEXTO_FIXO[passo.fixo ?? ''] ?? '')

  return (
    <div className="flex flex-col gap-6">
      <div
        role="progressbar"
        aria-valuenow={estado.indice}
        aria-valuemin={0}
        aria-valuemax={estado.passos.length - 1}
        aria-label="Progresso do check-in"
        className="h-1 w-full overflow-hidden rounded bg-neutral-200"
      >
        <div
          className="h-full bg-neutral-900 transition-all"
          style={{ width: `${(estado.indice / (estado.passos.length - 1)) * 100}%` }}
        />
      </div>

      {contador ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {contador}
        </p>
      ) : null}

      {passo.fixo === 'revisao' ? (
        <Revisao token={token} estado={estado} />
      ) : (
        <>
          <p className="text-lg">{fala}</p>

          {passo.fixo === 'abertura' ? (
            <button
              type="button"
              disabled={enviando}
              onClick={() => enviar('')}
              className="self-start rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              Vamos lá
            </button>
          ) : (
            <CampoResposta
              passo={passo}
              valorInicial={estado.respostas[passo.chave]}
              onResponder={enviar}
              enviando={enviando}
            />
          )}
        </>
      )}

      {erro ? (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Implementar a página**

Criar `app/checkin/[token]/page.tsx`:

```tsx
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
          Confira se copiou o endereço inteiro. Se o problema continuar, responda o email da
          sua inscrição que a gente resolve.
        </p>
      </main>
    )
  }

  const titular = estado.participantes.find((p) => p.titular)

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg p-6">
      <Conversa
        token={token}
        estado={{
          passos: estado.passos,
          indice: estado.indice,
          respostas: estado.respostas,
          nomeTitular:
            (titular?.nome ?? estado.inscricao.nome_compra ?? '').split(' ')[0] || 'tudo bem',
          vagas: estado.inscricao.vagas,
          concluida: estado.concluida,
        }}
      />
    </main>
  )
}
```

- [ ] **Step 5: Rodar e commitar**

```bash
npm test -- conversa
npm run typecheck
git add "app/checkin"
git commit -m "feat: a conversa da lara, um passo por vez"
```

---

### Task 6: Revisão e conclusão

**Files:**
- Create: `app/checkin/[token]/revisao.tsx`
- Test: `app/checkin/[token]/revisao.test.tsx`

**Interfaces:**
- Consumes: `voltarPara`, `concluir` de `./acoes`; `EstadoSerializado` de `@/lib/checkin`
- Produces: `Revisao({ token, estado }: { token: string; estado: EstadoSerializado })`

A revisão é o que resolve a fraqueza estrutural do chat: não dá para voltar. Aqui dá, sem refazer a conversa.

- [ ] **Step 1: Escrever o teste**

Criar `app/checkin/[token]/revisao.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Revisao } from './revisao'
import { expandirRoteiro } from '@/lib/roteiro'
import { voltarPara } from './acoes'
import type { Pergunta } from '@/lib/supabase/tipos'

vi.mock('./acoes', () => ({
  voltarPara: vi.fn().mockResolvedValue({ ok: true }),
  concluir: vi.fn().mockResolvedValue({ ok: true }),
  responder: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const cargo: Pergunta = {
  id: 'q1', evento_id: 'e1', chave: 'cargo', rotulo: 'Cargo',
  texto_chat: 'Qual sua função?', tipo: 'selecao_unica', escopo: 'participante',
  obrigatoria: true, ordem: 1,
  opcoes: [{ chave: 'faz_tudo', rotulo: 'Faço tudo' }], ajuda: null, ativa: true,
}

const passos = expandirRoteiro([cargo], 2)

const estado = {
  passos,
  indice: passos.length - 1,
  respostas: { 'p1.cargo': 'faz_tudo', 'p2.nome': 'Leonardo Guerrieri' },
  nomeTitular: 'Janaína',
  vagas: 2,
  concluida: false,
}

describe('Revisao', () => {
  it('agrupa o resumo por pessoa', () => {
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getByText(/pessoa 1/i)).toBeInTheDocument()
    expect(screen.getByText(/pessoa 2/i)).toBeInTheDocument()
  })

  it('mostra o que foi respondido', () => {
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getByText('Leonardo Guerrieri')).toBeInTheDocument()
  })

  it('traduz a chave da opcao para o texto que a pessoa escolheu', () => {
    // Mostrar "faz_tudo" na revisao seria incompreensivel.
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getByText('Faço tudo')).toBeInTheDocument()
  })

  it('avisa o que ficou em branco, sem esconder', () => {
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getAllByText(/em branco/i).length).toBeGreaterThan(0)
  })

  it('cada item tem um botao de corrigir', async () => {
    render(<Revisao token="t" estado={estado} />)
    const botoes = screen.getAllByRole('button', { name: /corrigir/i })
    await userEvent.click(botoes[0])
    expect(voltarPara).toHaveBeenCalledWith('t', expect.any(String))
  })

  it('tem o botao de concluir', () => {
    render(<Revisao token="t" estado={estado} />)
    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- revisao`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `app/checkin/[token]/revisao.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { concluir, voltarPara } from './acoes'
import { lerOpcoes, rotuloDaOpcao } from '@/lib/opcoes'
import type { Passo } from '@/lib/roteiro'
import type { EstadoSerializado } from '@/lib/checkin'

const NOME_FIXO: Record<string, string> = {
  nome: 'Nome',
  email: 'Email',
  telefone: 'Telefone',
  data_nascimento: 'Aniversário',
  nome_cracha: 'Crachá',
}

/** Mostrar `faz_tudo` na revisão seria incompreensível. */
function mostrar(passo: Passo, valor: unknown): string {
  if (valor === undefined || valor === null || String(valor).trim() === '') return ''

  if (passo.pergunta) {
    const opcoes = lerOpcoes(passo.pergunta.opcoes)
    if (Array.isArray(valor)) {
      return valor
        .map((c) => {
          const o = opcoes.find((x) => x.chave === c)
          return o ? rotuloDaOpcao(o, passo.titular) : String(c)
        })
        .join(', ')
    }
    const o = opcoes.find((x) => x.chave === valor)
    if (o) return rotuloDaOpcao(o, passo.titular)
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  }

  return String(valor)
}

function rotulo(passo: Passo): string {
  if (passo.pergunta) return passo.pergunta.rotulo
  return NOME_FIXO[passo.fixo ?? ''] ?? passo.chave
}

export function Revisao({ token, estado }: { token: string; estado: EstadoSerializado }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [ocupado, iniciarTransicao] = useTransition()

  // Só os passos que guardam alguma resposta — abertura e revisão não entram.
  const revisaveis = estado.passos.filter(
    (p) => p.pergunta !== undefined || NOME_FIXO[p.fixo ?? ''] !== undefined,
  )

  const grupos = new Map<string, Passo[]>()
  for (const p of revisaveis) {
    const titulo =
      p.alvo.tipo === 'participante' ? `Pessoa ${p.alvo.ordem}` : 'Buffet'
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), p])
  }

  function corrigir(chave: string) {
    setErro('')
    iniciarTransicao(async () => {
      const r = await voltarPara(token, chave)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  function fechar() {
    setErro('')
    iniciarTransicao(async () => {
      const r = await concluir(token)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-lg">Pronto! Confere pra mim antes de fechar.</p>

      {[...grupos.entries()].map(([titulo, passos]) => (
        <section key={titulo} className="rounded border">
          <h2 className="border-b bg-neutral-50 px-4 py-2 text-sm font-semibold">{titulo}</h2>
          <ul>
            {passos.map((p) => {
              const texto = mostrar(p, estado.respostas[p.chave])
              return (
                <li
                  key={p.chave}
                  className="flex items-center gap-3 border-b px-4 py-2 text-sm last:border-0"
                >
                  <span className="w-28 shrink-0 text-neutral-500">{rotulo(p)}</span>
                  <span className={`flex-1 ${texto ? '' : 'text-neutral-400'}`}>
                    {texto || 'em branco'}
                  </span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => corrigir(p.chave)}
                    aria-label={`Corrigir ${rotulo(p)} de ${titulo}`}
                    className="text-xs underline disabled:opacity-50"
                  >
                    Corrigir
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {erro ? (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      ) : null}

      <button
        type="button"
        disabled={ocupado}
        onClick={fechar}
        className="self-start rounded bg-neutral-900 px-5 py-2.5 text-white disabled:opacity-50"
      >
        {ocupado ? 'Fechando…' : 'Concluir check-in'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add "app/checkin"
git commit -m "feat: revisao final com correcao por item"
```

---

## Verificação final no navegador

Antes: limpe o `.next` se mexeu em código de cliente.

Pré-requisito: existir um evento com pelo menos duas perguntas (uma de cada escopo) e uma inscrição criada pelo admin.

1. No SQL Editor, pegue o link:

   ```sql
   select 'http://localhost:3100/checkin/' || token from inscricoes order by criado_em desc limit 1;
   ```

2. Abrir o link **numa aba anônima** — deve funcionar sem login. Esse é o ponto: o participante não tem conta.
3. A abertura cumprimenta pelo primeiro nome e diz quantas vagas
4. Responder até a pessoa 2 → o contador "Pessoa 2 de N" aparece
5. **Fechar a aba no meio e reabrir o link** — deve retomar no mesmo passo, não do começo. É o que o Typebot não faz.
6. Numa pergunta de cargo, conferir que o **acompanhante** vê a opção na terceira pessoa
7. Digitar `00/00/0000` no aniversário → recusa com a mensagem que ensina o formato
8. Digitar `5101978` → também recusa, por ser ambíguo
9. Na revisão, **Corrigir** um item → volta àquele passo; responder de novo volta para a revisão
10. **Concluir** → mensagem de fechado; reabrir o link mostra "Tudo certo!" sem campo nenhum
11. No admin, `/admin/<evento>/participantes` → os dados aparecem, e o status vira Concluído

## O que a Fatia C2 entrega

O produto completo para o participante: link sem senha, conversa guiada, gravação a cada resposta, retomada e revisão.

**O que fica para a Fatia D:** a integração com o Guru — hoje via planilha, ver o adendo no spec.

## Deixado de fora, deliberadamente

- **Limite de tentativas por token.** O token é longo e aleatório; um atacante precisaria de tentativas astronômicas. Vale rever se o sistema for exposto na internet aberta.
- **Aviso quando o admin edita o roteiro no meio de um check-in.** Se uma pergunta some, `indiceDoPasso` devolve zero e a conversa recomeça — as respostas já gravadas continuam lá, mas a pessoa refaz o caminho. Aceitável enquanto o roteiro for montado antes do evento; vale rever se virar hábito editar com check-ins em andamento.
