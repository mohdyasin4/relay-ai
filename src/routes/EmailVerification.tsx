import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { syncUserFromSupabase } from '@/lib/supabase/authSync';
import { DatabaseService } from '@/services/databaseService';
import { Loader } from '@/components/ui/loader';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const { token: urlToken } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'already_verified'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const supabase = createClient();
        
        // Get token and type from URL parameters (support both formats)
        const token = urlToken || searchParams.get('token');
        const type = searchParams.get('type') || 'signup'; // Default to signup for clean URLs
        const email = searchParams.get('email');

        if (!token) {
          setStatus('error');
          setMessage('Invalid verification link. Please check your email and try again.');
          return;
        }

        console.log('Verifying email with token:', token, 'type:', type);

        // Verify the email using the token
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as any, // Supabase expects 'signup' | 'email_change' | 'recovery' etc.
        });

        if (error) {
          console.error('Email verification error:', error);
          
          if (error.message?.includes('already been confirmed')) {
            setStatus('already_verified');
            setMessage('Your email has already been verified. You can now sign in.');
          } else {
            setStatus('error');
            setMessage(error.message || 'Email verification failed. Please try again.');
          }
          return;
        }

        if (data?.user) {
          // Sync user data with our database
          try {
            await syncUserFromSupabase(data.user.id);
            
            await DatabaseService.upsertUser({
              id: data.user.id,
              name: data.user.user_metadata?.full_name || 
                   data.user.user_metadata?.name || 
                   data.user.email?.split('@')[0] || 'User',
              email: data.user.email || ''
            });
            
            console.log('User synchronized successfully after email verification');
          } catch (syncError) {
            console.error('Error syncing user after verification:', syncError);
            // Continue with verification success even if sync fails
          }

          setStatus('success');
          setMessage('Email verified successfully! You can now sign in to your account.');
          
          // Redirect to login page after 3 seconds
          setTimeout(() => {
            navigate('/login?verified=true');
          }, 3000);
        } else {
          setStatus('error');
          setMessage('Email verification failed. No user data found.');
        }
      } catch (err) {
        console.error('Unexpected error during email verification:', err);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  const handleRetryVerification = () => {
    window.location.reload();
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-6 size-16 rounded-full bg-card flex items-center justify-center">
            {status === 'verifying' && (
              <Loader variant="circular" className="size-8 text-primary" />
            )}
            {status === 'success' && (
              <CheckCircle className="size-8 text-green-500" />
            )}
            {status === 'already_verified' && (
              <CheckCircle className="size-8 text-blue-500" />
            )}
            {status === 'error' && (
              <XCircle className="size-8 text-red-500" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-2">
            {status === 'verifying' && 'Verifying Your Email'}
            {status === 'success' && 'Email Verified!'}
            {status === 'already_verified' && 'Already Verified'}
            {status === 'error' && 'Verification Failed'}
          </h2>

          <p className="text-muted-foreground mb-6">
            {status === 'verifying' && 'Please wait while we verify your email address...'}
            {message}
          </p>

          <div className="space-y-3">
            {status === 'success' && (
              <div className="text-sm text-muted-foreground">
                Redirecting to login page in a few seconds...
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <button
                  onClick={handleRetryVerification}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <RefreshCw className="size-4" />
                  Try Again
                </button>
                <button
                  onClick={handleGoToLogin}
                  className="w-full inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Go to Login
                </button>
              </div>
            )}

            {(status === 'success' || status === 'already_verified') && (
              <button
                onClick={handleGoToLogin}
                className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Continue to Login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
