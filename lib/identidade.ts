/**
 * A identidade de uma pessoa entre eventos e o PAR email + nome normalizado.
 *
 * Email sozinho nao serve: no ultimo evento, 7 dos 13 grupos cadastraram o
 * acompanhante com o email do titular. Chavear so por email fundiria dois
 * seres humanos num registro, e isso nao se desfaz depois. Duplicar por
 * variacao de escrita do nome, sim, se desfaz.
 */
export function normalizarEmail(bruto: string): string {
  return bruto.trim().toLowerCase()
}

export function normalizarNome(bruto: string): string {
  return bruto
    .normalize('NFD')
    // U+0300 a U+036F: os acentos que o NFD separou da letra base.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
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
