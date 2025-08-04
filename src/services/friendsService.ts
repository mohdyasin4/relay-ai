import { createClient } from '@/lib/supabase/client';
import type { User, Contact } from '../types';
import { GroupService } from './groupService';
import { generateUUID } from '@/utils/uuidUtils';

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  sender: User;
  receiver: User;
}

/**
 * Service for handling friend requests and contacts
 */
export class FriendsService {
  /**
   * Get all friend requests for a user (both sent and received)
   */
  static async getFriendRequests(userId: string): Promise<{
    sent: FriendRequest[];
    received: FriendRequest[];
  }> {
    const supabase = createClient();
    
    // Get sent requests
    const { data: sentRequests } = await supabase
      .from('FriendRequest')
      .select(`
        id,
        senderId,
        receiverId,
        status,
        createdAt,
        receiver:User!receiverId(id, name, email, avatarUrl)
      `)
      .eq('senderId', userId)
      .eq('status', 'pending');

    // Get received requests
    const { data: receivedRequests } = await supabase
      .from('FriendRequest')
      .select(`
        id,
        senderId,
        receiverId,
        status,
        createdAt,
        sender:User!senderId(id, name, email, avatarUrl)
      `)
      .eq('receiverId', userId)
      .eq('status', 'pending');

    return {
      sent: sentRequests?.map(req => ({
        ...req,
        sender: null as any, // We don't need sender for sent requests
        receiver: req.receiver as any
      })) || [],
      received: receivedRequests?.map(req => ({
        ...req,
        sender: req.sender as any,
        receiver: null as any // We don't need receiver for received requests
      })) || []
    };
  }

  /**
   * Accept a friend request
   */
  static async acceptFriendRequest(requestId: string, userId: string, friendId: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const now = new Date().toISOString();
      
      // Update the friend request status
      const { error: updateError } = await supabase
        .from('FriendRequest')
        .update({ 
          status: 'accepted',
          updatedAt: now
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error updating friend request:', updateError);
        return false;
      }

      // Add both users to each other's contact list
      const { error: contactError } = await supabase
        .from('Contact')
        .insert([
          { 
            id: generateUUID(),
            userId: userId, 
            contactUserId: friendId,
            createdAt: now,
            updatedAt: now
          },
          { 
            id: generateUUID(),
            userId: friendId, 
            contactUserId: userId,
            createdAt: now,
            updatedAt: now
          }
        ]);

      if (contactError) {
        console.error('Error creating contacts:', contactError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }
  }

  /**
   * Reject a friend request
   */
  static async rejectFriendRequest(requestId: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('FriendRequest')
        .update({ 
          status: 'rejected',
          updatedAt: now
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error rejecting friend request:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      return false;
    }
  }

  /**
   * Get all contacts for a user (both real users and AI assistants)
   */
  static async getContacts(userId: string): Promise<Contact[]> {
    const supabase = createClient();
    
    try {
      // Check current auth state
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session?.user?.id);
      console.log('Requested userId:', userId);
      
      // Get regular user contacts (fetch contact records first)
      const { data: contactRecords, error: contactError } = await supabase
        .from('Contact')
        .select('id, contactUserId, isPinned, isAi, aiPersonaId')
        .eq('userId', userId);

      if (contactError) {
        console.error('Error fetching contact records:', contactError);
        return [];
      }

      console.log('Contact records fetched:', contactRecords);

      const contacts: Contact[] = [];

      // Process regular user contacts
      const userContactIds = contactRecords
        ?.filter(contact => !contact.isAi && contact.contactUserId)
        .map(contact => contact.contactUserId) || [];

      let users: any[] = [];
      if (userContactIds.length > 0) {
        const { data: fetchedUsers, error: userError } = await supabase
          .from('User')
          .select('id, name, email, avatarUrl, status')
          .in('id', userContactIds);

        if (userError) {
          console.error('Error fetching user data:', userError);
        } else if (fetchedUsers) {
          users = fetchedUsers;
          console.log('User data fetched:', users);
        }

        // Find missing user IDs
        const foundUserIds = new Set(users.map(u => u.id));
        const missingUserIds = userContactIds.filter(id => !foundUserIds.has(id));

        // Insert placeholder User records for missing users
        for (const missingId of missingUserIds) {
          const placeholderUser = {
            id: missingId,
            name: 'Unknown User',
            email: '',
            avatarUrl: '',
            status: 'offline'
          };
          // Insert placeholder into DB (optional, comment out if you don't want to persist)
          await supabase.from('User').insert([placeholderUser]);
          users.push(placeholderUser);
        }

        // Match users with their contact records
        users.forEach(user => {
          const contactRecord = contactRecords.find(c => c.contactUserId === user.id);
          if (contactRecord) {
            contacts.push({
              id: user.id,
              name: user.name,
              avatarUrl: user.avatarUrl,
              isAi: false,
              status: user.status || 'offline',
              isPinned: contactRecord.isPinned
            });
          }
        });
      }

      // Process AI contacts - match them with AI_PERSONAS
      const aiContactRecords = contactRecords?.filter(contact => contact.isAi) || [];
      if (aiContactRecords.length > 0) {
        const { AI_PERSONAS } = await import('../constants');
        aiContactRecords.forEach(contact => {
          const aiPersona = AI_PERSONAS.find(ai => ai.id === contact.aiPersonaId);
          if (aiPersona) {
            contacts.push({
              ...aiPersona,
              isPinned: contact.isPinned
            });
          }
        });
      }

      // Get user's groups
      const groupContacts = await GroupService.getUserGroups(userId);
      contacts.push(...groupContacts);

      console.log('Final contacts array (including groups):', contacts);
      return contacts;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }
  }

  /**
   * Remove a contact (unfriend)
   */
  static async removeContact(userId: string, contactId: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      // Remove both contact relationships
      const { error } = await supabase
        .from('Contact')
        .delete()
        .or(`and(userId.eq.${userId},contactUserId.eq.${contactId}),and(userId.eq.${contactId},contactUserId.eq.${userId})`);

      if (error) {
        console.error('Error removing contact:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing contact:', error);
      return false;
    }
  }

  /**
   * Toggle pin status for a contact (supports both user contacts and AI contacts)
   */
  static async togglePin(userId: string, contactId: string, isPinned: boolean): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const now = new Date().toISOString();
      
      // First try to update as a regular user contact
      const { error: userError, count: userCount } = await supabase
        .from('Contact')
        .update({ 
          isPinned,
          updatedAt: now
        })
        .eq('userId', userId)
        .eq('contactUserId', contactId);

      // If no regular contact found, try AI contact
      if (userCount === 0) {
        const { error: aiError } = await supabase
          .from('Contact')
          .update({ 
            isPinned,
            updatedAt: now
          })
          .eq('userId', userId)
          .eq('aiPersonaId', contactId)
          .eq('isAi', true);

        if (aiError) {
          console.error('Error toggling pin for AI contact:', aiError);
          return false;
        }
      } else if (userError) {
        console.error('Error toggling pin for user contact:', userError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error toggling pin:', error);
      return false;
    }
  }

  /**
   * Send a friend request
   */
  static async sendFriendRequest(senderId: string, receiverId: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const now = new Date().toISOString();
      const requestId = generateUUID();
      
      const { error } = await supabase
        .from('FriendRequest')
        .insert({
          id: requestId,
          senderId,
          receiverId,
          status: 'pending',
          createdAt: now,
          updatedAt: now
        });

      if (error) {
        console.error('Error sending friend request:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      return false;
    }
  }

  /**
   * Add an AI assistant as a contact
   */
  static async addAiContact(userId: string, aiPersonaId: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const now = new Date().toISOString();
      
      // Use upsert to handle duplicates gracefully
      const { error } = await supabase
        .from('Contact')
        .upsert({
          userId,
          isAi: true,
          aiPersonaId,
          updatedAt: now
        }, {
          onConflict: 'userId,aiPersonaId'
        });

      if (error) {
        console.error('Error adding AI contact:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding AI contact:', error);
      return false;
    }
  }

  /**
   * Remove an AI assistant from contacts
   */
  static async removeAiContact(userId: string, aiPersonaId: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from('Contact')
        .delete()
        .eq('userId', userId)
        .eq('aiPersonaId', aiPersonaId)
        .eq('isAi', true);

      if (error) {
        console.error('Error removing AI contact:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing AI contact:', error);
      return false;
    }
  }
}
