/**
 * A identidade de uma pessoa entre eventos e o PAR email + nome normalizado.
 *
 * Email sozinho nao serve: no ultimo evento, 7 dos 13 grupos cadastraram o
 * acompanhante com o email do titular. Chavear so por email fundiria dois
 * seres humanos num registro, e isso nao se desfaz depois. Duplicar por
 * variacao de escrita do nome, sim, se desfaz.
 */

/**
 * Tira os acentos: `NFD` separa a letra base do acento, e o range
 * U+0300-U+036F remove os acentos soltos que sobraram.
 */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizarEmail(bruto: string): string {
  return bruto.trim().toLowerCase()
}

export function normalizarNome(bruto: string): string {
  return semAcento(bruto).toLowerCase().trim().replace(/\s+/g, ' ')
}

export function chaveIdentidade(
  email: string,
  nome: string,
): { email: string; nome_chave: string } {
  return {
    email: normalizarEmail(email),
    nome_chave: normalizarNome(nome),
  }
}
