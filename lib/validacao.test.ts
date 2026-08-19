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
