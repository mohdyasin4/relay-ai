import { createClient } from '@/lib/supabase/client';
import type { User, Message, Contact } from '@/types      senderId: message.senderId,
      senderName: message.senderName,
      timestamp: message.timestamp, // Keep original ISO string format from database
      status: message.status,
      reactions: []
/**
 * This is a browser-compatible database service that uses REST API calls
 * instead of direct Prisma database access.
 */
class DatabaseClient {
  /**
   * Get the current user profile
   */
  async getCurrentUser(): Promise<User | null> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData.user) {
      return null;
    }
    
    // Get the user profile from your database table
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    
    if (error || !data) {
      console.error('Error fetching user:', error);
      return null;
    }
    
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      status: data.status || 'offline'
    };
  }
  
  /**
   * Get contacts for the current user
   */
  async getContacts(): Promise<Contact[]> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      return [];
    }

    // Get contacts with a join to get the contact user data, including lastSeen
    const { data, error } = await supabase
      .from('Contact')
      .select(`
        *,
        contactUser:User!contactUserId(id, name, status, lastSeen)
      `)
      .eq('userId', authData.user.id);

    if (error || !data) {
      console.error('Error fetching contacts:', error);
      return [];
    }

    // Transform to application Contact type, merging isPinned, isAi, and lastSeen
    return data.map(contact => ({
      id: contact.contactUserId,
      name: contact.contactUser.name,
      status: contact.contactUser.status,
      lastSeen: contact.contactUser.lastSeen,
      isPinned: contact.isPinned || false,
      isAi: contact.isAi || false
    }));
  }
  
  /**
   * Get messages between the current user and a contact
   */
  async getMessages(contactId: string): Promise<Message[]> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData.user) {
      return [];
    }
    
    // For a direct message, get messages between the two users
    const { data, error } = await supabase
      .from('Message')
      .select(`
        *,
        sender:User!senderId(id, name)
      `)
      .or(`senderId.eq.${authData.user.id},recipientId.eq.${authData.user.id}`)
      .or(`senderId.eq.${contactId},recipientId.eq.${contactId}`)
      .order('timestamp', { ascending: true });
    
    if (error || !data) {
      console.error('Error fetching messages:', error);
      return [];
    }
    
    // Transform to application Message type
    return data.map(message => ({
      type: 'chat',
      id: message.id,
      contactId: message.senderId === authData.user.id ? message.recipientId : message.senderId,
      text: message.text,
      senderId: message.senderId,
      senderName: message.sender.name,
      timestamp: message.timestamp, // Keep original ISO string format from database
      status: message.status,
      reactions: []
    }));
  }
  
  /**
   * Send a message
   */
  async sendMessage(contactId: string, text: string): Promise<Message | null> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData.user) {
      return null;
    }
    
    // Get the current user's name
    const { data: userData } = await supabase
      .from('User')
      .select('name')
      .eq('id', authData.user.id)
      .single();
    
    if (!userData) {
      console.error('Error fetching user data');
      return null;
    }
    
    // Create the message
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
    
    if (error || !data) {
      console.error('Error sending message:', error);
      return null;
    }
    
    // Return the created message
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
  }
  
  /**
   * Create a group
   */
  async createGroup(name: string, memberIds: string[]): Promise<any> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData.user) {
      return null;
    }
    
    // First create the group
    const { data: groupData, error: groupError } = await supabase
      .from('Group')
      .insert({
        name,
        creatorId: authData.user.id
      })
      .select()
      .single();
    
    if (groupError || !groupData) {
      console.error('Error creating group:', groupError);
      return null;
    }
    
    // Now add members to the group
    // This would typically be done with a many-to-many relation helper in Supabase
    // But for simplicity, we'll just show the concept
    const allMemberIds = [...new Set([...memberIds, authData.user.id])];
    
    // In a real implementation, you would add members to the group
    // through a group_members junction table
    console.log('Group created with ID:', groupData.id, 'and members:', allMemberIds);
    
    return {
      id: groupData.id,
      name: groupData.name,
      creatorId: groupData.creatorId,
      memberIds: allMemberIds
    };
  }
}

// Export a singleton instance
export const databaseClient = new DatabaseClient();
