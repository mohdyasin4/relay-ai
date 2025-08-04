import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Create and export a Supabase client singleton
export const createClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // Use PKCE flow for better security
      storageKey: 'gemini-messenger-auth',
      // The following settings help with cross-origin/cross-device issues
      storage: {
        getItem: (key) => {
          try {
            return JSON.parse(localStorage.getItem(key) || '');
          } catch (error) {
            return null;
          }
        },
        setItem: (key, value) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        removeItem: (key) => {
          localStorage.removeItem(key);
        }
      }
    }
  });
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
