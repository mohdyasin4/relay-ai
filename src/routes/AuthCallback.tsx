import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { syncUserFromSupabase } from '@/lib/supabase/authSync';
import { DatabaseService } from '@/services/databaseService';
import { useAuth } from '@/contexts/AuthContext';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
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
          setError(errorDescription || urlError || 'Authentication error');
          window.location.href = '/login?error=' + encodeURIComponent(errorDescription || urlError || 'Authentication error');
          return;
        }
        
        // If we have a code, use the standard flow
        if (code) {
          const supabase = createClient();
          
          // Log relevant info for debugging
          console.log('Auth code received, exchanging for session');
          console.log('Current URL:', window.location.href);
          
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Error exchanging code for session:', error);
              
              // Handle flow state error specifically
              if (error.message.includes('flow_state_not_found') || error.message.includes('invalid flow state')) {
                console.log('Flow state error detected, redirecting to login');
                
                // Clear any stale auth data
                localStorage.removeItem('gemini-messenger-auth');
                localStorage.removeItem('supabase.auth.token');
                await supabase.auth.signOut();
                
                // Redirect to login with error message
                window.location.href = '/login?error=Authentication+session+expired.+Please+try+again.';
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
              window.location.href = '/app'; // Use direct browser navigation instead of React Router
              return;
            } else {
              console.warn('No user data found after exchanging code');
              setError('Authentication failed: No user data found');
            }
          } catch (authError) {
            console.error('Error during code exchange:', authError);
            setError('Authentication failed: ' + ((authError as Error)?.message || 'Unknown error'));
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
              window.location.href = '/app';
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
            window.location.href = '/app';
            return;
          }
        } catch (sessionError) {
          console.error('Error checking session:', sessionError);
        }
        
        // If we got here, we don't have any valid authentication
        setError('No valid authentication found. Please try logging in again.');
        window.location.href = '/login?error=No+valid+authentication+found';
        
      } catch (err) {
        console.error('Error processing auth callback:', err);
        setError((err as Error)?.message || 'An unexpected error occurred');
        window.location.href = '/login?error=' + encodeURIComponent((err as Error)?.message || 'An unexpected error occurred');
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
  
  // Show loading state while processing authentication
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center">
        {error ? (
          <div className="mb-4 rounded-lg bg-red-100 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <p>Authentication Error</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-2xl font-semibold text-slate-800 dark:text-slate-200">
              Processing your sign in...
            </div>
            <div className="mb-4 text-slate-500 dark:text-slate-400">
              Please wait while we authenticate your account.
            </div>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300"></div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
