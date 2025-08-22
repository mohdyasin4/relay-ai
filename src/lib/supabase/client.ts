import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Global singleton instance
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

// Create and export a Supabase client singleton
export const createClient = () => {
  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'relay-auth-session',
      },
    });
  }
  
  return supabaseInstance;
};

// For server components/API routes
export const createServiceClient = () => {
  // This should only be used in server-side code
  if (typeof process === 'undefined') {
    console.error('createServiceClient() should not be called from client-side code');
    // Fall back to regular client with anon key
    return createClient();
  }
  
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
