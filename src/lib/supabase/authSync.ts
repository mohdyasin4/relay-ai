import { prisma } from '../prisma';
import { createServiceClient } from './client';

/**
 * Syncs a user from Supabase Auth to your database after signup or login
 * @param userId The Supabase Auth user ID
 */
export async function syncUserFromSupabase(userId: string) {
  const supabase = createServiceClient();
  
  // Get user data from Supabase Auth
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  
  if (userError || !userData.user) {
    console.error('Error fetching user from Supabase:', userError);
    return null;
  }
  
  const user = userData.user;
  
  // Check if user already exists in database
  const existingUser = await prisma.user.findUnique({
    where: { id: user.id }
  });
  
  if (existingUser) {
    // Update existing user
    return prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email || '',
        name: user.user_metadata.full_name || user.user_metadata.name || user.email?.split('@')[0] || 'User',
        avatarUrl: user.user_metadata.avatar_url,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new user
    return prisma.user.create({
      data: {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata.full_name || user.user_metadata.name || user.email?.split('@')[0] || 'User',
        avatarUrl: user.user_metadata.avatar_url,
        isNewUser: true,
      }
    });
  }
}
