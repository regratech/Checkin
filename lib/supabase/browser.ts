import { createBrowserClient } from '@supabase/ssr'
import { lerConfigSupabase } from './config'

export function criarClienteBrowser() {
  const { url, anon } = lerConfigSupabase(process.env)
  return createBrowserClient(url, anon)
}
