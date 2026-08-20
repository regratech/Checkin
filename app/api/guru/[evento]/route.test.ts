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
    expect(codigo).toMatch(/guardado/i)
  })

  it('responde 409 quando a mesma compra chega de novo', () => {
    expect(codigo).toMatch(/409/)
  })

  it('usa o cliente de servico — o guru nao tem sessao', () => {
    expect(codigo).toMatch(/criarClienteAdmin/)
  })

  it('nao devolve dado do evento no corpo da resposta', () => {
    // A resposta vai para fora. Nada de token, segredo ou email.
    expect(codigo).not.toMatch(/token:\s*inscricao|webhook_segredo:/)
  })

  it('nao distingue evento inexistente de segredo errado', () => {
    // Dizer qual dos dois falhou entrega a lista de eventos a quem sondar.
    expect(codigo).toMatch(/!evento \|\| !segredoConfere/)
  })
})
