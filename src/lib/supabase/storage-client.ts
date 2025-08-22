import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Create a storage client with service role key for admin operations
export const createStorageClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseServiceKey) {
    console.warn('VITE_SUPABASE_SERVICE_ROLE_KEY not found. Bucket creation may fail due to RLS policies.');
    // Fall back to regular client
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    return createSupabaseClient(supabaseUrl, supabaseAnonKey);
  }
  
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

