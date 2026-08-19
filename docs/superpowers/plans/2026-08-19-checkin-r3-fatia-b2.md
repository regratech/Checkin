# Check-in R3 — Fatia B2 (Ver e filtrar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tabela geral de participantes, com as abas por tamanho de grupo (`Geral · 1 · 2 · 3 · 4+`), busca, exportação CSV — e o fluxo de redefinir senha.

**Architecture:** As visões são Server Components que leem `vw_participantes` pela sessão do admin. O estado da visão vive **na URL**, não em `useState`: `?grupo=2&status=pendente&busca=guerry`. Isso torna a tela compartilhável por link, sobrevivente ao recarregar, e navegável pelo botão voltar. A lógica testável — agrupar, montar CSV, ler filtros — fica em funções puras.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript strict, Tailwind 4, zod 4, `@supabase/ssr`, vitest 4 com jsdom e testing-library.

## Global Constraints

- **Diretório:** `C:\Users\regra\Downloads\Checkin R3`, branch `main`, remoto `github.com/regratech/Checkin`.
- **Spec:** `docs/superpowers/specs/2026-08-18-checkin-r3-design.md`, seção 6.1 para as abas.
- **Fatias A e B1 entregues.** Existem as 8 tabelas com RLS, `vw_participantes`, `gerar_codigo_inscricao()`, autenticação, `proxy.ts`, moldura do admin, criar evento e inscrição manual.
- **Idioma:** nomes de arquivo, função, variável, rota e teste em **português**.
- **Estilo TypeScript:** sem ponto e vírgula, aspas simples, `import type` quando for só tipo.
- **O número que define a aba é `inscricoes.vagas`**, o que foi comprado — nunca `pessoas_preenchidas`. `vagas` é estável desde a compra; a contagem de preenchidos muda durante o check-in e faria as linhas pularem de aba enquanto o titular digita. Ver spec 6.1.
- **`service_role` não aparece em nenhuma tela.** Toda leitura passa pela sessão e pela RLS.
- **O dev server precisa de `NODE_EXTRA_CA_CERTS`** apontando para o certificado do Avast, senão toda chamada ao Supabase falha com `fetch failed` status 0. Já está em `.claude/launch.json`. Roda na porta **3100**; a 3000 é do projeto Engrenagem.
- **Testes que leem o fonte como texto devem remover comentários antes de asserções negativas** e delimitar o trecho examinado. Duas asserções da B1 reprovaram código correto por não fazer isso.
- **Verificação:** `npm test`, `npm run typecheck` e `npm run lint` ao fim de cada tarefa.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/participantes.ts` | Tipos da view, leitura dos filtros da URL, consulta, agrupamento |
| `lib/csv.ts` | Montagem do CSV, com escape e separador certos |
| `app/admin/[evento]/participantes/page.tsx` | A tela: abas + tabela |
| `app/admin/[evento]/participantes/abas-tamanho.tsx` | A fileira `Geral · 1 · 2 · 3 · 4+` |
| `app/admin/[evento]/participantes/campo-busca.tsx` | Busca que escreve na URL |
| `app/admin/[evento]/participantes/tabela-plana.tsx` | Uma linha por pessoa (aba Geral) |
| `app/admin/[evento]/participantes/grupos.tsx` | Agrupado por inscrição (abas de tamanho) |
| `app/admin/[evento]/participantes/exportar/route.ts` | Baixa o CSV respeitando os filtros |
| `lib/supabase/recuperacao.ts` | Clientes com `flowType: 'implicit'` |
| `app/recuperar-senha/{page,acoes}.tsx` | Pede o email e dispara |
| `app/nova-senha/page.tsx` | Lê o token do fragmento e troca a senha |

---

### Task 1: Consulta e filtros

**Files:**
- Create: `lib/participantes.ts`
- Test: `lib/participantes.test.ts`

**Interfaces:**
- Consumes: `StatusCheckin` de `@/lib/supabase/tipos`
- Produces:
  - `interface LinhaParticipante` — o formato de `vw_participantes`
  - `type Grupo = '1' | '2' | '3' | '4+' | 'todos'`
  - `interface Filtros { grupo: Grupo; status: StatusCheckin | 'todos'; busca: string }`
  - `lerFiltros(sp: Record<string, string | string[] | undefined>): Filtros`
  - `aplicarFiltroDeGrupo<T>(consulta: T, grupo: Grupo): T`
  - `agruparPorInscricao(linhas: LinhaParticipante[]): GrupoInscricao[]`
  - `interface GrupoInscricao { codigo: string; empresa_nome: string | null; empresa_cidade: string | null; vagas: number; preenchidos: number; completo: boolean; participantes: LinhaParticipante[] }`

- [ ] **Step 1: Escrever os testes**

Criar `lib/participantes.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import {
  lerFiltros,
  aplicarFiltroDeGrupo,
  agruparPorInscricao,
  type LinhaParticipante,
} from './participantes'

describe('lerFiltros', () => {
  it('sem nada na URL, mostra tudo', () => {
    expect(lerFiltros({})).toEqual({ grupo: 'todos', status: 'todos', busca: '' })
  })

  it('le grupo, status e busca', () => {
    expect(lerFiltros({ grupo: '2', status: 'pendente', busca: ' guerry ' })).toEqual({
      grupo: '2',
      status: 'pendente',
      busca: 'guerry',
    })
  })

  it('ignora valor de grupo que nao existe, em vez de quebrar', () => {
    // A URL e digitavel: ?grupo=99 nao pode derrubar a pagina.
    expect(lerFiltros({ grupo: '99' }).grupo).toBe('todos')
    expect(lerFiltros({ grupo: 'DROP TABLE' }).grupo).toBe('todos')
  })

  it('ignora status que nao existe', () => {
    expect(lerFiltros({ status: 'inventado' }).status).toBe('todos')
  })

  it('aceita 4+ como grupo', () => {
    expect(lerFiltros({ grupo: '4+' }).grupo).toBe('4+')
  })

  it('usa o primeiro valor quando o parametro vem repetido', () => {
    expect(lerFiltros({ grupo: ['2', '3'] }).grupo).toBe('2')
  })
})

describe('aplicarFiltroDeGrupo', () => {
  function consultaFalsa() {
    const eq = vi.fn()
    const gte = vi.fn()
    const alvo = { eq, gte }
    eq.mockReturnValue(alvo)
    gte.mockReturnValue(alvo)
    return alvo
  }

  it('filtra por igualdade exata de 1 a 3', () => {
    const c = consultaFalsa()
    aplicarFiltroDeGrupo(c, '2')
    expect(c.eq).toHaveBeenCalledWith('vagas', 2)
  })

  it('4+ e maior ou igual a 4, para nenhum lote grande sumir', () => {
    // Se o Guru passar a vender 6 vagas, essas inscricoes precisam aparecer
    // em algum lugar. Sem o >=, ficariam invisiveis.
    const c = consultaFalsa()
    aplicarFiltroDeGrupo(c, '4+')
    expect(c.gte).toHaveBeenCalledWith('vagas', 4)
  })

  it('todos nao filtra nada', () => {
    const c = consultaFalsa()
    aplicarFiltroDeGrupo(c, 'todos')
    expect(c.eq).not.toHaveBeenCalled()
    expect(c.gte).not.toHaveBeenCalled()
  })

  it('filtra por vagas, nunca por pessoas_preenchidas', () => {
    // pessoas_preenchidas muda durante o check-in e faria a linha pular de
    // aba enquanto o titular digita. Ver spec 6.1.
    const c = consultaFalsa()
    aplicarFiltroDeGrupo(c, '3')
    expect(c.eq).not.toHaveBeenCalledWith('pessoas_preenchidas', expect.anything())
  })
})

function linha(p: Partial<LinhaParticipante>): LinhaParticipante {
  return {
    id: 'x',
    inscricao_id: 'i1',
    pessoa_id: 'p1',
    ordem: 1,
    titular: false,
    nome: 'Alguem',
    email: null,
    telefone: null,
    data_nascimento: null,
    nome_cracha: null,
    cargo: null,
    evento_id: 'e1',
    codigo: 'ENG26-0001',
    codigo_participante: 'ENG26-0001-1',
    vagas: 2,
    pessoas_preenchidas: 2,
    empresa_nome: 'Buffet X',
    empresa_cidade: 'São Paulo',
    empresa_instagram: null,
    status_checkin: 'concluido',
    ...p,
  }
}

describe('agruparPorInscricao', () => {
  it('junta as linhas da mesma inscricao, na ordem dos participantes', () => {
    const grupos = agruparPorInscricao([
      linha({ inscricao_id: 'i1', ordem: 2, nome: 'Leonardo' }),
      linha({ inscricao_id: 'i1', ordem: 1, nome: 'Janaína', titular: true }),
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].participantes.map((p) => p.nome)).toEqual(['Janaína', 'Leonardo'])
  })

  it('mantem os grupos na ordem do codigo', () => {
    const grupos = agruparPorInscricao([
      linha({ inscricao_id: 'i2', codigo: 'ENG26-0002' }),
      linha({ inscricao_id: 'i1', codigo: 'ENG26-0001' }),
    ])
    expect(grupos.map((g) => g.codigo)).toEqual(['ENG26-0001', 'ENG26-0002'])
  })

  it('marca como incompleto quem comprou mais vagas do que preencheu', () => {
    // E assim que se enxerga quem comprou 3 e cadastrou 2 — hoje invisivel.
    const grupos = agruparPorInscricao([
      linha({ inscricao_id: 'i1', vagas: 3, pessoas_preenchidas: 2, ordem: 1 }),
      linha({ inscricao_id: 'i1', vagas: 3, pessoas_preenchidas: 2, ordem: 2 }),
    ])
    expect(grupos[0]).toMatchObject({ vagas: 3, preenchidos: 2, completo: false })
  })

  it('marca como completo quando bate', () => {
    const grupos = agruparPorInscricao([
      linha({ inscricao_id: 'i1', vagas: 1, pessoas_preenchidas: 1 }),
    ])
    expect(grupos[0].completo).toBe(true)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(agruparPorInscricao([])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- participantes`
Expected: FAIL — `Cannot find module './participantes'`

- [ ] **Step 3: Implementar**

Criar `lib/participantes.ts`:

```typescript
import { STATUS_CHECKIN, type StatusCheckin } from '@/lib/supabase/tipos'

export interface LinhaParticipante {
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
  evento_id: string
  codigo: string
  codigo_participante: string
  vagas: number
  pessoas_preenchidas: number
  empresa_nome: string | null
  empresa_cidade: string | null
  empresa_instagram: string | null
  status_checkin: StatusCheckin
}

export const GRUPOS = ['todos', '1', '2', '3', '4+'] as const
export type Grupo = (typeof GRUPOS)[number]

export interface Filtros {
  grupo: Grupo
  status: StatusCheckin | 'todos'
  busca: string
}

type ParametrosUrl = Record<string, string | string[] | undefined>

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ''
}

/**
 * A URL e digitavel por qualquer um: `?grupo=99` nao pode derrubar a pagina.
 * Valor desconhecido vira o padrao, em silencio.
 */
export function lerFiltros(sp: ParametrosUrl): Filtros {
  const grupo = primeiro(sp.grupo) as Grupo
  const status = primeiro(sp.status) as StatusCheckin

  return {
    grupo: GRUPOS.includes(grupo) ? grupo : 'todos',
    status: STATUS_CHECKIN.includes(status) ? status : 'todos',
    busca: primeiro(sp.busca).trim(),
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * O filtro e sempre sobre `vagas` — o que foi comprado —, nunca sobre
 * `pessoas_preenchidas`. A contagem de preenchidos muda durante o check-in
 * e faria a linha pular de aba enquanto o titular ainda digita.
 */
export function aplicarFiltroDeGrupo<T extends { eq: any; gte: any }>(
  consulta: T,
  grupo: Grupo,
): T {
  if (grupo === 'todos') return consulta
  // `4+` e `>= 4` para que lotes maiores, se o Guru passar a vende-los,
  // apareçam em algum lugar em vez de sumir.
  if (grupo === '4+') return consulta.gte('vagas', 4)
  return consulta.eq('vagas', Number(grupo))
}

export interface GrupoInscricao {
  codigo: string
  empresa_nome: string | null
  empresa_cidade: string | null
  vagas: number
  preenchidos: number
  completo: boolean
  participantes: LinhaParticipante[]
}

export function agruparPorInscricao(linhas: LinhaParticipante[]): GrupoInscricao[] {
  const porInscricao = new Map<string, LinhaParticipante[]>()

  for (const l of linhas) {
    const atual = porInscricao.get(l.inscricao_id)
    if (atual) atual.push(l)
    else porInscricao.set(l.inscricao_id, [l])
  }

  return [...porInscricao.values()]
    .map((participantes) => {
      const ordenados = [...participantes].sort((a, b) => a.ordem - b.ordem)
      const primeira = ordenados[0]
      return {
        codigo: primeira.codigo,
        empresa_nome: primeira.empresa_nome,
        empresa_cidade: primeira.empresa_cidade,
        vagas: primeira.vagas,
        preenchidos: primeira.pessoas_preenchidas,
        completo: primeira.pessoas_preenchidas >= primeira.vagas,
        participantes: ordenados,
      }
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- participantes`
Expected: PASS, 15 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/participantes.ts lib/participantes.test.ts
git commit -m "feat: filtros da url e agrupamento por inscricao"
```

---

### Task 2: Montagem do CSV

**Files:**
- Create: `lib/csv.ts`
- Test: `lib/csv.test.ts`

**Interfaces:**
- Consumes: `LinhaParticipante` de `@/lib/participantes`
- Produces: `montarCsv(linhas: LinhaParticipante[]): string` e `nomeArquivoCsv(eventoSlug: string, grupo: string): string`

- [ ] **Step 1: Escrever os testes**

Criar `lib/csv.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { montarCsv, nomeArquivoCsv } from './csv'
import type { LinhaParticipante } from './participantes'

function linha(p: Partial<LinhaParticipante>): LinhaParticipante {
  return {
    id: 'x',
    inscricao_id: 'i1',
    pessoa_id: 'p1',
    ordem: 1,
    titular: true,
    nome: 'Janaína Garcia Guerrieri',
    email: 'laguerryeventos@gmail.com',
    telefone: '51998128616',
    data_nascimento: '1978-10-05',
    nome_cracha: 'Janaina Guerrieri',
    cargo: 'Sócia',
    evento_id: 'e1',
    codigo: 'ENG26-0001',
    codigo_participante: 'ENG26-0001-1',
    vagas: 2,
    pessoas_preenchidas: 2,
    empresa_nome: 'La Guerry Gastronomia',
    empresa_cidade: 'Porto Alegre / RS',
    empresa_instagram: '@laguerrygastronomia',
    status_checkin: 'concluido',
    ...p,
  }
}

describe('montarCsv', () => {
  it('comeca com BOM, para o Excel brasileiro nao comer os acentos', () => {
    // Sem BOM, "Janaína" abre como "JanaÃ­na" no Excel em portugues.
    expect(montarCsv([linha({})]).startsWith('\uFEFF')).toBe(true)
  })

  it('separa por ponto e virgula, que e o padrao do Excel em portugues', () => {
    const csv = montarCsv([linha({})])
    const cabecalho = csv.replace('\uFEFF', '').split('\r\n')[0]
    expect(cabecalho.split(';').length).toBeGreaterThan(5)
    expect(cabecalho).toContain('Código')
  })

  it('traz o codigo do participante na primeira coluna', () => {
    const csv = montarCsv([linha({})])
    const primeiraLinha = csv.replace('\uFEFF', '').split('\r\n')[1]
    expect(primeiraLinha.startsWith('ENG26-0001-1;')).toBe(true)
  })

  it('protege o separador dentro do valor', () => {
    // "Porto Alegre / RS" e inofensivo, mas "Souza; Filho" quebraria a coluna.
    const csv = montarCsv([linha({ nome: 'Souza; Filho' })])
    expect(csv).toContain('"Souza; Filho"')
  })

  it('dobra a aspa dentro do valor', () => {
    const csv = montarCsv([linha({ empresa_nome: 'Buffet "O Sabor"' })])
    expect(csv).toContain('"Buffet ""O Sabor"""')
  })

  it('protege a quebra de linha dentro do valor', () => {
    const csv = montarCsv([linha({ cargo: 'Sócia\nFundadora' })])
    expect(csv).toContain('"Sócia\nFundadora"')
  })

  it('escreve campo nulo como vazio, nunca como a palavra null', () => {
    const csv = montarCsv([linha({ telefone: null, cargo: null })])
    expect(csv).not.toMatch(/null/)
  })

  it('traduz titular para Sim e Não', () => {
    expect(montarCsv([linha({ titular: true })])).toContain(';Sim;')
    expect(montarCsv([linha({ titular: false })])).toContain(';Não;')
  })

  it('usa CRLF entre as linhas', () => {
    const csv = montarCsv([linha({ ordem: 1 }), linha({ ordem: 2 })])
    expect(csv.replace('\uFEFF', '').split('\r\n')).toHaveLength(3)
  })

  it('lista vazia devolve so o cabecalho', () => {
    const csv = montarCsv([]).replace('\uFEFF', '')
    expect(csv.split('\r\n')).toHaveLength(1)
  })
})

describe('nomeArquivoCsv', () => {
  it('junta evento e visao', () => {
    expect(nomeArquivoCsv('engrenagem-2026', '2')).toBe(
      'engrenagem-2026-2-pessoas.csv',
    )
  })

  it('a visao geral nao vira "todos-pessoas"', () => {
    expect(nomeArquivoCsv('engrenagem-2026', 'todos')).toBe('engrenagem-2026-geral.csv')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- csv`
Expected: FAIL — `Cannot find module './csv'`

- [ ] **Step 3: Implementar**

Criar `lib/csv.ts`:

```typescript
import type { LinhaParticipante } from '@/lib/participantes'

const COLUNAS: Array<[titulo: string, ler: (l: LinhaParticipante) => string]> = [
  ['Código', (l) => l.codigo_participante],
  ['Nome', (l) => l.nome],
  ['Email', (l) => l.email ?? ''],
  ['Telefone', (l) => l.telefone ?? ''],
  ['Aniversário', (l) => l.data_nascimento ?? ''],
  ['Crachá', (l) => l.nome_cracha ?? ''],
  ['Cargo', (l) => l.cargo ?? ''],
  ['Titular', (l) => (l.titular ? 'Sim' : 'Não')],
  ['Buffet', (l) => l.empresa_nome ?? ''],
  ['Cidade', (l) => l.empresa_cidade ?? ''],
  ['Instagram', (l) => l.empresa_instagram ?? ''],
  ['Vagas', (l) => String(l.vagas)],
  ['Preenchidos', (l) => String(l.pessoas_preenchidas)],
  ['Status', (l) => l.status_checkin],
]

// Ponto e virgula: e o separador que o Excel em portugues espera. Com
// virgula, a planilha abre com tudo espremido numa coluna so.
const SEPARADOR = ';'

function escapar(valor: string): string {
  if (valor.includes(SEPARADOR) || valor.includes('"') || /[\r\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`
  }
  return valor
}

export function montarCsv(linhas: LinhaParticipante[]): string {
  const cabecalho = COLUNAS.map(([titulo]) => escapar(titulo)).join(SEPARADOR)
  const corpo = linhas.map((l) =>
    COLUNAS.map(([, ler]) => escapar(ler(l))).join(SEPARADOR),
  )

  // BOM: sem ele o Excel em portugues le o arquivo como Latin-1 e
  // "Janaína" vira "JanaÃ­na".
  return '\uFEFF' + [cabecalho, ...corpo].join('\r\n')
}

export function nomeArquivoCsv(eventoSlug: string, grupo: string): string {
  const visao = grupo === 'todos' ? 'geral' : `${grupo}-pessoas`
  return `${eventoSlug}-${visao}.csv`
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- csv`
Expected: PASS, 12 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/csv.ts lib/csv.test.ts
git commit -m "feat: csv com BOM e ponto e virgula, para o excel brasileiro"
```

---

### Task 3: As abas, o status e a busca

**Files:**
- Create: `app/admin/[evento]/participantes/abas-tamanho.tsx`, `app/admin/[evento]/participantes/chips-status.tsx`, `app/admin/[evento]/participantes/campo-busca.tsx`
- Test: `app/admin/[evento]/participantes/abas-tamanho.test.tsx`, `app/admin/[evento]/participantes/chips-status.test.tsx`, `app/admin/[evento]/participantes/campo-busca.test.tsx`

**Interfaces:**
- Consumes: `Grupo`, `Filtros` de `@/lib/participantes`; `StatusCheckin` de `@/lib/supabase/tipos`
- Produces:
  - `AbasTamanho({ eventoSlug, atual, contagens }: { eventoSlug: string; atual: Grupo; contagens: Record<Grupo, number> })`
  - `ChipsStatus({ eventoSlug, filtros }: { eventoSlug: string; filtros: Filtros })`
  - `CampoBusca({ valorInicial }: { valorInicial: string })`

- [ ] **Step 1: Escrever o teste das abas**

Criar `app/admin/[evento]/participantes/abas-tamanho.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AbasTamanho } from './abas-tamanho'

const contagens = { todos: 187, '1': 64, '2': 48, '3': 51, '4+': 24 }

describe('AbasTamanho', () => {
  it('mostra as cinco visoes', () => {
    render(<AbasTamanho eventoSlug="eng-2026" atual="todos" contagens={contagens} />)
    for (const rotulo of [/geral/i, /1 pessoa/i, /2 pessoas/i, /3 pessoas/i, /4\+/]) {
      expect(screen.getByRole('link', { name: rotulo })).toBeInTheDocument()
    }
  })

  it('mostra a contagem de cada visao', () => {
    render(<AbasTamanho eventoSlug="eng-2026" atual="todos" contagens={contagens} />)
    expect(screen.getByRole('link', { name: /2 pessoas/i })).toHaveTextContent('48')
  })

  it('cada aba e um link com o grupo na URL, nao um botao', () => {
    // Estado na URL: a visao fica compartilhavel por link, sobrevive ao
    // recarregar e o botao voltar funciona.
    render(<AbasTamanho eventoSlug="eng-2026" atual="todos" contagens={contagens} />)
    expect(screen.getByRole('link', { name: /3 pessoas/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?grupo=3',
    )
  })

  it('a visao geral nao carrega parametro sobrando', () => {
    render(<AbasTamanho eventoSlug="eng-2026" atual="2" contagens={contagens} />)
    expect(screen.getByRole('link', { name: /geral/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes',
    )
  })

  it('marca a aba atual para leitor de tela', () => {
    render(<AbasTamanho eventoSlug="eng-2026" atual="2" contagens={contagens} />)
    expect(screen.getByRole('link', { name: /2 pessoas/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- abas-tamanho`
Expected: FAIL — `Cannot find module './abas-tamanho'`

- [ ] **Step 3: Implementar as abas**

Criar `app/admin/[evento]/participantes/abas-tamanho.tsx`:

```tsx
import Link from 'next/link'
import { GRUPOS, type Grupo } from '@/lib/participantes'

const ROTULOS: Record<Grupo, string> = {
  todos: 'Geral',
  '1': '1 pessoa',
  '2': '2 pessoas',
  '3': '3 pessoas',
  '4+': '4+ pessoas',
}

export function AbasTamanho({
  eventoSlug,
  atual,
  contagens,
}: {
  eventoSlug: string
  atual: Grupo
  contagens: Record<Grupo, number>
}) {
  const base = `/admin/${eventoSlug}/participantes`

  return (
    <nav className="flex flex-wrap gap-2">
      {GRUPOS.map((grupo) => {
        const ativo = grupo === atual
        // A visao padrao nao leva parametro: a URL limpa e a canonica.
        const href = grupo === 'todos' ? base : `${base}?grupo=${encodeURIComponent(grupo)}`

        return (
          <Link
            key={grupo}
            href={href}
            aria-current={ativo ? 'page' : undefined}
            className={`rounded border px-3 py-1.5 text-sm ${
              ativo ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'
            }`}
          >
            {ROTULOS[grupo]}
            <span className={`ml-2 ${ativo ? 'text-neutral-300' : 'text-neutral-500'}`}>
              {contagens[grupo]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3b: Escrever o teste dos chips de status**

Criar `app/admin/[evento]/participantes/chips-status.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChipsStatus } from './chips-status'
import type { Filtros } from '@/lib/participantes'

const filtros: Filtros = { grupo: 'todos', status: 'todos', busca: '' }

describe('ChipsStatus', () => {
  it('mostra os quatro estados', () => {
    render(<ChipsStatus eventoSlug="eng-2026" filtros={filtros} />)
    for (const r of [/todos/i, /pendente/i, /em andamento/i, /concluído/i]) {
      expect(screen.getByRole('link', { name: r })).toBeInTheDocument()
    }
  })

  it('preserva o grupo escolhido ao trocar o status', () => {
    // Trocar o status dentro da aba "2 pessoas" nao pode jogar a pessoa de
    // volta para a visao geral.
    render(<ChipsStatus eventoSlug="eng-2026" filtros={{ ...filtros, grupo: '2' }} />)
    expect(screen.getByRole('link', { name: /pendente/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?grupo=2&status=pendente',
    )
  })

  it('preserva a busca ao trocar o status', () => {
    render(<ChipsStatus eventoSlug="eng-2026" filtros={{ ...filtros, busca: 'guerry' }} />)
    expect(screen.getByRole('link', { name: /concluído/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?status=concluido&busca=guerry',
    )
  })

  it('o chip "todos" limpa so o status', () => {
    render(<ChipsStatus eventoSlug="eng-2026" filtros={{ grupo: '3', status: 'pendente', busca: 'x' }} />)
    expect(screen.getByRole('link', { name: /todos/i })).toHaveAttribute(
      'href',
      '/admin/eng-2026/participantes?grupo=3&busca=x',
    )
  })

  it('marca o status atual para leitor de tela', () => {
    render(<ChipsStatus eventoSlug="eng-2026" filtros={{ ...filtros, status: 'pendente' }} />)
    expect(screen.getByRole('link', { name: /pendente/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
```

- [ ] **Step 3c: Rodar e ver falhar**

Run: `npm test -- chips-status`
Expected: FAIL — `Cannot find module './chips-status'`

- [ ] **Step 3d: Implementar os chips**

Criar `app/admin/[evento]/participantes/chips-status.tsx`:

```tsx
import Link from 'next/link'
import { STATUS_CHECKIN, type StatusCheckin } from '@/lib/supabase/tipos'
import type { Filtros } from '@/lib/participantes'

const ROTULOS: Record<StatusCheckin | 'todos', string> = {
  todos: 'Todos',
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

export function ChipsStatus({
  eventoSlug,
  filtros,
}: {
  eventoSlug: string
  filtros: Filtros
}) {
  const base = `/admin/${eventoSlug}/participantes`

  function href(status: StatusCheckin | 'todos'): string {
    // A ordem dos parametros e fixa (grupo, status, busca) para a URL de
    // uma mesma visao ser sempre a mesma string.
    const p = new URLSearchParams()
    if (filtros.grupo !== 'todos') p.set('grupo', filtros.grupo)
    if (status !== 'todos') p.set('status', status)
    if (filtros.busca) p.set('busca', filtros.busca)
    const q = p.toString()
    return q ? `${base}?${q}` : base
  }

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-neutral-500">Status</span>
      {(['todos', ...STATUS_CHECKIN] as const).map((status) => {
        const ativo = status === filtros.status
        return (
          <Link
            key={status}
            href={href(status)}
            aria-current={ativo ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 text-xs ${
              ativo ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'
            }`}
          >
            {ROTULOS[status]}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3e: Ligar os chips à página**

Em `app/admin/[evento]/participantes/page.tsx` (Task 4), acrescentar o import e o componente logo abaixo de `<AbasTamanho ... />`:

```tsx
import { ChipsStatus } from './chips-status'
```

```tsx
      <ChipsStatus eventoSlug={slug} filtros={filtros} />
```

E em `abas-tamanho.tsx`, os links das abas precisam preservar status e busca do mesmo jeito. Trocar a linha do `href` por:

```tsx
        const p = new URLSearchParams()
        if (grupo !== 'todos') p.set('grupo', grupo)
        if (statusAtual !== 'todos') p.set('status', statusAtual)
        if (busca) p.set('busca', busca)
        const q = p.toString()
        const href = q ? `${base}?${q}` : base
```

acrescentando `statusAtual` e `busca` às props de `AbasTamanho`, e ajustando os testes das abas para passá-las (`statusAtual="todos" busca=""` nos casos existentes, que continuam valendo).

- [ ] **Step 4: Escrever o teste da busca**

Criar `app/admin/[evento]/participantes/campo-busca.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampoBusca } from './campo-busca'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/eng-2026/participantes',
  useSearchParams: () => new URLSearchParams('grupo=2'),
}))

describe('CampoBusca', () => {
  it('comeca com o valor que veio da URL', () => {
    render(<CampoBusca valorInicial="guerry" />)
    expect(screen.getByRole('searchbox')).toHaveValue('guerry')
  })

  it('e um formulario GET, para funcionar sem javascript', () => {
    const { container } = render(<CampoBusca valorInicial="" />)
    expect(container.querySelector('form')).toHaveAttribute('method', 'get')
  })

  it('preserva o grupo escolhido ao buscar', () => {
    // Buscar dentro da aba "2 pessoas" nao pode jogar a pessoa de volta
    // para a visao geral.
    const { container } = render(<CampoBusca valorInicial="" />)
    expect(container.querySelector('input[name="grupo"]')).toHaveValue('2')
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- campo-busca`
Expected: FAIL — `Cannot find module './campo-busca'`

- [ ] **Step 6: Implementar a busca**

Criar `app/admin/[evento]/participantes/campo-busca.tsx`:

```tsx
'use client'

import { usePathname, useSearchParams } from 'next/navigation'

export function CampoBusca({ valorInicial }: { valorInicial: string }) {
  const caminho = usePathname()
  const parametros = useSearchParams()
  const grupo = parametros.get('grupo') ?? ''
  const status = parametros.get('status') ?? ''

  // Formulario GET: a busca escreve na URL sozinha, funciona sem javascript
  // e o resultado continua compartilhavel por link.
  return (
    <form method="get" action={caminho} className="flex gap-2">
      {grupo ? <input type="hidden" name="grupo" value={grupo} /> : null}
      {status ? <input type="hidden" name="status" value={status} /> : null}

      <input
        type="search"
        name="busca"
        defaultValue={valorInicial}
        placeholder="Nome, email, telefone, buffet ou código"
        className="w-80 rounded border px-3 py-1.5 text-sm"
      />
      <button type="submit" className="rounded border px-3 py-1.5 text-sm">
        Buscar
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
git add "app/admin/[evento]/participantes"
git commit -m "feat: abas por tamanho de grupo e busca, ambas na URL"
```

---

### Task 4: A tabela e a página

**Files:**
- Create: `app/admin/[evento]/participantes/tabela-plana.tsx`, `app/admin/[evento]/participantes/grupos.tsx`, `app/admin/[evento]/participantes/page.tsx`
- Test: `app/admin/[evento]/participantes/tabela-plana.test.tsx`, `app/admin/[evento]/participantes/grupos.test.tsx`

**Interfaces:**
- Consumes: `LinhaParticipante`, `GrupoInscricao`, `agruparPorInscricao`, `lerFiltros`, `aplicarFiltroDeGrupo` de `@/lib/participantes`
- Produces: `TabelaPlana({ linhas }: { linhas: LinhaParticipante[] })` e `Grupos({ grupos }: { grupos: GrupoInscricao[] })`

- [ ] **Step 1: Escrever os testes**

Criar `app/admin/[evento]/participantes/tabela-plana.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabelaPlana } from './tabela-plana'
import type { LinhaParticipante } from '@/lib/participantes'

function linha(p: Partial<LinhaParticipante>): LinhaParticipante {
  return {
    id: 'x', inscricao_id: 'i1', pessoa_id: 'p1', ordem: 1, titular: true,
    nome: 'Janaína Guerrieri', email: 'l@g.com', telefone: '51998128616',
    data_nascimento: null, nome_cracha: 'Janaina', cargo: 'Sócia',
    evento_id: 'e1', codigo: 'ENG26-0001', codigo_participante: 'ENG26-0001-1',
    vagas: 2, pessoas_preenchidas: 2, empresa_nome: 'La Guerry',
    empresa_cidade: 'Porto Alegre', empresa_instagram: null,
    status_checkin: 'concluido', ...p,
  }
}

describe('TabelaPlana', () => {
  it('uma linha por pessoa', () => {
    render(<TabelaPlana linhas={[linha({ id: 'a' }), linha({ id: 'b', nome: 'Leonardo' })]} />)
    expect(screen.getAllByRole('row')).toHaveLength(3) // cabecalho + 2
  })

  it('mostra o codigo do participante', () => {
    render(<TabelaPlana linhas={[linha({})]} />)
    expect(screen.getByText('ENG26-0001-1')).toBeInTheDocument()
  })

  it('diz quantas pessoas ha na compra', () => {
    render(<TabelaPlana linhas={[linha({ vagas: 3, pessoas_preenchidas: 2 })]} />)
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('avisa quando ninguem foi encontrado', () => {
    render(<TabelaPlana linhas={[]} />)
    expect(screen.getByText(/nenhum participante/i)).toBeInTheDocument()
  })
})
```

Criar `app/admin/[evento]/participantes/grupos.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Grupos } from './grupos'
import type { GrupoInscricao } from '@/lib/participantes'

const base = {
  id: 'x', inscricao_id: 'i1', pessoa_id: 'p1', ordem: 1, titular: true,
  nome: 'Janaína', email: null, telefone: null, data_nascimento: null,
  nome_cracha: null, cargo: 'Sócia', evento_id: 'e1', codigo: 'ENG26-0001',
  codigo_participante: 'ENG26-0001-1', vagas: 3, pessoas_preenchidas: 2,
  empresa_nome: 'La Guerry', empresa_cidade: 'Porto Alegre',
  empresa_instagram: null, status_checkin: 'em_andamento' as const,
}

const grupo: GrupoInscricao = {
  codigo: 'ENG26-0001',
  empresa_nome: 'La Guerry',
  empresa_cidade: 'Porto Alegre',
  vagas: 3,
  preenchidos: 2,
  completo: false,
  participantes: [base, { ...base, ordem: 2, nome: 'Leonardo', titular: false, codigo_participante: 'ENG26-0001-2' }],
}

describe('Grupos', () => {
  it('um cabecalho por inscricao, com codigo e buffet', () => {
    render(<Grupos grupos={[grupo]} />)
    expect(screen.getByText(/ENG26-0001/)).toBeInTheDocument()
    expect(screen.getByText(/La Guerry/)).toBeInTheDocument()
  })

  it('mostra quantos de quantos foram preenchidos', () => {
    render(<Grupos grupos={[grupo]} />)
    expect(screen.getByText(/2\/3 preenchidos/)).toBeInTheDocument()
  })

  it('sinaliza o grupo incompleto', () => {
    // E assim que se enxerga quem comprou 3 vagas e cadastrou 2.
    render(<Grupos grupos={[grupo]} />)
    expect(screen.getByRole('status')).toHaveAccessibleName(/incompleto/i)
  })

  it('nao sinaliza quando esta completo', () => {
    render(<Grupos grupos={[{ ...grupo, preenchidos: 3, completo: true }]} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('lista os participantes do grupo, na ordem', () => {
    render(<Grupos grupos={[grupo]} />)
    const nomes = screen.getAllByRole('row').slice(1).map((l) => l.textContent)
    expect(nomes[0]).toContain('Janaína')
    expect(nomes[1]).toContain('Leonardo')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- "tabela-plana|grupos"`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar `tabela-plana.tsx`**

```tsx
import type { LinhaParticipante } from '@/lib/participantes'

export function TabelaPlana({ linhas }: { linhas: LinhaParticipante[] }) {
  if (linhas.length === 0) {
    return <p className="text-neutral-500">Nenhum participante encontrado.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            <th className="py-2 pr-4 font-medium">Código</th>
            <th className="py-2 pr-4 font-medium">Nome</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Telefone</th>
            <th className="py-2 pr-4 font-medium">Crachá</th>
            <th className="py-2 pr-4 font-medium">Cargo</th>
            <th className="py-2 pr-4 font-medium">Buffet</th>
            <th className="py-2 pr-4 font-medium">Na compra</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b last:border-0">
              <td className="py-2 pr-4 font-mono text-xs">{l.codigo_participante}</td>
              <td className="py-2 pr-4">
                {l.nome}
                {l.titular ? (
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                    titular
                  </span>
                ) : null}
              </td>
              <td className="py-2 pr-4">{l.email ?? '—'}</td>
              <td className="py-2 pr-4">{l.telefone ?? '—'}</td>
              <td className="py-2 pr-4">{l.nome_cracha ?? '—'}</td>
              <td className="py-2 pr-4">{l.cargo ?? '—'}</td>
              <td className="py-2 pr-4">{l.empresa_nome ?? '—'}</td>
              <td className="py-2 pr-4 tabular-nums">
                {l.pessoas_preenchidas}/{l.vagas}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Implementar `grupos.tsx`**

```tsx
import type { GrupoInscricao } from '@/lib/participantes'

export function Grupos({ grupos }: { grupos: GrupoInscricao[] }) {
  if (grupos.length === 0) {
    return <p className="text-neutral-500">Nenhuma inscrição desse tamanho.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <section key={g.codigo} className="rounded border">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-neutral-50 px-4 py-2 text-sm">
            <span className="font-mono text-xs">{g.codigo}</span>
            <span className="font-medium">{g.empresa_nome ?? 'Sem buffet'}</span>
            {g.empresa_cidade ? (
              <span className="text-neutral-500">{g.empresa_cidade}</span>
            ) : null}
            <span className="ml-auto tabular-nums text-neutral-600">
              {g.preenchidos}/{g.vagas} preenchidos
            </span>
            {!g.completo ? (
              <span role="status" aria-label="Grupo incompleto" title="Grupo incompleto">
                ⚠
              </span>
            ) : null}
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Crachá</th>
                </tr>
              </thead>
              <tbody>
                {g.participantes.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pl-4 pr-4 font-mono text-xs">
                      {p.codigo_participante}
                    </td>
                    <td className="py-2 pr-4">
                      {p.nome}
                      {p.titular ? (
                        <span className="ml-2 text-xs text-neutral-500">titular</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">{p.cargo ?? '—'}</td>
                    <td className="py-2 pr-4">{p.nome_cracha ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Implementar a página**

Criar `app/admin/[evento]/participantes/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  GRUPOS,
  agruparPorInscricao,
  aplicarFiltroDeGrupo,
  lerFiltros,
  type Grupo,
  type LinhaParticipante,
} from '@/lib/participantes'
import { AbasTamanho } from './abas-tamanho'
import { CampoBusca } from './campo-busca'
import { TabelaPlana } from './tabela-plana'
import { Grupos } from './grupos'

export default async function PaginaParticipantes({
  params,
  searchParams,
}: PageProps<'/admin/[evento]/participantes'>) {
  const { evento: slug } = await params
  const filtros = lerFiltros(await searchParams)
  const supabase = await criarClienteServidor()

  const { data: evento } = await supabase
    .from('eventos')
    .select('id, nome, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (!evento) notFound()

  let consulta = supabase
    .from('vw_participantes')
    .select('*')
    .eq('evento_id', evento.id)
    .order('codigo_participante')

  consulta = aplicarFiltroDeGrupo(consulta, filtros.grupo)
  if (filtros.status !== 'todos') consulta = consulta.eq('status_checkin', filtros.status)
  if (filtros.busca) {
    const t = `%${filtros.busca}%`
    consulta = consulta.or(
      `nome.ilike.${t},email.ilike.${t},telefone.ilike.${t},empresa_nome.ilike.${t},codigo.ilike.${t}`,
    )
  }

  const { data } = await consulta
  const linhas = (data ?? []) as LinhaParticipante[]

  // As contagens das abas ignoram o grupo escolhido — senao a aba ativa
  // mostraria o total e as outras mostrariam zero.
  const { data: todasDoEvento } = await supabase
    .from('vw_participantes')
    .select('vagas')
    .eq('evento_id', evento.id)

  const contagens = Object.fromEntries(GRUPOS.map((g) => [g, 0])) as Record<Grupo, number>
  for (const { vagas } of (todasDoEvento ?? []) as Array<{ vagas: number }>) {
    contagens.todos++
    const chave: Grupo = vagas >= 4 ? '4+' : (String(vagas) as Grupo)
    if (chave in contagens) contagens[chave]++
  }

  const parametrosExport = new URLSearchParams()
  if (filtros.grupo !== 'todos') parametrosExport.set('grupo', filtros.grupo)
  if (filtros.status !== 'todos') parametrosExport.set('status', filtros.status)
  if (filtros.busca) parametrosExport.set('busca', filtros.busca)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{evento.nome} · Participantes</h1>
        <Link
          href={`/admin/${slug}/participantes/exportar?${parametrosExport}`}
          className="rounded border px-3 py-1.5 text-sm"
        >
          Exportar CSV
        </Link>
      </div>

      <AbasTamanho eventoSlug={slug} atual={filtros.grupo} contagens={contagens} />
      <CampoBusca valorInicial={filtros.busca} />

      {filtros.grupo === 'todos' ? (
        <TabelaPlana linhas={linhas} />
      ) : (
        <Grupos grupos={agruparPorInscricao(linhas)} />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add "app/admin/[evento]/participantes"
git commit -m "feat: tabela geral e visao agrupada por inscricao"
```

---

### Task 5: Baixar o CSV

**Files:**
- Create: `app/admin/[evento]/participantes/exportar/route.ts`
- Test: `app/admin/[evento]/participantes/exportar/route.test.ts`

**Interfaces:**
- Consumes: `montarCsv`, `nomeArquivoCsv` de `@/lib/csv`; `lerFiltros`, `aplicarFiltroDeGrupo` de `@/lib/participantes`
- Produces: o handler `GET`

- [ ] **Step 1: Escrever o teste**

Criar `app/admin/[evento]/participantes/exportar/route.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './route.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('rota de exportacao', () => {
  it('reaproveita os mesmos filtros da tela', () => {
    // Se a rota montasse os filtros por conta propria, o CSV divergiria do
    // que a pessoa esta vendo — o erro mais facil de nao perceber aqui.
    expect(codigo).toMatch(/lerFiltros/)
    expect(codigo).toMatch(/aplicarFiltroDeGrupo/)
  })

  it('reaproveita a montagem de CSV', () => {
    expect(codigo).toMatch(/montarCsv/)
    expect(codigo).toMatch(/nomeArquivoCsv/)
  })

  it('passa pela sessao do usuario, respeitando a RLS', () => {
    expect(codigo).toMatch(/criarClienteServidor/)
    expect(codigo).not.toMatch(/criarClienteAdmin|SERVICE_ROLE/)
  })

  it('declara o tipo do arquivo com charset', () => {
    expect(codigo).toMatch(/text\/csv/)
    expect(codigo).toMatch(/charset=utf-8/i)
  })

  it('manda o navegador baixar, com nome de arquivo', () => {
    expect(codigo).toMatch(/Content-Disposition/)
    expect(codigo).toMatch(/attachment/)
  })

  it('devolve 404 quando o evento nao existe, em vez de CSV vazio', () => {
    expect(codigo).toMatch(/404/)
  })

  it('usa o helper de tipo de rota da versao', () => {
    // RouteContext<'/rota'> e gerado pelo `next typegen` e da params tipado.
    expect(codigo).toMatch(/RouteContext</)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- exportar`
Expected: FAIL — `ENOENT ... route.ts`

- [ ] **Step 3: Implementar**

Criar `app/admin/[evento]/participantes/exportar/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { montarCsv, nomeArquivoCsv } from '@/lib/csv'
import {
  aplicarFiltroDeGrupo,
  lerFiltros,
  type LinhaParticipante,
} from '@/lib/participantes'

// `RouteContext<'/rota'>` e um helper global que o `next typegen` gera —
// nao se importa. Ver 03-file-conventions/route.md na doc da versao.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/admin/[evento]/participantes/exportar'>,
) {
  const { evento: slug } = await ctx.params

  // Os mesmos filtros da tela. Montar por conta propria aqui faria o CSV
  // divergir do que a pessoa esta vendo, sem ninguem perceber.
  const filtros = lerFiltros(Object.fromEntries(request.nextUrl.searchParams))

  const supabase = await criarClienteServidor()

  const { data: evento } = await supabase
    .from('eventos')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!evento) return new Response('Evento não encontrado', { status: 404 })

  let consulta = supabase
    .from('vw_participantes')
    .select('*')
    .eq('evento_id', evento.id)
    .order('codigo_participante')

  consulta = aplicarFiltroDeGrupo(consulta, filtros.grupo)
  if (filtros.status !== 'todos') consulta = consulta.eq('status_checkin', filtros.status)
  if (filtros.busca) {
    const t = `%${filtros.busca}%`
    consulta = consulta.or(
      `nome.ilike.${t},email.ilike.${t},telefone.ilike.${t},empresa_nome.ilike.${t},codigo.ilike.${t}`,
    )
  }

  const { data, error } = await consulta
  if (error) return new Response(error.message, { status: 500 })

  const csv = montarCsv((data ?? []) as LinhaParticipante[])
  const nome = nomeArquivoCsv(evento.slug, filtros.grupo)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  })
}
```

- [ ] **Step 4: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add "app/admin/[evento]/participantes/exportar"
git commit -m "feat: exportar csv respeitando os filtros da tela"
```

---

### Task 6: Redefinir senha

**Files:**
- Create: `lib/supabase/recuperacao.ts`, `app/recuperar-senha/{acoes.ts,page.tsx,formulario-recuperar.tsx}`, `app/nova-senha/{page.tsx,formulario-nova-senha.tsx}`
- Test: `lib/supabase/recuperacao.test.ts`, `app/recuperar-senha/acoes.test.ts`, `app/nova-senha/formulario-nova-senha.test.tsx`
- Modify: `proxy.ts`, `app/entrar/page.tsx`

**Interfaces:**
- Consumes: `lerConfigSupabase` de `@/lib/supabase/config`
- Produces:
  - `criarClienteRecuperacaoServidor()` e `criarClienteRecuperacaoBrowser()` de `@/lib/supabase/recuperacao`
  - `pedirRecuperacao(_anterior: ResultadoAuth, form: FormData): Promise<ResultadoAuth>` de `@/app/recuperar-senha/acoes`

**LER ANTES DE ESCREVER:** `C:\Users\regra\Downloads\Interatividade engrenagem\lib\supabase\recuperacao.ts`. O projeto Engrenagem já tropeçou neste exato problema e o arquivo documenta a razão da escolha.

O cliente padrão do `@supabase/ssr` fixa `flowType: 'pkce'`, que grava um `code_verifier` num cookie do navegador que **pediu** a recuperação e exige esse mesmo cookie ao abrir o link. Na prática obriga a pessoa a abrir o email no mesmo navegador em que pediu — e o caso mais comum é o contrário: pedir no notebook e abrir no celular. Quando isso acontece o Supabase recusa a troca e a tela mostra "link inválido", indistinguível de link expirado. `flowType: 'implicit'` não guarda nada localmente: o token volta no fragmento da URL, e qualquer navegador consegue processá-lo.

- [ ] **Step 1: Escrever o teste dos clientes**

Criar `lib/supabase/recuperacao.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './recuperacao.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('clientes de recuperacao de senha', () => {
  it('usam flowType implicit, nunca pkce', () => {
    // pkce exige que o link seja aberto no MESMO navegador que pediu. O caso
    // comum e pedir no notebook e abrir no celular — e ai o Supabase recusa
    // com "link invalido", indistinguivel de link expirado.
    expect(codigo).toMatch(/flowType:\s*'implicit'/)
    expect(codigo).not.toMatch(/flowType:\s*'pkce'/)
  })

  it('o cliente de servidor nao guarda sessao', () => {
    // Ele so dispara o email; sessao nenhuma deve sobrar no servidor.
    expect(codigo).toMatch(/persistSession:\s*false/)
  })

  it('o cliente de navegador le o token do fragmento da URL', () => {
    expect(codigo).toMatch(/detectSessionInUrl:\s*true/)
  })

  it('valida a configuracao como os demais clientes', () => {
    expect(codigo).toMatch(/lerConfigSupabase/)
  })

  it('nunca usa a chave de servico', () => {
    expect(codigo).not.toMatch(/SERVICE_ROLE|lerChaveServico/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- recuperacao`
Expected: FAIL — `ENOENT ... recuperacao.ts`

- [ ] **Step 3: Implementar os clientes**

Criar `lib/supabase/recuperacao.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { lerConfigSupabase } from './config'

/**
 * Clientes exclusivos do fluxo de recuperação de senha.
 *
 * Por que não usar os clientes normais: eles fixam `flowType: 'pkce'`, que
 * grava um `code_verifier` num cookie do navegador que PEDIU a recuperação e
 * exige esse mesmo cookie na hora de abrir o link. Na prática isso obriga a
 * pessoa a abrir o email no mesmo navegador em que pediu — e o caso mais
 * comum é o contrário: pedir no notebook e abrir no celular. Quando isso
 * acontece o Supabase recusa a troca e a tela mostra "link inválido",
 * indistinguível de link expirado.
 *
 * `flowType: 'implicit'` não guarda nada localmente: o link volta com o token
 * no fragmento da URL, e qualquer navegador consegue processá-lo.
 *
 * O projeto Engrenagem já tropeçou nisto — ver o arquivo de mesmo nome lá.
 */
export function criarClienteRecuperacaoServidor() {
  const { url, anon } = lerConfigSupabase(process.env)
  return createClient(url, anon, {
    auth: {
      flowType: 'implicit',
      // Este cliente só dispara o email, nunca guarda sessão.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function criarClienteRecuperacaoBrowser() {
  const { url, anon } = lerConfigSupabase(process.env)
  return createClient(url, anon, {
    auth: {
      flowType: 'implicit',
      // Lê o `#access_token` que o Supabase devolve no link do email.
      detectSessionInUrl: true,
      // Sessão só em memória: existe para trocar a senha e morre com a aba.
      // A sessão de verdade nasce depois, no login normal.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
```

- [ ] **Step 4: Escrever o teste da ação**

Criar `app/recuperar-senha/acoes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fonte = readFileSync(resolve(__dirname, './acoes.ts'), 'utf-8')
const codigo = fonte.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('pedirRecuperacao', () => {
  it('e um modulo de servidor', () => {
    expect(codigo).toMatch(/^'use server'/m)
  })

  it('usa o cliente de recuperacao, nao o normal', () => {
    expect(codigo).toMatch(/criarClienteRecuperacaoServidor/)
    expect(codigo).not.toMatch(/criarClienteServidor\(/)
  })

  it('manda o link de volta para /nova-senha', () => {
    expect(codigo).toMatch(/redirectTo/)
    expect(codigo).toMatch(/\/nova-senha/)
  })

  it('responde igual exista ou nao a conta', () => {
    // Dizer "email nao encontrado" entrega a lista de contas a quem estiver
    // sondando. A confirmacao e a mesma nos dois casos.
    expect(codigo).toMatch(/enviamos|Se existir|se houver/i)
  })

  it('registra a causa real no servidor', () => {
    expect(codigo).toMatch(/console\.error\(/)
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- "recuperar-senha"`
Expected: FAIL — `ENOENT ... acoes.ts`

- [ ] **Step 6: Implementar a ação e as telas**

Criar `app/recuperar-senha/acoes.ts`:

```typescript
'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { criarClienteRecuperacaoServidor } from '@/lib/supabase/recuperacao'

export type ResultadoRecuperacao = { erro: string } | { aviso: string } | undefined

const esquema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: 'Informe um email válido' })),
})

export async function pedirRecuperacao(
  _anterior: ResultadoRecuperacao,
  form: FormData,
): Promise<ResultadoRecuperacao> {
  const analise = esquema.safeParse(Object.fromEntries(form))
  if (!analise.success) return { erro: analise.error.issues[0].message }

  const cabecalhos = await headers()
  const origem = cabecalhos.get('origin') ?? 'http://localhost:3100'

  const supabase = criarClienteRecuperacaoServidor()
  const { error } = await supabase.auth.resetPasswordForEmail(analise.data.email, {
    redirectTo: `${origem}/nova-senha`,
  })

  if (error) {
    console.error('[recuperar-senha] falha ao disparar', {
      codigo: error.code,
      status: error.status,
      mensagem: error.message,
    })
  }

  // A mesma resposta exista ou não a conta: dizer "email não encontrado"
  // entrega a lista de contas a quem estiver sondando.
  return { aviso: 'Se existir uma conta com esse email, enviamos o link.' }
}
```

Criar `app/recuperar-senha/formulario-recuperar.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { pedirRecuperacao, type ResultadoRecuperacao } from './acoes'

export function FormularioRecuperar() {
  const [resultado, acao, enviando] = useActionState<ResultadoRecuperacao, FormData>(
    pedirRecuperacao,
    undefined,
  )

  return (
    <form action={acao} className="flex flex-col gap-4">
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

      {resultado && 'erro' in resultado ? (
        <p role="alert" className="text-sm text-red-600">
          {resultado.erro}
        </p>
      ) : null}
      {resultado && 'aviso' in resultado ? (
        <p role="status" className="text-sm text-neutral-600">
          {resultado.aviso}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Enviar link'}
      </button>
    </form>
  )
}
```

Criar `app/recuperar-senha/page.tsx`:

```tsx
import Link from 'next/link'
import { FormularioRecuperar } from './formulario-recuperar'

export const metadata = { title: 'Recuperar senha · Check-in R3' }

export default function PaginaRecuperar() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-semibold">Recuperar senha</h1>
      <FormularioRecuperar />
      <Link href="/entrar" className="mt-6 text-sm underline">
        Voltar para entrar
      </Link>
    </main>
  )
}
```

- [ ] **Step 7: Escrever o teste da troca de senha**

Criar `app/nova-senha/formulario-nova-senha.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormularioNovaSenha } from './formulario-nova-senha'

vi.mock('@/lib/supabase/recuperacao', () => ({
  criarClienteRecuperacaoBrowser: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      updateUser: vi.fn(),
    },
  }),
}))

describe('FormularioNovaSenha', () => {
  it('pede a nova senha duas vezes', () => {
    render(<FormularioNovaSenha />)
    expect(screen.getByLabelText(/^nova senha/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/repita/i)).toBeInTheDocument()
  })

  it('os dois campos sao do tipo senha', () => {
    render(<FormularioNovaSenha />)
    expect(screen.getByLabelText(/^nova senha/i)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/repita/i)).toHaveAttribute('type', 'password')
  })

  it('marca os campos como senha nova, para o gerenciador sugerir uma', () => {
    render(<FormularioNovaSenha />)
    expect(screen.getByLabelText(/^nova senha/i)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })
})
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npm test -- nova-senha`
Expected: FAIL — `Cannot find module './formulario-nova-senha'`

- [ ] **Step 9: Implementar a troca de senha**

Criar `app/nova-senha/formulario-nova-senha.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarClienteRecuperacaoBrowser } from '@/lib/supabase/recuperacao'

export function FormularioNovaSenha() {
  const router = useRouter()
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // O token vem no fragmento da URL (`#access_token=...`), que o navegador
  // não envia ao servidor. Só o cliente consegue lê-lo — por isso esta tela
  // é de cliente, e por isso o fluxo é `implicit`.
  useEffect(() => {
    const supabase = criarClienteRecuperacaoBrowser()
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_IN') setPronto(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function trocar(form: FormData) {
    const senha = String(form.get('senha') ?? '')
    const repeticao = String(form.get('repeticao') ?? '')

    if (senha.length < 8) return setErro('A senha precisa de pelo menos 8 caracteres')
    if (senha !== repeticao) return setErro('As duas senhas não são iguais')

    setErro('')
    setSalvando(true)

    const supabase = criarClienteRecuperacaoBrowser()
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)

    if (error) {
      console.error('[nova-senha] falha ao trocar', error.message)
      setErro('Não foi possível trocar a senha. Peça um link novo.')
      return
    }

    router.push('/entrar')
  }

  return (
    <form action={trocar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nova senha</span>
        <input
          name="senha"
          type="password"
          autoComplete="new-password"
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Repita a nova senha</span>
        <input
          name="repeticao"
          type="password"
          autoComplete="new-password"
          required
          className="rounded border px-3 py-2"
        />
      </label>

      {erro ? (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      ) : null}

      {!pronto ? (
        <p className="text-sm text-neutral-500">Validando o link…</p>
      ) : null}

      <button
        type="submit"
        disabled={!pronto || salvando}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : 'Trocar senha'}
      </button>
    </form>
  )
}
```

Criar `app/nova-senha/page.tsx`:

```tsx
import { FormularioNovaSenha } from './formulario-nova-senha'

export const metadata = { title: 'Nova senha · Check-in R3' }

export default function PaginaNovaSenha() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-semibold">Escolha a nova senha</h1>
      <FormularioNovaSenha />
    </main>
  )
}
```

- [ ] **Step 10: Ligar as telas ao login**

Em `app/entrar/page.tsx`, acrescentar o link depois do `<FormularioEntrar ... />`:

```tsx
      <Link href="/recuperar-senha" className="mt-6 text-sm underline">
        Esqueci minha senha
      </Link>
```

E o import no topo do arquivo:

```tsx
import Link from 'next/link'
```

- [ ] **Step 11: Deixar as duas rotas passarem pelo proxy**

Em `proxy.ts`, o único caminho protegido é `/admin`, então `/recuperar-senha` e `/nova-senha` já passam. Mas o redirecionamento de quem já tem sessão precisa não capturá-las. Trocar:

```typescript
  if (user && caminho === '/entrar') {
```

por:

```typescript
  // `/nova-senha` fica de fora de proposito: quem chega pelo link do email
  // pode ter uma sessao antiga no navegador, e mandá-la para /admin
  // impediria a troca de senha.
  if (user && (caminho === '/entrar' || caminho === '/recuperar-senha')) {
```

Acrescentar em `lib/auth/proxy.test.ts`:

```typescript
  it('nao sequestra /nova-senha de quem ja tem sessao', () => {
    // Quem chega pelo link do email pode ter sessao antiga no navegador.
    // Redirecionar para /admin impediria a troca da senha.
    expect(fonte).not.toMatch(/caminho === '\/nova-senha'/)
  })
```

- [ ] **Step 12: Rodar tudo e commitar**

```bash
npm test
npm run typecheck
npm run lint
git add lib/supabase/recuperacao.ts lib/supabase/recuperacao.test.ts app/recuperar-senha app/nova-senha app/entrar/page.tsx proxy.ts lib/auth/proxy.test.ts
git commit -m "feat: recuperacao de senha com flowType implicit"
```

- [ ] **Step 13: Configurar o Supabase**

No painel do projeto `vyjxyczbscdkfhdabrxk`:

- `Authentication → URL Configuration → Site URL` → `http://localhost:3100`
- `Redirect URLs` → acrescentar `http://localhost:3100/nova-senha`

Sem isso o link do email cai no `Site URL` de fábrica, `http://localhost:3000` — que nesta máquina é o dev server do projeto Engrenagem. Já aconteceu.

---

### Verificação final no navegador

1. `/admin/<evento>/participantes` — a aba **Geral** lista uma linha por pessoa
2. Clicar em **2 pessoas** — a tabela troca para os grupos, com cabeçalho por inscrição
2b. Clicar no chip **Pendente** — a URL fica `?grupo=2&status=pendente` e a aba **2 pessoas** continua ativa
3. Uma inscrição de 3 vagas com 2 preenchidos mostra `2/3 preenchidos` e o ⚠
4. Buscar "guerry" dentro da aba **2 pessoas** — o resultado filtra **sem** voltar para a Geral
5. **Exportar CSV** — o arquivo baixado tem só as linhas visíveis; abrir no Excel e conferir que "Janaína" aparece com o acento certo
6. `/entrar` → **Esqueci minha senha** → pedir o link → abrir o email **em outro navegador** e trocar a senha. É esse o caso que o `flowType: 'implicit'` existe para resolver.

## O que a Fatia B2 entrega

A tabela geral, as visões por tamanho de grupo, busca, exportação e recuperação de senha.

**O que fica para a Fatia C:** o roteiro de perguntas editável e a conversa da Lara.
**Para a Fatia D:** a integração com o Guru.
