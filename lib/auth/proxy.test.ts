import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// proxy.ts depende do runtime de requisicao do Next, entao e testado por
// assercao sobre o texto, no mesmo espirito dos testes de migration.
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

describe('proxy e a recuperacao de senha', () => {
  it('nao sequestra /nova-senha de quem ja tem sessao', () => {
    // Quem chega pelo link do email pode ter sessao antiga no navegador.
    // Redirecionar para /admin impediria a troca da senha.
    expect(fonte).not.toMatch(/caminho === '\/nova-senha'/)
  })

  it('manda quem ja esta logado para longe de /recuperar-senha', () => {
    expect(fonte).toMatch(/caminho === '\/recuperar-senha'/)
  })
})
