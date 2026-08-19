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
  const corpo = linhas.map((l) => COLUNAS.map(([, ler]) => escapar(ler(l))).join(SEPARADOR))

  // BOM: sem ele o Excel em portugues le o arquivo como Latin-1 e
  // "Janaína" vira "JanaÃ­na".
  return '\uFEFF' + [cabecalho, ...corpo].join('\r\n')
}

export function nomeArquivoCsv(eventoSlug: string, grupo: string): string {
  const visao = grupo === 'todos' ? 'geral' : `${grupo}-pessoas`
  return `${eventoSlug}-${visao}.csv`
}
