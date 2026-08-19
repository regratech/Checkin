/** Corta espaços das pontas e colapsa os repetidos do meio. */
export function limpar(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}
