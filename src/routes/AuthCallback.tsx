import React, { useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { syncUserFromSupabase } from '@/lib/supabase/authSync';
import { DatabaseService } from '@/services/databaseService';
import { useAuth } from '@/contexts/AuthContext';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  // No error UI; navigate away on failure to avoid flashing state
  const { refreshUserSession } = useAuth();
  
  useEffect(() => {
    const processAuth = async () => {
      try {
        // First check for code in search params (standard OAuth flow)
        const code = searchParams.get('code');
        
        // If there's an error in the URL, handle it
        const urlError = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (urlError || errorDescription) {
          console.error('Auth error from URL:', urlError, errorDescription);
          window.location.replace('/login?error=' + encodeURIComponent(errorDescription || urlError || 'Authentication error'));
          return;
        }
        
        // If we have a code, use the standard flow
        if (code) {
          const supabase = createClient();
          
          // Log relevant info for debugging
          console.log('Auth code received, exchanging for session');
          console.log('Current URL:', window.location.href);
          
          try {
            // First see if a session already exists (SDK may auto-handle PKCE via detectSessionInUrl)
            const pre = await supabase.auth.getSession();
            let data = { user: pre.data.session?.user } as any;
            let error: any = null;

            // If no user yet, explicitly exchange code
            if (!data.user) {
              const resp = await supabase.auth.exchangeCodeForSession(code);
              data = resp.data as any;
              error = resp.error;
            }
            
            if (error) {
              console.error('Error exchanging code for session:', error);
              
              // Handle flow state error specifically
              if (error.message.includes('flow_state_not_found') || error.message.includes('invalid flow state')) {
                console.log('Flow state error detected, redirecting to login');
                
                // Clear any stale auth data (defensive; we no longer use localStorage)
                try { localStorage.removeItem('gemini-messenger-auth'); } catch {}
                try { localStorage.removeItem('supabase.auth.token'); } catch {}
                await supabase.auth.signOut();
                
                // Redirect to login with error message
                window.location.replace('/login?error=Authentication+session+expired.+Please+try+again.');
                return;
              }
            }
            
            // If user data exists, sync with database
            if (data?.user) {
              // Sync user data with our database
              try {
                // Sync with Prisma if available
                await syncUserFromSupabase(data.user.id);
                
                // Also use DatabaseService as a fallback
                await DatabaseService.upsertUser({
                  id: data.user.id,
                  name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
                  email: data.user.email || ''
                });
                
                console.log('User synchronized successfully');
              } catch (syncError) {
                console.error('Error syncing user:', syncError);
                // Continue with auth flow even if sync fails
              }
              
              // Refresh the user session in the auth context
              try {
                await refreshUserSession();
              } catch (refreshError) {
                console.error('Error refreshing session:', refreshError);
                // Continue anyway
              }
              
              // Successfully authenticated - force direct navigation with replacement
              console.log('Authentication successful, redirecting to /app');
              window.location.replace('/app');
              return;
            } else {
              console.warn('No user data found after exchanging code');
            }
          } catch (authError) {
            console.error('Error during code exchange:', authError);
            window.location.replace('/login?error=' + encodeURIComponent((authError as Error)?.message || 'Unknown error'));
          }
        } 
        // Handle hash fragment (#) for implicit flow
        else if (location.hash) {
          // The hash will contain access_token, refresh_token, etc.
          const hashParams = new URLSearchParams(location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          
          if (accessToken) {
            const supabase = createClient();
            
            // Set the session from the hash values
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get('refresh_token') || '',
            });
            
            if (error) {
              console.error('Error setting session from hash:', error);
            }
            
            if (data?.user) {
              // Sync user data with our database
              try {
                // Sync with Prisma if available
                await syncUserFromSupabase(data.user.id);
                
                // Also use DatabaseService as a fallback
                await DatabaseService.upsertUser({
                  id: data.user.id,
                  name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
                  email: data.user.email || ''
                });
                
                console.log('User synchronized successfully');
              } catch (syncError) {
                console.error('Error syncing user:', syncError);
              }
              
              // Refresh the user session in the auth context
              try {
                await refreshUserSession();
              } catch (refreshError) {
                console.error('Error refreshing session:', refreshError);
              }
              
              // Successfully authenticated - force direct navigation with replacement
              console.log('Authentication successful (hash flow), redirecting to /app');
              window.location.replace('/app');
              return;
            }
          } else {
            console.warn('No access token found in callback URL, trying to get current session');
          }
        } else {
          console.warn('No authentication parameters found, trying to get current session');
        }
        
        // If we reach here, we didn't find a code or hash with access token
        // Try to check if we still have a valid session
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getSession();
          
          if (data.session?.user) {
            console.log('Found existing session, redirecting to /app');
            window.location.replace('/app');
            return;
          }
          // Fallback: try to parse tokens from hash if provider returned implicit tokens
          if (location.hash) {
            const hp = new URLSearchParams(location.hash.substring(1));
            const accessToken = hp.get('access_token');
            const refreshToken = hp.get('refresh_token');
            if (accessToken) {
              const { data: setData, error: setErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
              if (!setErr && setData?.user) {
                window.location.replace('/app');
                return;
              }
            }
          }
        } catch (sessionError) {
          console.error('Error checking session:', sessionError);
        }
        
        // If we got here, we don't have any valid authentication
        window.location.replace('/login?error=No+valid+authentication+found');
        
      } catch (err) {
        console.error('Error processing auth callback:', err);
        window.location.replace('/login?error=' + encodeURIComponent((err as Error)?.message || 'An unexpected error occurred'));
      }
    };
    
    processAuth();
    
    // Set a fallback timer to redirect if processing takes too long
    const fallbackTimer = setTimeout(() => {
      if (window.location.pathname.includes('/auth/callback')) {
        console.warn('Auth callback timeout reached, redirecting to login');
        window.location.href = '/login?error=Authentication+timeout.+Please+try+again.';
      }
    }, 10000); // 10 seconds timeout
    
    return () => clearTimeout(fallbackTimer);
  }, [searchParams, location.hash, refreshUserSession]);
  
  // Always show a clean, neutral preparing screen while processing
  return (
    <div className="min-h-svh bg-background flex items-center justify-center px-6" aria-busy>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 size-10 rounded-xl bg-primary/10 grid place-items-center">
          <div className="border-primary animate-spin rounded-full border-2 border-t-transparent size-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Preparing Relay</h1>
        <p className="text-sm text-muted-foreground mt-1">Securely signing you in and setting things up…</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <span className="text-primary font-medium text-sm">Loading</span>
          <span className="inline-flex">
            <span className="text-primary animate-[loading-dots_1.4s_infinite_0.2s]">.</span>
            <span className="text-primary animate-[loading-dots_1.4s_infinite_0.4s]">.</span>
            <span className="text-primary animate-[loading-dots_1.4s_infinite_0.6s]">.</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
