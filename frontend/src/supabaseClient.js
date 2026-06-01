import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Attach stored Supabase session so Realtime + RLS work in the browser */
export async function initSupabaseSession() {
  const accessToken = localStorage.getItem('supabase_access_token')
  if (!accessToken || accessToken === 'null') return
  try {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: localStorage.getItem('supabase_refresh_token') || '',
    })
  } catch (e) {
    console.warn('Supabase session init failed', e)
  }
}