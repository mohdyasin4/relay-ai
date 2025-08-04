import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DatabaseService } from '@/services/databaseService';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
  refreshUserSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        
        // Check for Supabase session
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Supabase session check failed:', error);
        }
        
        if (session?.user) {
          // We have a valid Supabase session
          console.log('Found Supabase session, fetching user data');
          
          // Try to get user data from our database
          const dbUser = await DatabaseService.getUserById(session.user.id);
          
          if (dbUser) {
            // We have user data in our database
            const userData: User = {
              id: dbUser.id,
              name: dbUser.name,
              email: session.user.email || '',
              avatar: dbUser.avatarUrl || session.user.user_metadata?.avatar_url
            };
            
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            // User exists in Supabase but not in our database
            // Create user in database
            console.log('User not found in database, creating new user');
            try {
              const newUser = await DatabaseService.upsertUser({
                id: session.user.id,
                name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                avatarUrl: session.user.user_metadata?.avatar_url
              });
              
              if (newUser) {
                const userData: User = {
                  id: newUser.id,
                  name: newUser.name,
                  email: session.user.email || '',
                  avatar: newUser.avatarUrl || session.user.user_metadata?.avatar_url
                };
                
                setUser(userData);
                localStorage.setItem('user', JSON.stringify(userData));
              }
            } catch (dbError) {
              console.error('Failed to create user in database:', dbError);
            }
          }
        } else {
          // No Supabase session, check localStorage as fallback
          const savedUser = localStorage.getItem('user');
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      if (data?.user) {
        // Try to get user data from our database
        const dbUser = await DatabaseService.getUserById(data.user.id);
        
        if (dbUser) {
          const userData: User = {
            id: dbUser.id,
            name: dbUser.name,
            email: data.user.email || '',
            avatar: dbUser.avatarUrl || data.user.user_metadata?.avatar_url
          };
          
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } else {
          // User exists in Supabase but not in our database
          // Create user in database
          try {
            const newUser = await DatabaseService.upsertUser({
              id: data.user.id,
              name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
              email: data.user.email,
              avatarUrl: data.user.user_metadata?.avatar_url
            });
            
            if (newUser) {
              const userData: User = {
                id: newUser.id,
                name: newUser.name,
                email: data.user.email || '',
                avatar: newUser.avatarUrl || data.user.user_metadata?.avatar_url
              };
              
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
            }
          } catch (dbError) {
            console.error('Failed to create user in database:', dbError);
            // Still consider login successful if Supabase auth succeeded
          }
        }
        
        return { success: true };
      } else {
        return { success: false, error: 'Login failed. Please try again.' };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            name: name
          }
        }
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      if (data?.user) {
        // Create user in our database
        try {
          const newUser = await DatabaseService.upsertUser({
            id: data.user.id,
            name: name,
            email: data.user.email,
            avatarUrl: data.user.user_metadata?.avatar_url
          });
          
          if (newUser) {
            const userData: User = {
              id: newUser.id,
              name: newUser.name,
              email: data.user.email || '',
              avatar: newUser.avatarUrl || data.user.user_metadata?.avatar_url
            };
            
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('User registered successfully:', userData);
          }
        } catch (dbError) {
          console.error('Failed to create user in database:', dbError);
          // Still consider registration successful if Supabase auth succeeded
        }
        
        return { success: true };
      } else {
        return { success: false, error: 'Registration failed. Please try again.' };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Registration failed. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('Signing out from Supabase...');
      
      // Sign out from Supabase
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error during Supabase signOut:', error);
      } else {
        console.log('Supabase signOut successful');
      }
      
      // Clear local state
      setUser(null);
      localStorage.removeItem('user');
      
      return true;
    } catch (error) {
      console.error('Exception during logout:', error);
      // Still clear local state even if Supabase logout fails
      setUser(null);
      localStorage.removeItem('user');
      return false;
    }
  };

  // Add a function to manually refresh the user session
  const refreshUserSession = async () => {
    try {
      setLoading(true);
      console.log('Refreshing user session...');
      
      // Check for Supabase session
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Supabase session refresh failed:', error);
        return;
      }
      
      if (session?.user) {
        console.log('Found valid session during refresh, fetching user data');
        
        // Try to get user data from our database
        const dbUser = await DatabaseService.getUserById(session.user.id);
        
        if (dbUser) {
          // We have user data in our database
          const userData: User = {
            id: dbUser.id,
            name: dbUser.name,
            email: session.user.email || '',
            avatar: dbUser.avatarUrl || session.user.user_metadata?.avatar_url
          };
          
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          console.log('User session refreshed successfully:', userData);
        } else {
          // User exists in Supabase but not in our database
          // Create user in database
          console.log('Creating user in database during refresh');
          try {
            const newUser = await DatabaseService.upsertUser({
              id: session.user.id,
              name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
              email: session.user.email,
              avatarUrl: session.user.user_metadata?.avatar_url
            });
            
            if (newUser) {
              const userData: User = {
                id: newUser.id,
                name: newUser.name,
                email: session.user.email || '',
                avatar: newUser.avatarUrl || session.user.user_metadata?.avatar_url
              };
              
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
              console.log('New user created during refresh:', userData);
            }
          } catch (dbError) {
            console.error('Failed to create user in database during refresh:', dbError);
          }
        }
      } else {
        console.log('No valid session found during refresh');
      }
    } catch (error) {
      console.error('Error during session refresh:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    refreshUserSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
