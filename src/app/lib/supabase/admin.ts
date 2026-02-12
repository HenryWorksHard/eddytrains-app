import { createClient } from '@supabase/supabase-js'

// Admin client with service role key for user management
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  console.log('Admin client - URL:', supabaseUrl)
  console.log('Admin client - Key exists:', !!supabaseServiceKey)
  console.log('Admin client - Key length:', supabaseServiceKey?.length)

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
