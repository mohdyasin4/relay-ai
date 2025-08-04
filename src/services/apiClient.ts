/**
 * API client for database operations in the browser environment
 * 
 * This module provides a simple REST API client that can be used instead of Prisma in the browser.
 * In a real application, you would implement actual API endpoints on the server side.
 */

import { createClient } from '@/lib/supabase/client';
import type { User, Message, Contact } from '@/types';

export class ApiClient {
  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData?.user) {
      return null;
    }
    
    // Get user data from the database
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
    if (error || !data) {
      console.error('Error fetching user data:', error);
      // Return a minimal user object based on auth data
      return {
        id: authData.user.id,
        name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'User',
      };
    }
    
    return {
      id: data.id,
      name: data.name,
      email: data.email
    };
  }
  
  /**
   * Get contacts for the current user
   */
  async getContacts(): Promise<Contact[]> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData?.user) {
      return [];
    }
    
    // Get contacts through a custom RPC function or REST endpoint
    // In a real app, this would use a stored procedure or API endpoint
    try {
      const { data, error } = await supabase
        .from('Contact')
        .select(`
          id,
          isPinned,
          contactUserId,
          contactUser:User!contactUserId(id, name, status)
        `)
        .eq('userId', authData.user.id);
        
      if (error) {
        throw error;
      }
      
      return (data || []).map(contact => ({
        id: contact.contactUserId,
        name: contact.contactUser.name,
        status: contact.contactUser.status,
        isPinned: contact.isPinned,
        isAi: false,
        isGroup: false
      }));
    } catch (err) {
      console.error('Error fetching contacts:', err);
      return [];
    }
  }
  
  /**
   * Get messages for a conversation
   */
  async getMessages(contactId: string): Promise<Message[]> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData?.user) {
      return [];
    }
    
    try {
      // For direct messages between two users
      const { data, error } = await supabase
        .from('Message')
        .select(`
          id, 
          text, 
          senderId, 
          recipientId,
          status,
          timestamp,
          attachmenturl,
          sender:User!senderId(id, name)
        `)
        .or(`and(senderId.eq.${authData.user.id},recipientId.eq.${contactId}),and(senderId.eq.${contactId},recipientId.eq.${authData.user.id})`)
        .order('timestamp', { ascending: true });
        
      if (error) {
        throw error;
      }
      
      return (data || []).map(msg => ({
        type: 'chat',
        id: msg.id,
        contactId: msg.senderId === authData.user.id ? msg.recipientId : msg.senderId,
        text: msg.text,
        senderId: msg.senderId,
        senderName: msg.sender.name,
        timestamp: new Date(msg.timestamp),
        status: msg.status as 'sent' | 'delivered' | 'read',
        reactions: []
      }));
    } catch (err) {
      console.error('Error fetching messages:', err);
      return [];
    }
  }
  
  /**
   * Send a message
   */
  async sendMessage(contactId: string, text: string): Promise<Message | null> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData?.user) {
      return null;
    }
    
    try {
      // Get current user info
      const { data: userData } = await supabase
        .from('User')
        .select('name')
        .eq('id', authData.user.id)
        .single();
        
      if (!userData) {
        throw new Error('Could not get current user data');
      }
      
      // Create message in the database
      const { data, error } = await supabase
        .from('Message')
        .insert({
          text,
          senderId: authData.user.id,
          recipientId: contactId,
          status: 'sent'
        })
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      return {
        type: 'chat',
        id: data.id,
        contactId,
        text: data.text,
        senderId: authData.user.id,
        senderName: userData.name,
        timestamp: new Date(data.timestamp),
        status: 'sent',
        reactions: []
      };
    } catch (err) {
      console.error('Error sending message:', err);
      return null;
    }
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
