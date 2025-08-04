import { syncUserFromSupabase } from '../lib/supabase/authSync';
import { createClient } from '../lib/supabase/client';

/**
 * This function handles the OAuth callback from Supabase auth
 * and syncs user data to your database
 */
export async function handleAuthCallback(code: string) {
  try {
    // Initialize Supabase client
    const supabase = createClient();
    
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error);
      return { success: false, error: error.message };
    }
    
    if (!data.user) {
      return { success: false, error: 'No user returned from authentication' };
    }
    
    // Sync user data to your database
    await syncUserFromSupabase(data.user.id);
    
    return { success: true, user: data.user };
  } catch (err) {
    console.error('Error in auth callback:', err);
    return { success: false, error: 'Internal server error' };
  }
}
