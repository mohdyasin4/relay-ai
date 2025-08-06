
import { createClient } from '@/lib/supabase/client';
import type { Message } from '../types';
import { generateUUID } from '@/utils/uuidUtils';

export interface DatabaseMessage {
  id: string;
  text: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
  attachmenturl?: string;
  reactions?: string[]; // Array of emoji strings
}

export class MessageService {
  /**
   * Save a message to the database
   */
  static async saveMessage(message: Message): Promise<boolean> {
    const supabase = createClient();
    try {
      // Check if sender is an AI persona
      const { AI_PERSONAS } = await import('../constants');
      const isAiSender = AI_PERSONAS.some(ai => ai.id === message.senderId);

      // Always generate a new UUID if not provided
      let msgId = message.id || generateUUID();

      // Check for duplicate message (same sender, text, timestamp, contact/group)
      let duplicateQuery = supabase.from('Message').select('id')
        .eq('text', message.text)
        .eq('timestamp', typeof message.timestamp === 'string' ? message.timestamp : (message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date().toISOString()));
      if (message.isGroup) {
        duplicateQuery = duplicateQuery.eq('groupId', message.contactId);
      } else {
        duplicateQuery = duplicateQuery.eq('recipientId', message.contactId).eq('senderId', isAiSender ? null : message.senderId);
      }
      const { data: existing, error: dupError } = await duplicateQuery.maybeSingle();
      if (dupError) {
        console.error('Error checking for duplicate message:', dupError);
        // Fail safe: allow insert
      }
      if (existing && existing.id) {
        // Message already exists, do not insert again
        console.log('Duplicate message detected, skipping insert:', existing.id);
        return true;
      }

      const { error } = await supabase
        .from('Message')
        .insert({
          id: msgId,
          text: message.text,
          senderId: isAiSender ? null : message.senderId, // Null for AI messages
          aiSenderId: isAiSender ? message.senderId : null, // AI persona ID
          senderName: message.senderName,
          recipientId: message.isGroup ? null : message.contactId,
          groupId: message.isGroup ? message.contactId : null,
          status: message.status || 'sent',
          timestamp: typeof message.timestamp === 'string' 
            ? message.timestamp 
            : (message.timestamp instanceof Date 
                ? message.timestamp.toISOString() 
                : new Date().toISOString()),
          attachmenturl: message.attachment?.url || null,
          isAiMessage: isAiSender,
          // Add reply fields if message has a replyTo property
          replyToId: message.replyTo?.id || null,
          replyToText: message.replyTo?.text || null,
          replyToSenderId: message.replyTo?.senderId || null,
          replyToSenderName: message.replyTo?.senderName || null
        });

      if (error) {
        console.error('Error saving message:', error);
        return false;
      }

      console.log(`${isAiSender ? 'AI' : 'User'} message saved to database:`, msgId);
      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      return false;
    }
  }

  /**
 * Get messages for a chat (either direct or group)
 */
static async getMessages(contactId: string, isGroup: boolean = false, limit: number = 50): Promise<Message[]> {
  const supabase = createClient();
  
  try {
    let query = supabase
      .from('Message')
      .select(`
        id,
        text,
        senderId,
        aiSenderId,
        senderName,
        recipientId,
        groupId,
        status,
        timestamp,
        attachmenturl,
        isAiMessage,
        replyToId,
        replyToText,
        replyToSenderId,
        replyToSenderName,
        sender:User!senderId(name)
      `)
      .order('timestamp', { ascending: true });

    if (isGroup) {
      // For group messages, filter by groupId
      query = query.eq('groupId', contactId);
    } else {
      // For direct messages, we need to get the current user
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUserId = session?.user?.id;

      if (!currentUserId) {
        console.error('No authenticated user');
        return [];
      }

      // For direct messages, we want messages where:
      // 1. Current user sent to contactId (senderId = currentUserId AND recipientId = contactId)
      // 2. ContactId sent to current user (senderId = contactId AND recipientId = currentUserId)  
      // 3. AI sent to current user (aiSenderId = contactId AND recipientId = currentUserId)
      // Use .or() for the OR condition
      query = query.is('groupId', null)
        .or(`and(senderId.eq.${currentUserId},recipientId.eq.${contactId}),and(senderId.eq.${contactId},recipientId.eq.${currentUserId}),and(aiSenderId.eq.${contactId},recipientId.eq.${currentUserId})`);
    }

    // Remove .limit(limit) to ensure all messages are fetched

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    if (!messages || messages.length === 0) {
      return [];
    }

    // Fetch reactions for all messages
    const messageIds = messages.map(msg => msg.id);
    const { data: reactions, error: reactionsError } = await supabase
      .from('Reaction')
      .select('*')
      .in('messageId', messageIds);
    const reactionsByMessageId: Record<string, { emoji: string, userId: string }[]> = {};
    if (reactions) {
      for (const reaction of reactions) {
        if (!reactionsByMessageId[reaction.messageId]) {
          reactionsByMessageId[reaction.messageId] = [];
        }
        reactionsByMessageId[reaction.messageId].push({
          emoji: reaction.emoji,
          userId: reaction.userId
        });
      }
    }

    // Convert database messages to app message format
    return messages.map(msg => ({
      type: 'chat' as const,
      id: msg.id,
      contactId: msg.groupId || msg.recipientId || '',
      text: msg.text,
      senderId: msg.isAiMessage ? msg.aiSenderId : msg.senderId,
      senderName: msg.senderName || (msg.sender as any)?.name || 'Unknown',
      timestamp: msg.timestamp, // Keep as ISO string for consistent date handling
      status: msg.status as 'sent' | 'delivered' | 'read',
      isGroup: !!msg.groupId,
      reactions: reactionsByMessageId[msg.id] || [],
      ...(msg.attachmenturl && { 
        attachment: { 
          type: 'image' as const, 
          url: msg.attachmenturl 
        } 
      }),
      ...(msg.replyToId && {
        replyTo: {
          id: msg.replyToId,
          text: msg.replyToText || '',
          senderId: msg.replyToSenderId || '',
          senderName: msg.replyToSenderName || 'Unknown'
        }
      })
    }));
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

  /**
   * Update message status (sent, delivered, read)
   */
  static async updateMessageStatus(messageId: string, status: 'queued' | 'sent' | 'delivered' | 'read'): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from('Message')
        .update({ status })
        .eq('id', messageId);

      if (error) {
        console.error('Error updating message status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating message status:', error);
      return false;
    }
  }

  /**
   * Add reaction to a message
   */
  static async addReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from('Reaction')
        .insert({
          id: generateUUID(),
          messageId,
          userId,
          emoji,
          createdAt: new Date().toISOString()
        });

      if (error) {
        console.error('Error adding reaction:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding reaction:', error);
      return false;
    }
  }

  /**
   * Remove reaction from a message
   */
  static async removeReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from('Reaction')
        .delete()
        .eq('messageId', messageId)
        .eq('userId', userId)
        .eq('emoji', emoji);

      if (error) {
        console.error('Error removing reaction:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing reaction:', error);
      return false;
    }
  }

  /**
   * Save a message with attachment
   * This will upload the attachment first, then save the message with the attachment URL
   */
  static async saveMessageWithAttachment(
    message: Message, 
    file: File
  ): Promise<boolean> {
    try {
      // Import the uploadAttachment function
      const { uploadAttachment } = await import('../utils/storageUtils');
      
      // Upload the file to get its URL
      const attachmenturl = await uploadAttachment({
        userId: message.senderId,
        file,
      });
      
      // Create a new message with the attachment URL
      const messageWithAttachment: Message = {
        ...message,
        attachment: {
          type: 'image',
          url: attachmenturl
        }
      };
      
      // Save the message with the attachment URL
      return await this.saveMessage(messageWithAttachment);
    } catch (error) {
      console.error('Error saving message with attachment:', error);
      return false;
    }
  }

  /**
   * Delete a message and its attachment if any
   */
  static async deleteMessage(messageId: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      // First, get the message to check if it has an attachment
      const { data: message, error: fetchError } = await supabase
        .from('Message')
        .select('attachmenturl')
        .eq('id', messageId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching message for deletion:', fetchError);
        return false;
      }
      
      // If there's an attachment, delete it from storage
      if (message?.attachmenturl) {
        try {
          const { deleteAttachment } = await import('../utils/storageUtils');
          await deleteAttachment(message.attachmenturl);
        } catch (storageError) {
          console.error('Error deleting attachment:', storageError);
          // Continue with message deletion even if attachment deletion fails
        }
      }
      
      // Delete the message
      const { error: deleteError } = await supabase
        .from('Message')
        .delete()
        .eq('id', messageId);
        
      if (deleteError) {
        console.error('Error deleting message:', deleteError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }

  /**
   * Get reactions for messages
   */
  static async getReactions(messageIds: string[]): Promise<{ [messageId: string]: string[] }> {
    const supabase = createClient();
    
    try {
      const { data: reactions, error } = await supabase
        .from('Reaction')
        .select('messageId, emoji')
        .in('messageId', messageIds);

      if (error) {
        console.error('Error fetching reactions:', error);
        return {};
      }

      // Group reactions by message ID
      const reactionMap: { [messageId: string]: string[] } = {};
      reactions?.forEach(reaction => {
        if (!reactionMap[reaction.messageId]) {
          reactionMap[reaction.messageId] = [];
        }
        reactionMap[reaction.messageId].push(reaction.emoji);
      });

      return reactionMap;
    } catch (error) {
      console.error('Error fetching reactions:', error);
      return {};
    }
  }

  /**
   * Get unread messages for a user
   * This is used when a user logs in to check for messages received while offline
   */
  static async getUnreadMessages(userId: string): Promise<{ [contactId: string]: Message[] }> {
    const supabase = createClient();
    
    try {
      // Get the user's last seen time to find messages received while offline
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('lastSeen')
        .eq('id', userId)
        .single();
      if (userError) {
        console.error('Error fetching user last seen time:', userError);
      }
      const lastSeenTime = userData?.lastSeen ? new Date(userData.lastSeen) : null;
      console.log('User last seen time:', lastSeenTime?.toISOString() || 'None');
      
      // Get the groups the user is a member of
      const { data: groupData, error: groupError } = await supabase
        .from('Group')
        .select('id')
        .contains('memberIds', [userId]);
        
      if (groupError) {
        console.error('Error fetching user groups:', groupError);
      }
      
      const groupIds = groupData?.map(g => g.id) || [];
      
      // Build the query for direct messages to the user
      let directMessageQuery = supabase
        .from('Message')
        .select(`
          id,
          text,
          senderId,
          aiSenderId,
          senderName,
          recipientId,
          groupId,
          status,
          timestamp,
          attachmenturl,
          isAiMessage,
          sender:User!senderId(name)
        `)
        .eq('recipientId', userId)
        .neq('senderId', userId)
        .neq('status', 'read');
      
      // If we have a last seen time, only get messages after that time
      if (lastSeenTime) {
        directMessageQuery = directMessageQuery.gte('timestamp', lastSeenTime.toISOString());
      }
      
      const { data: directMessages, error: directError } = await directMessageQuery;
      
      if (directError) {
        console.error('Error fetching unread direct messages:', directError);
      }
      
      // Group messages query
      let groupMessages: any[] = [];
      
      if (groupIds.length > 0) {
        let groupMessageQuery = supabase
          .from('Message')
          .select(`
            id,
            text,
            senderId,
            aiSenderId,
            senderName,
            recipientId,
            groupId,
            status,
            timestamp,
            attachmenturl,
            isAiMessage,
            sender:User!senderId(name)
          `)
          .in('groupId', groupIds)
          .neq('senderId', userId)
          .neq('status', 'read');
        
        // If we have a last seen time, only get messages after that time
        if (lastSeenTime) {
          groupMessageQuery = groupMessageQuery.gte('timestamp', lastSeenTime.toISOString());
        }
        
        const { data: groupMsgs, error: groupMsgError } = await groupMessageQuery;
        
        if (groupMsgError) {
          console.error('Error fetching unread group messages:', groupMsgError);
        } else if (groupMsgs) {
          groupMessages = groupMsgs;
        }
      }
      
      // Combine direct and group messages
      const messages = [...(directMessages || []), ...groupMessages];

      // Debug: Log the raw timestamp format from database
      if (messages && messages.length > 0) {
        console.log('Unread messages found:', messages.length, '(Direct:', directMessages?.length || 0, ', Group:', groupMessages.length, ')');
      } else {
        console.log('No unread messages found');
      }

      // Group messages by contact/group ID
      const unreadMessages: { [contactId: string]: Message[] } = {};
      
      messages.forEach(msg => {
        // Determine the contact ID (sender for direct messages, group ID for groups)
        const contactId = msg.groupId || msg.senderId;
        
        if (!contactId) return;
        
        if (!unreadMessages[contactId]) {
          unreadMessages[contactId] = [];
        }
        
        unreadMessages[contactId].push({
          type: 'chat' as const,
          id: msg.id,
          contactId: contactId,
          text: msg.text,
          senderId: msg.isAiMessage ? msg.aiSenderId : msg.senderId,
          senderName: msg.senderName || (msg.sender as any)?.name || 'Unknown',
          timestamp: msg.timestamp, // Keep as ISO string for consistent date handling
          status: msg.status as 'sent' | 'delivered' | 'read',
          isGroup: !!msg.groupId,
          ...(msg.attachmenturl && { 
            attachment: { 
              type: 'image' as const, 
              url: msg.attachmenturl 
            } 
          }),
          ...(msg.replyToId && {
            replyTo: {
              id: msg.replyToId,
              text: msg.replyToText || '',
              senderId: msg.replyToSenderId || '',
              senderName: msg.replyToSenderName || 'Unknown'
            }
          })
        });
      });

      return unreadMessages;
    } catch (error) {
      console.error('Error fetching unread messages:', error);
      return {};
    }
  }
}
