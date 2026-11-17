import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from './errors'

let client: SupabaseClient | null = null

export function projectUrl() {
  const raw = process.env.SUPABASE_URL?.trim() ?? ''
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
}

export function supabase() {
  if (client) return client
  const url = projectUrl()
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) throw new HttpError(500, 'Supabase is not configured.')
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return client
}
