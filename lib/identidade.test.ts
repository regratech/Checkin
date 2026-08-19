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
