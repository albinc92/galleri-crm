import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Only create client if credentials are available and valid
let supabaseClient: SupabaseClient<Database> | null = null

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
  }
}

export const supabase = supabaseClient as any
