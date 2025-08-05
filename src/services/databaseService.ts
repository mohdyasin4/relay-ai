import { prisma } from '../lib/prisma';
import { createClient } from '../lib/supabase/client';
import type { User, Message, Contact } from '../types';

/**
 * Database service to handle all database operations
 * This service works in both browser and Node.js environments
 */
export class DatabaseService {
  /**
   * Get a user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    // In a browser environment, use Supabase API
    if (typeof window !== 'undefined') {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('User')
        .select('id, name, email, avatarUrl, status, lastSeen')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching user:', error);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatarUrl,
        status: data.status || 'offline',
        lastSeen: data.lastSeen || null
      };
    }
    
    // In a Node.js environment, use Prisma directly
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        status: user.status as 'online' | 'offline' | 'away',
        lastSeen: user.lastSeen || null
      };
    } catch (error) {
      console.error('Error fetching user with Prisma:', error);
      return null;
    }
  }
  
  /**
   * Create or update a user
   */
  static async upsertUser(userData: { 
    id: string, 
    name: string, 
    email?: string, 
    avatarUrl?: string
  }): Promise<User | null> {
    // In a browser environment, use Supabase API
    if (typeof window !== 'undefined') {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('User')
        .upsert({
          id: userData.id,
          name: userData.name,
          email: userData.email || '',
          avatarUrl: userData.avatarUrl || null,
          status: 'online',
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error || !data) {
        console.error('Error upserting user:', error);
        return null;
      }
      
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatarUrl,
        status: data.status,
        lastSeen: data.lastSeen || null
      };
    }
    
    // In a Node.js environment, use Prisma directly
    try {
      const user = await prisma.user.upsert({
        where: { id: userData.id },
        update: {
          name: userData.name,
          status: 'online',
          updatedAt: new Date()
        },
        create: {
          id: userData.id,
          email: userData.email || '',
          name: userData.name,
          status: 'online'
        }
      });
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        status: user.status as 'online' | 'offline' | 'away',
        lastSeen: user.lastSeen || null
      };
    } catch (error) {
      console.error('Error upserting user with Prisma:', error);
      return null;
    }
  }
  
  /**
   * Get all contacts for a user
   */
  static async getUserContacts(userId: string): Promise<Contact[]> {
  if (typeof window !== 'undefined') {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('Contact')
      .select(`
        id,
        isPinned,
        contactUserId,
        User:contactUserId (
          id,
          name,
          status,
          lastSeen
        )
      `)
      .eq('userId', userId);

    if (error || !data) {
      console.error('Error fetching contacts:', error);
      return [];
    }

    return data.map(contact => ({
      id: contact.contactUserId,
      name: contact.User?.name || '',
      status: contact.User?.status || 'offline',
      lastSeen: contact.User?.lastSeen || null, // ✅ This line fetches from User table
      isPinned: contact.isPinned,
      isAi: false,
      isGroup: false
    }));
  }

  // (Optional) Handle server-side if needed
  return [];
}

  /**
   * Get messages between two users or in a group
   */
  static async getMessages(options: { userId?: string, contactId?: string, groupId?: string, limit?: number }): Promise<Message[]> {
    // This is a simplified implementation
    // In a real app, you would implement both browser and Node.js versions
    return [];
  }

  /**
   * Update user status
   */
  static async updateUserStatus(userId: string, status: 'online' | 'offline' | 'away'): Promise<boolean> {
    // In a browser environment, use Supabase API
    if (typeof window !== 'undefined') {
      const supabase = createClient();
      const data: { 
        status: string; 
        updatedAt: string; 
        lastSeen?: string;
      } = { 
        status,
        updatedAt: new Date().toISOString()
      };
      // Update lastSeen when user goes offline
      if (status === 'offline') {
        data.lastSeen = new Date().toISOString();
      }
      const { error } = await supabase
        .from('User')
        .update(data)
        .eq('id', userId);
      if (error) {
        console.error('Error updating user status:', error);
        return false;
      }
      return true;
    }
    
    // In a Node.js environment, use Prisma directly
    try {
      const data: any = {
        status,
        updatedAt: new Date()
      };
      // Update lastSeen when user goes offline
      if (status === 'offline') {
        data.lastSeen = new Date();
      }
      await prisma.user.update({
        where: { id: userId },
        data
      });
      return true;
    } catch (error) {
      console.error('Error updating user status with Prisma:', error);
      return false;
    }
  }
  
  // Removed getLastLogoutTime; use lastSeen instead
  }

// Export a singleton instance for convenience
export const databaseService = new DatabaseService();
