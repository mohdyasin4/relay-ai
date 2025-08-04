import { createClient } from '@/lib/supabase/client';

export interface InvitationRequest {
  email: string;
  inviterName: string;
  inviterEmail: string;
}

export interface InvitationResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Service for handling user invitations
 */
export class InvitationService {
  /**
   * Send an invitation email to a user to join the platform
   * This will either:
   * 1. Send a friend request if user already exists
   * 2. Send an email invitation if user doesn't exist
   */
  static async inviteUserByEmail(email: string, inviterName: string): Promise<InvitationResponse> {
    try {
      const supabase = createClient();
      
      // Get current user for inviter ID
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        return {
          success: false,
          message: 'Not authenticated',
          error: 'NOT_AUTHENTICATED'
        };
      }

      // Call Edge Function directly - it will handle the invitation record
      console.log('Calling send-invitation function with:', { email, inviterName, inviterId: currentUser.id });
      
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: email,
          inviterName: inviterName,
          inviterId: currentUser.id
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Error calling send-invitation function:', error);
        return {
          success: false,
          message: 'Error sending invitation',
          error: error.message
        };
      }

      return data || {
        success: true,
        message: `Invitation sent to ${email}`
      };

    } catch (error) {
      console.error('Error in inviteUserByEmail:', error);
      return {
        success: false,
        message: 'Unexpected error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send invitation using Supabase's built-in invite functionality
   * Note: This requires admin privileges and should be called from a backend/edge function
   */
  static async sendSupabaseInvitation(_email: string, _redirectTo?: string): Promise<InvitationResponse> {
    try {
      // This would typically be called from a backend with service role key
      // For now, we'll just return a placeholder
      return {
        success: false,
        message: 'Supabase admin invitations need to be implemented via Edge Functions',
        error: 'NOT_IMPLEMENTED'
      };
      
    } catch (error) {
      console.error('Error in sendSupabaseInvitation:', error);
      return {
        success: false,
        message: 'Error sending Supabase invitation',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
