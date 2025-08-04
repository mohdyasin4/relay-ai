// Google People API service for fetching Gmail contacts
export interface GoogleContact {
  resourceName: string;
  etag: string;
  names?: Array<{
    displayName: string;
    givenName?: string;
    familyName?: string;
  }>;
  emailAddresses?: Array<{
    value: string;
    type?: string;
  }>;
  photos?: Array<{
    url: string;
  }>;
}

export interface ProcessedContact {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  source: 'google' | 'app';
  friendRequestStatus?: 'none' | 'sent' | 'received' | 'friends';
}

class GoogleContactsService {
  private static readonly SCOPES = 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/contacts.other.readonly openid email profile';
  private static readonly PEOPLE_API_URL = 'https://people.googleapis.com/v1/people/me/connections';

  /**
   * Request Google contacts permission and fetch contacts
   */
  static async getGoogleContacts(accessToken: string): Promise<ProcessedContact[]> {
    try {
      console.log('🔍 Fetching Google contacts with token:', accessToken.substring(0, 10) + '...');
      
      // Try primary connections first
      let contacts: any[] = [];
      
      // Method 1: Get connections (main contacts)
      const connectionsUrl = `${this.PEOPLE_API_URL}?personFields=names,emailAddresses,photos&pageSize=100&sortOrder=LAST_MODIFIED_DESCENDING`;
      console.log('🌐 Trying connections API:', connectionsUrl);
      
      const connectionsResponse = await fetch(connectionsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Connections API response status:', connectionsResponse.status);

      if (!connectionsResponse.ok) {
        const errorText = await connectionsResponse.text();
        console.error('❌ Connections API error:', connectionsResponse.status, errorText);
        
        // If it's a 403 permission error, the user needs to re-authenticate with contacts scope
        if (connectionsResponse.status === 403) {
          console.error('🚫 Insufficient permissions for Google Contacts. User needs to re-authenticate.');
          throw new Error('INSUFFICIENT_PERMISSIONS');
        }
      } else {
        const connectionsData = await connectionsResponse.json();
        console.log('✅ Connections data:', connectionsData);
        contacts = connectionsData.connections || [];
        console.log(`📊 Found ${contacts.length} connections`);
      }

      // Method 2: Try otherContacts if connections is empty (fallback)
      if (contacts.length === 0) {
        console.log('🔄 No connections found, trying otherContacts...');
        const otherContactsUrl = 'https://people.googleapis.com/v1/otherContacts?pageSize=100&readMask=names,emailAddresses,photos';
        
        const otherResponse = await fetch(otherContactsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('📡 Other contacts API response status:', otherResponse.status);

        if (!otherResponse.ok) {
          const otherErrorText = await otherResponse.text();
          console.error('❌ Other contacts API error:', otherResponse.status, otherErrorText);
          
          // If it's a 403 permission error, the user needs to re-authenticate with contacts scope
          if (otherResponse.status === 403) {
            console.error('🚫 Insufficient permissions for Google Other Contacts. User needs to re-authenticate.');
            throw new Error('INSUFFICIENT_PERMISSIONS');
          }
        } else {
          const otherData = await otherResponse.json();
          console.log('✅ Other contacts data:', otherData);
          contacts = otherData.otherContacts || [];
          console.log(`📊 Found ${contacts.length} other contacts`);
        }
      }

      console.log(`📊 Total contacts to process: ${contacts.length}`);
      
      const processedContacts = this.processGoogleContacts(contacts);
      console.log(`✅ Processed ${processedContacts.length} Google contacts`);
      
      return processedContacts;
    } catch (error) {
      console.error('❌ Error fetching Google contacts:', error);
      throw error;
    }
  }

  /**
   * Process raw Google contacts into our format
   */
  private static processGoogleContacts(contacts: GoogleContact[]): ProcessedContact[] {
    console.log(`🔧 Processing ${contacts.length} raw contacts`);
    
    if (contacts.length === 0) {
      console.log('⚠️ No contacts to process');
      return [];
    }

    // Log all contacts for debugging
    console.log('🔍 All contact structures:', contacts.map((contact, index) => ({
      index,
      resourceName: contact.resourceName,
      hasNames: !!contact.names?.length,
      names: contact.names,
      hasEmails: !!contact.emailAddresses?.length,
      emails: contact.emailAddresses,
      hasPhotos: !!contact.photos?.length
    })));
    
    const processed = contacts
      .map((contact, index) => {
        const hasName = contact.names?.length;
        const hasEmail = contact.emailAddresses?.length;
        
        // Extract name - be more flexible with name extraction
        let name = '';
        if (hasName) {
          const nameObj = contact.names![0];
          name = nameObj.displayName || 
                 `${nameObj.givenName || ''} ${nameObj.familyName || ''}`.trim() ||
                 nameObj.givenName || 
                 nameObj.familyName || '';
        }
        
        // Extract email
        const email = hasEmail ? contact.emailAddresses![0].value : '';
        
        // Extract avatar
        const avatarUrl = contact.photos?.[0]?.url;
        
        // If we have either a name or email, we can process this contact
        if (!name && !email) {
          console.log(`❌ Skipping contact ${index} - no name or email:`, {
            resourceName: contact.resourceName,
            hasName,
            hasEmail,
            names: contact.names,
            emails: contact.emailAddresses
          });
          return null;
        }
        
        // If no name but have email, use email as name
        if (!name && email) {
          name = email.split('@')[0]; // Use email prefix as name
        }
        
        // If no email but have name, we can still show the contact but can't invite them
        if (!email && name) {
          console.log(`⚠️ Contact ${index} has name but no email - will be display-only:`, {
            name,
            resourceName: contact.resourceName
          });
        }
        
        console.log(`✅ Processed contact ${index}:`, { 
          resourceName: contact.resourceName,
          name, 
          email: email || '(no email)',
          avatarUrl 
        });
        
        return {
          id: contact.resourceName,
          name,
          email,
          avatarUrl,
          source: 'google' as const,
          friendRequestStatus: 'none' as const,
        };
      })
      .filter(contact => contact !== null) // Remove null entries
      .filter(contact => {
        // Final validation - we need at least a name
        const isValid = contact!.name;
        if (!isValid) {
          console.log(`❌ Final filter removing contact - no name:`, contact);
        }
        return isValid;
      }) as ProcessedContact[];
    
    console.log(`✅ Successfully processed ${processed.length} contacts out of ${contacts.length} raw contacts`);
    console.log('📋 Final processed contacts:', processed);
    return processed;
  }

  /**
   * Get Google access token from current session
   */
  static async getGoogleAccessToken(): Promise<string | null> {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('🔐 Checking Google session:', {
        hasSession: !!session,
        provider: session?.user?.app_metadata?.provider,
        hasProviderToken: !!session?.provider_token,
        hasProviderRefreshToken: !!session?.provider_refresh_token,
        userMetadata: session?.user?.user_metadata,
        sessionKeys: session ? Object.keys(session) : []
      });
      
      // Try different ways to get the token
      if (session?.provider_token && session?.user?.app_metadata?.provider === 'google') {
        console.log('✅ Found provider_token');
        return session.provider_token;
      }
      
      // Try refresh token approach
      if (session?.provider_refresh_token && session?.user?.app_metadata?.provider === 'google') {
        console.log('🔄 Found refresh token, attempting to refresh access token...');
        try {
          const refreshResult = await supabase.auth.refreshSession();
          if (refreshResult.data?.session?.provider_token) {
            console.log('✅ Refreshed and got new provider token');
            return refreshResult.data.session.provider_token;
          }
        } catch (refreshError) {
          console.error('❌ Error refreshing session:', refreshError);
        }
      }
      
      console.log('❌ No Google access token available');
      return null;
    } catch (error) {
      console.error('Error getting Google access token:', error);
      return null;
    }
  }

  /**
   * Check if Google Contacts permission is available
   */
  static async checkGoogleContactsPermission(): Promise<boolean> {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if user is logged in with Google and has a provider token
      if (!session?.provider_token || session?.user?.app_metadata?.provider !== 'google') {
        return false;
      }

      // Test API access with existing token
      const response = await fetch(
        `${this.PEOPLE_API_URL}?personFields=names&pageSize=1`,
        {
          headers: {
            'Authorization': `Bearer ${session.provider_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error checking Google contacts permission:', error);
      return false;
    }
  }

  /**
   * Request additional scopes for Google Contacts
   */
  static async requestContactsPermission(): Promise<boolean> {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      console.log('🔄 Requesting Google contacts permission...');
      
      // Re-authenticate with additional scopes to get provider token
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: this.SCOPES,
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true'
          }
        }
      });

      if (error) {
        console.error('Error requesting contacts permission:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return false;
    }
  }

  /**
   * Force re-authentication to get Google contacts access
   */
  static async forceReauth(): Promise<boolean> {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      console.log('🔄 Forcing re-authentication for Google contacts...');
      
      // Sign out and re-authenticate with proper scopes
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: this.SCOPES,
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            approval_prompt: 'force',
            include_granted_scopes: 'true'
          }
        }
      });

      if (error) {
        console.error('Error during forced re-auth:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error during forced re-auth:', error);
      return false;
    }
  }
}

export default GoogleContactsService;
