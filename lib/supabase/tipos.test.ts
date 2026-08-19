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
  // `\s*` em toda junta: um enum longo (tipo_pergunta) e quebrado em varias
  // linhas no SQL, e o teste nao deve ditar a formatacao da migration.
  const regex = /create type (\w+) as enum \(\s*((?:'[^']*'(?:\s*,\s*)?)+)\s*\);/g
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
    expect(sql).toMatch(
      /foreign key \(pergunta_id, escopo\) references perguntas \(id, escopo\)/i,
    )
  })

  it('vagas e sempre positivo', () => {
    expect(sql).toMatch(/vagas int not null check \(vagas >= 1\)/i)
  })
})
