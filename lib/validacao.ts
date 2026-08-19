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
