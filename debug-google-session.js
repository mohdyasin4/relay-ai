// Debug function to check Google session and tokens
// Open browser console and run: checkGoogleSession()

window.checkGoogleSession = async function() {
  try {
    console.log('🔍 Checking Google OAuth session...');
    
    // Import Supabase client
    const { createClient } = await import('./src/lib/supabase/client.js');
    const supabase = createClient();
    
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('📊 Session Analysis:');
    console.log('- Has session:', !!session);
    console.log('- Provider:', session?.user?.app_metadata?.provider);
    console.log('- Has provider_token:', !!session?.provider_token);
    console.log('- Has provider_refresh_token:', !!session?.provider_refresh_token);
    
    if (session?.provider_token) {
      console.log('- Provider token preview:', session.provider_token.substring(0, 20) + '...');
      
      // Test the token with Google People API
      console.log('🧪 Testing token with Google People API...');
      
      try {
        const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names&pageSize=1', {
          headers: {
            'Authorization': `Bearer ${session.provider_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('📡 People API test response:', response.status, response.statusText);
        
        if (response.ok) {
          console.log('✅ Token is valid and has contacts permission!');
        } else {
          const errorText = await response.text();
          console.log('❌ Token test failed:', errorText);
          
          if (response.status === 403) {
            console.log('🚫 403 Error - Token lacks contacts permission. Need to re-authenticate.');
          } else if (response.status === 401) {
            console.log('🔑 401 Error - Token is invalid or expired.');
          }
        }
      } catch (apiError) {
        console.error('❌ API test error:', apiError);
      }
    } else {
      console.log('❌ No provider_token found in session');
    }
    
    console.log('📝 Raw session object:', session);
    
  } catch (error) {
    console.error('❌ Error checking session:', error);
  }
};

console.log('🔧 Debug function loaded! Run checkGoogleSession() to test your OAuth session.');
