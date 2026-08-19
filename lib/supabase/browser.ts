import { createBrowserClient } from '@supabase/ssr'
import { lerConfigPublica } from './config'

export function criarClienteBrowser() {
  const { url, anon } = lerConfigPublica()
  return createBrowserClient(url, anon)
}
