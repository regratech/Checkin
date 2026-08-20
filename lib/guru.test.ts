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
  product:
    'Engrenagem - Logística e organização de eventos para buffet 2026 [PRÉ-VENDA - 2 INSCRIÇÕES] - 15% OFF NA 2ª',
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

  it('guarda o telefone so com digitos', () => {
    const r = lerCompra({ ...compraReal, phone: '(34) 99339-5999' })
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
    expect(chaveDeIdempotencia({ id: 'primeiro', order_id: 'segundo' })).toBe('primeiro')
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
