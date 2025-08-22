import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { createClient } from '@/lib/supabase/client';
import { Loader } from '@/components/ui/loader';

const ResetPasswordPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkResetFlow = async () => {
      try {
        const supabase = createClient();
        
        // Check if user is already authenticated (this happens when clicking reset link)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error checking session:', error);
          setError('Error checking authentication status');
          setIsLoading(false);
          return;
        }

        if (session) {
          // User is authenticated, check if this is a password reset flow
          const type = searchParams.get('type');
          
          if (type === 'recovery') {
            // This is a password reset flow, allow user to continue
            setIsLoading(false);
          } else {
            // User is logged in but not in reset flow, redirect to app
            navigate('/app');
          }
        } else {
          // No session, check if we have reset tokens in URL
          const accessToken = searchParams.get('access_token');
          const refreshToken = searchParams.get('refresh_token');
          const type = searchParams.get('type');
          
          if (accessToken && refreshToken && type === 'recovery') {
            // We have reset tokens, try to set the session
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (sessionError) {
              setError('Invalid or expired reset link. Please request a new password reset.');
            } else {
              // Session set successfully, allow password reset
              setIsLoading(false);
            }
          } else {
            // No valid reset flow, redirect to forgot password
            setError('Invalid or expired reset link. Please request a new password reset.');
            setTimeout(() => {
              navigate('/forgot-password');
            }, 3000);
          }
        }
      } catch (err: any) {
        console.error('Error in reset flow:', err);
        setError('An error occurred while processing your request');
        setIsLoading(false);
      }
    };

    checkResetFlow();
  }, [navigate, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="text-center">
          <Loader variant="circular" className="size-8 mb-4" />
          <p className="text-muted-foreground">Preparing password reset...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <motion.div 
          className="w-full max-w-md text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4">
            <p className="text-sm font-medium">{error}</p>
          </div>
          <p className="text-muted-foreground">Redirecting to forgot password page...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <motion.div 
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <ResetPasswordForm />
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
