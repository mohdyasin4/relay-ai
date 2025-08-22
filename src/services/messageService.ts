
import { createClient } from '@/lib/supabase/client';
import type { Message, Contact } from '../types';
import { generateUUID } from '@/utils/uuidUtils';

export interface DatabaseMessage {
  id: string;
  text: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
  attachments?: any; // JSON field for multiple attachments
  reactions?: string[]; // Array of emoji strings
}

export class MessageService {
  // Optimized in-memory caches with LRU eviction and better TTLs
  private static messagesCache: Map<string, { data: Message[]; ts: number; hits: number }> = new Map();
  private static messagesInflight: Map<string, Promise<Message[]>> = new Map();
  private static latestPerContactsCache: Map<string, { data: Record<string, Message[]>; ts: number; hits: number }> = new Map();
  private static latestPerContactsInflight: Map<string, Promise<Record<string, Message[]>>> = new Map();
  private static unreadCache: Map<string, { data: Record<string, Message[]>; ts: number; hits: number }> = new Map();
  private static unreadInflight: Map<string, Promise<Record<string, Message[]>>> = new Map();

  private static readonly MAX_CACHE_SIZE = 50; // Limit cache size to prevent memory issues
  private static readonly DEFAULT_TTL = 30_000; // 30 seconds default TTL
  private static readonly MESSAGES_TTL = 60_000; // 1 minute for messages
  private static readonly LATEST_TTL = 45_000; // 45 seconds for latest messages

  private static isFresh(ts: number, ttlMs: number): boolean {
    return Date.now() - ts < ttlMs;
  }

  private static evictOldEntries<T extends { ts: number; hits: number }>(cache: Map<string, T>): void {
    if (cache.size <= this.MAX_CACHE_SIZE) return;
    
    // Convert to array and sort by last access time and hit count
    const entries = Array.from(cache.entries())
      .sort((a, b) => (a[1].ts - b[1].ts) || (a[1].hits - b[1].hits))
      .slice(0, cache.size - this.MAX_CACHE_SIZE + 10); // Remove extra entries
    
    entries.forEach(([key]) => cache.delete(key));
  }

  static clearCaches(): void {
    this.messagesCache.clear();
    this.latestPerContactsCache.clear();
    this.unreadCache.clear();
    // Clear inflight requests too
    this.messagesInflight.clear();
    this.latestPerContactsInflight.clear();
    this.unreadInflight.clear();
  }
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

      // Determine recipient for direct messages
      let recipientId: string | null = null;
      if (!message.isGroup) {
        if (isAiSender) {
          // For AI -> user messages, set recipient to the current authenticated user
          const { data: { session } } = await supabase.auth.getSession();
          const currentUserId = session?.user?.id;
          if (!currentUserId) {
            console.error('No authenticated user while saving AI message');
            return false;
          }
          recipientId = currentUserId;
        } else {
          // For user -> contact (human or AI), recipient is the contact thread id
          recipientId = message.contactId;
        }
      }

      const { error } = await supabase
        .from('Message')
        .insert({
          id: msgId,
          text: message.text,
          senderId: isAiSender ? null : message.senderId, // Null for AI messages
          aiSenderId: isAiSender ? message.senderId : null, // AI persona ID
          senderName: message.senderName,
          recipientId: message.isGroup ? null : recipientId,
          groupId: message.isGroup ? message.contactId : null,
          status: (isAiSender || message.isGroup === false && (message.senderId && AI_PERSONAS.some(ai => ai.id === message.contactId))) ? 'read' : (message.status || 'sent'),
          timestamp: typeof message.timestamp === 'string' 
            ? message.timestamp 
            : (message.timestamp instanceof Date 
                ? message.timestamp.toISOString() 
                : new Date().toISOString()),
          attachments: message.attachments ? JSON.stringify(message.attachments) : undefined,
          isAiMessage: isAiSender,
          // Add reply fields if message has a replyTo property
          replyToId: message.replyTo?.id || null,
          replyToText: message.replyTo?.text || null,
          replyToSenderId: message.replyTo?.senderId || null,
          replyToSenderName: message.replyTo?.senderName || null,
          // Forward metadata
          isForwarded: message.isForwarded || false,
          forwardedFromMessageId: message.forwardedFromMessageId || null,
          forwardedFromContactId: message.forwardedFromContactId || null,
          forwardedById: message.forwardedById || null,
          forwardedToContactId: message.forwardedToContactId || null,
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
    } finally {
      // Clear caches related to this message
      this.messagesCache.clear();
      this.latestPerContactsCache.clear();
      this.unreadCache.clear();
      this.messagesInflight.clear();
      this.latestPerContactsInflight.clear();
      this.unreadInflight.clear();
    }
  }

  /**
   * Get messages before a specific date (for pagination)
   */
  static async getMessagesBeforeDate(contactId: string, isGroup: boolean = false, beforeDate: Date | string, limit: number = 100): Promise<Message[]> {
    const cacheKey = `before-${contactId}-${isGroup}-${beforeDate}-${limit}`;
    const cached = this.messagesCache.get(cacheKey);
    if (cached && this.isFresh(cached.ts, this.MESSAGES_TTL)) {
      cached.hits++;
      return cached.data;
    }

    // Check if there's already an inflight request for this key
    if (this.messagesInflight.has(cacheKey)) {
      return this.messagesInflight.get(cacheKey)!;
    }

    const loadPromise = this._getMessagesBeforeDate(contactId, isGroup, beforeDate, limit);
    this.messagesInflight.set(cacheKey, loadPromise);

    try {
      const messages = await loadPromise;
      
      // Cache the result
      this.evictOldEntries(this.messagesCache);
      this.messagesCache.set(cacheKey, { data: messages, ts: Date.now(), hits: 1 });
      
      return messages;
    } finally {
      this.messagesInflight.delete(cacheKey);
    }
  }

  private static transformDatabaseMessage(msg: any): Message {
    // Detect AI messages for backward compatibility with old messages
    const senderName = msg.senderName || (msg.User as any)?.name || 'Unknown';
    const isAiMessage = msg.isAiMessage || 
                       msg.aiSenderId || 
                       senderName === 'Code Assistant' || 
                       senderName === 'AI Assistant' ||
                       senderName.includes('Assistant');
    
    // Determine the correct sender ID
    let senderId = msg.senderId;
    if (isAiMessage && msg.aiSenderId) {
      senderId = msg.aiSenderId;
    } else if (isAiMessage && !msg.aiSenderId) {
      // For old AI messages without aiSenderId, use a fallback
      senderId = 'code-assistant'; // Default AI persona ID
    }

    return {
      type: 'chat' as const,
      id: msg.id,
      contactId: msg.groupId || msg.recipientId || '',
      text: msg.text,
      senderId: senderId,
      senderName: senderName,
      timestamp: msg.timestamp,
      status: msg.status as 'sent' | 'delivered' | 'read',
      isGroup: !!msg.groupId,
      isForwarded: !!msg.isForwarded,
      forwardedFromMessageId: msg.forwardedFromMessageId || undefined,
      forwardedFromContactId: msg.forwardedFromContactId || undefined,
      forwardedById: msg.forwardedById || undefined,
      forwardedToContactId: msg.forwardedToContactId || undefined,
      reactions: msg.reactions || [],
      // Parse attachments JSON string and handle multiple attachments
      ...(msg.attachments && (() => {
        try {
          const parsedAttachments = typeof msg.attachments === 'string' 
            ? JSON.parse(msg.attachments) 
            : msg.attachments;
          
          if (Array.isArray(parsedAttachments) && parsedAttachments.length > 0) {
            return {
              attachments: parsedAttachments.map(att => ({
                type: att.type || 'image',
                url: att.url,
                fileName: att.fileName,
                fileSize: att.fileSize,
                mimeType: att.mimeType
              })),
              // Handle legacy single attachment (for backward compatibility)
              ...(parsedAttachments.length === 1 && {
                attachment: {
                  type: parsedAttachments[0].type || 'image',
                  url: parsedAttachments[0].url,
                  fileName: parsedAttachments[0].fileName,
                  fileSize: parsedAttachments[0].fileSize,
                  mimeType: parsedAttachments[0].mimeType
                }
              })
            };
          }
        } catch (error) {
          console.error('Error parsing attachments JSON:', error);
        }
        return {};
      })()),
      ...(msg.replyToId && {
        replyTo: {
          id: msg.replyToId,
          text: msg.replyToText || '',
          senderId: msg.replyToSenderId || '',
          senderName: msg.replyToSenderName || 'Unknown'
        }
      })
    };
  }

  private static async _getMessagesBeforeDate(contactId: string, isGroup: boolean, beforeDate: Date | string, limit: number): Promise<Message[]> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData?.user) return [];

    const beforeTimestamp = typeof beforeDate === 'string' ? beforeDate : beforeDate.toISOString();

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
          attachments,
          isAiMessage,
          replyToId,
          replyToText,
          replyToSenderId,
          replyToSenderName,
          isForwarded,
          forwardedFromMessageId,
          forwardedFromContactId,
          forwardedById,
          forwardedToContactId,
          reactions:Reaction(id, userId, emoji),
          User!senderId(id, name, avatarUrl)
        `)
        .lt('timestamp', beforeTimestamp)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (isGroup) {
        query = query.eq('groupId', contactId);
      } else {
        query = query.or(`and(senderId.eq.${authData.user.id},recipientId.eq.${contactId}),and(senderId.eq.${contactId},recipientId.eq.${authData.user.id})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const messages = (data || []).map(this.transformDatabaseMessage).reverse(); // Reverse to get chronological order
      return messages;
    } catch (error) {
      console.error('Error fetching messages before date:', error);
      return [];
    }
  }

  /**
   * Get messages between two users or in a group
   */
  static async getMessages(contactId: string, isGroup: boolean = false, limit: number = 100): Promise<Message[]> {
    const supabase = createClient();
  
  try {
      // Build cache key
      let currentUserId: string | undefined = undefined;
      if (!isGroup) {
        const { data: { session } } = await supabase.auth.getSession();
        currentUserId = session?.user?.id || undefined;
        if (!currentUserId) {
          console.error('No authenticated user');
          return [];
        }
      }
      const cacheKey = `${isGroup ? 'group' : 'dm'}:${currentUserId || 'na'}:${contactId}:${limit}`;

      // Use cached value if fresh with optimized TTL
      const cached = this.messagesCache.get(cacheKey);
      if (cached && this.isFresh(cached.ts, this.MESSAGES_TTL)) {
        cached.hits += 1; // Track cache hits for better eviction
        return cached.data;
      }
      const inflight = this.messagesInflight.get(cacheKey);
      if (inflight) return inflight;

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
        attachments,
        isAiMessage,
        isForwarded,
        forwardedFromMessageId,
        forwardedFromContactId,
        forwardedById,
        forwardedToContactId,
        replyToId,
        replyToText,
        replyToSenderId,
        replyToSenderName,
        sender:User!senderId(name, avatarUrl)
      `)
      // Fetch newest first for fast initial view, we'll sort ascending after mapping
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (isGroup) {
      // For group messages, filter by groupId
      query = query.eq('groupId', contactId);
    } else {
      // For direct messages, we want messages where:
      // 1. Current user sent to contactId (senderId = currentUserId AND recipientId = contactId)
      // 2. ContactId sent to current user (senderId = contactId AND recipientId = currentUserId)
      // 3. AI sent to current user (aiSenderId = contactId AND recipientId = currentUserId)
      // 4. Current user sent to AI assistant (senderId = currentUserId AND aiSenderId = contactId)
      // Use .or() for the OR condition
      query = query.is('groupId', null)
        .or(`and(senderId.eq.${currentUserId},recipientId.eq.${contactId}),and(senderId.eq.${contactId},recipientId.eq.${currentUserId}),and(aiSenderId.eq.${contactId},recipientId.eq.${currentUserId}),and(senderId.eq.${currentUserId},aiSenderId.eq.${contactId})`);
    }

    // We intentionally limit above for faster initial loads; older messages are fetched on scroll
    
    const pending = (async (): Promise<Message[]> => {
      try {
        const { data: messages, error } = await query;
        if (error) {
          console.error('Error fetching messages:', error);
          return [] as Message[];
        }
        if (!messages || messages.length === 0) {
        this.evictOldEntries(this.messagesCache);
        this.messagesCache.set(cacheKey, { data: [], ts: Date.now(), hits: 1 });
        return [] as Message[];
        }

        // Fetch reactions for all messages
        const messageIds = messages.map((msg: any) => msg.id);
        const { data: reactions } = await supabase
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

        // Compute correct thread contact id for DMs (the other participant), or group id for groups
        const resolveThreadContactId = (msg: any): string => {
          if (msg.groupId) return msg.groupId;
          if (currentUserId) {
            if (msg.recipientId === currentUserId) return msg.senderId || msg.aiSenderId || '';
            if (msg.senderId === currentUserId) return msg.recipientId || msg.aiSenderId || '';
          }
          // Fallbacks (should rarely hit)
          return (msg.senderId && msg.senderId !== currentUserId)
            ? msg.senderId
            : (msg.recipientId && msg.recipientId !== currentUserId ? msg.recipientId : (msg.aiSenderId || ''));
        };

        const mapped: Message[] = messages.map((msg: any) => ({
          type: 'chat' as const,
          id: msg.id,
          contactId: resolveThreadContactId(msg),
          text: msg.text,
          senderId: msg.isAiMessage ? msg.aiSenderId : msg.senderId,
          senderName: msg.senderName || (msg.sender as any)?.name || 'Unknown',
          timestamp: msg.timestamp,
          status: msg.status as 'sent' | 'delivered' | 'read',
          isGroup: !!msg.groupId,
          isForwarded: !!(msg as any).isForwarded,
          forwardedFromMessageId: (msg as any).forwardedFromMessageId || undefined,
          forwardedFromContactId: (msg as any).forwardedFromContactId || undefined,
          forwardedById: (msg as any).forwardedById || undefined,
          forwardedToContactId: (msg as any).forwardedToContactId || undefined,
          reactions: reactionsByMessageId[msg.id] || [],
          // Parse attachments JSON string and handle multiple attachments
          ...(msg.attachments && (() => {
            try {
              const parsedAttachments = typeof msg.attachments === 'string' 
                ? JSON.parse(msg.attachments) 
                : msg.attachments;
              
              if (Array.isArray(parsedAttachments) && parsedAttachments.length > 0) {
                return {
                  attachments: parsedAttachments.map(att => ({
                    type: att.type || 'image',
                    url: att.url,
                    fileName: att.fileName,
                    fileSize: att.fileSize,
                    mimeType: att.mimeType
                  })),
                  // Handle legacy single attachment (for backward compatibility)
                  ...(parsedAttachments.length === 1 && {
                    attachment: {
                      type: parsedAttachments[0].type || 'image',
                      url: parsedAttachments[0].url,
                      fileName: parsedAttachments[0].fileName,
                      fileSize: parsedAttachments[0].fileSize,
                      mimeType: parsedAttachments[0].mimeType
                    }
                  })
                };
              }
            } catch (error) {
              console.error('Error parsing attachments JSON:', error);
            }
            return {};
          })()),
          ...(msg.replyToId && {
            replyTo: {
              id: msg.replyToId,
              text: msg.replyToText || '',
              senderId: msg.replyToSenderId || '',
              senderName: msg.replyToSenderName || 'Unknown'
            }
          })
        }));
        // Sort ascending for UI after fetching newest-first
        mapped.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        this.evictOldEntries(this.messagesCache);
        this.messagesCache.set(cacheKey, { data: mapped, ts: Date.now(), hits: 1 });
        return mapped;
      } finally {
        this.messagesInflight.delete(cacheKey);
      }
    })();
    this.messagesInflight.set(cacheKey, pending);
    return pending;
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
    file: File,
    chatId?: string
  ): Promise<boolean> {
    try {
      // Import the StorageService
      const { StorageService } = await import('./storageService');
      
      // Upload the file to get its URL using the new StorageService
      const uploadResult = await StorageService.uploadFile(file, message.senderId, chatId);
      
      // Determine attachment type based on file MIME type
      let type: 'image' | 'document' | 'audio' | 'video';
      if (file.type.startsWith('image/')) {
        type = 'image';
      } else if (file.type.startsWith('video/')) {
        type = 'video';
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
      } else {
        type = 'document';
      }
      
      // Create a new message with the attachment URL
      const messageWithAttachment: Message = {
        ...message,
        attachment: {
          type,
          url: uploadResult.url,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType
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
   * Save a message with multiple attachments
   * This will upload all attachments first, then save the message with attachment URLs
   */
  static async saveMessageWithAttachments(
    message: Message, 
    files: File[],
    chatId?: string
  ): Promise<boolean> {
    try {
      // Import the StorageService
      const { StorageService } = await import('./storageService');
      
      // Upload all files to get their URLs
      const uploadResults = await StorageService.uploadMultipleFiles(files, message.senderId, chatId);
      
      // Convert upload results to attachments
      const attachments = uploadResults.map(result => {
        let type: 'image' | 'document' | 'audio' | 'video';
        if (result.mimeType.startsWith('image/')) {
          type = 'image';
        } else if (result.mimeType.startsWith('video/')) {
          type = 'video';
        } else if (result.mimeType.startsWith('audio/')) {
          type = 'audio';
        } else {
          type = 'document';
        }
        
        return {
          type,
          url: result.url,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType
        };
      });
      
      // Create a new message with all attachments
      const messageWithAttachments: Message = {
        ...message,
        attachments
      };
      
      // Save the message with all attachment URLs
      return await this.saveMessage(messageWithAttachments);
    } catch (error) {
      console.error('Error saving message with attachments:', error);
      return false;
    }
  }

  /**
   * Delete a message and its attachment if any
   */
  static async deleteMessage(messageId: string): Promise<boolean> {
    const supabase = createClient();
    
    try {
      // First, get the message to check if it has attachments
      const { data: message, error: fetchError } = await supabase
        .from('Message')
        .select('attachments')
        .eq('id', messageId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching message for deletion:', fetchError);
        return false;
      }
      
      // If there are attachments, delete them from storage
      if (message?.attachments && Array.isArray(message.attachments)) {
        try {
          // Import the StorageService to delete attachments
          const { StorageService } = await import('./storageService');
          
          // Delete each attachment
          for (const attachment of message.attachments) {
            if (attachment.url) {
              try {
                await StorageService.deleteFile(attachment.url);
              } catch (deleteError) {
                console.error('Error deleting attachment from storage:', deleteError);
                // Continue with other attachments even if one fails
              }
            }
          }
        } catch (storageError) {
          console.error('Error deleting attachments:', storageError);
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
  static async getUnreadMessages(userId: string, lastSeenISO?: string): Promise<{ [contactId: string]: Message[] }> {
    const supabase = createClient();
    
    try {
      const cacheKey = `unread:${userId}:${lastSeenISO || 'none'}`;
      const cached = this.unreadCache.get(cacheKey);
      if (cached && this.isFresh(cached.ts, this.DEFAULT_TTL)) {
        cached.hits += 1;
        return cached.data;
      }
      const inflight = this.unreadInflight.get(cacheKey);
      if (inflight) return await inflight;
      const promise = (async (): Promise<Record<string, Message[]>> => {
        try {
        // Use the provided lastSeen value if available to avoid redundant API calls
        const lastSeenTime = lastSeenISO ? new Date(lastSeenISO) : null;
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
          attachments,
          isAiMessage,
          sender:User!senderId(name, avatarUrl)
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
            attachments,
                      isAiMessage,
          sender:User!senderId(name, avatarUrl)
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
          // Parse attachments JSON string and handle multiple attachments
          ...(msg.attachments && (() => {
            try {
              const parsedAttachments = typeof msg.attachments === 'string' 
                ? JSON.parse(msg.attachments) 
                : msg.attachments;
              
              if (Array.isArray(parsedAttachments) && parsedAttachments.length > 0) {
                return {
                  attachments: parsedAttachments.map(att => ({
                    type: att.type || 'image',
                    url: att.url,
                    fileName: att.fileName,
                    fileSize: att.fileSize,
                    mimeType: att.mimeType
                  })),
                  // Handle legacy single attachment (for backward compatibility)
                  ...(parsedAttachments.length === 1 && {
                    attachment: {
                      type: parsedAttachments[0].type || 'image',
                      url: parsedAttachments[0].url,
                      fileName: parsedAttachments[0].fileName,
                      fileSize: parsedAttachments[0].fileSize,
                      mimeType: parsedAttachments[0].mimeType
                    }
                  })
                };
              }
            } catch (error) {
              console.error('Error parsing attachments JSON:', error);
            }
            return {};
          })()),
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

          this.evictOldEntries(this.unreadCache);
          this.unreadCache.set(cacheKey, { data: unreadMessages, ts: Date.now(), hits: 1 });
          return unreadMessages;
        } catch (error) {
          console.error('Error fetching unread messages:', error);
          return {} as Record<string, Message[]>;
        }
      })();
      try {
        this.unreadInflight.set(cacheKey, promise);
        const result = await promise;
        return result;
      } finally {
        this.unreadInflight.delete(cacheKey);
      }
    } catch (error) {
      console.error('Error in getUnreadMessages wrapper:', error);
      return {} as Record<string, Message[]>;
    }
  }

  /**
   * Fetch the latest message per contact (DMs and groups) to prime conversation list sorting.
   * This avoids fetching full histories on initial load.
   */
  static async getLatestMessagesForContacts(
    userId: string,
    contacts: Contact[],
    perContactLimit: number = 1,
    options?: { sinceDays?: number }
  ): Promise<Record<string, Message[]>> {
    const supabase = createClient();
    try {
      const cacheKey = `latest:${userId}:${contacts.length}:${perContactLimit}`;
      const cached = this.latestPerContactsCache.get(cacheKey);
      if (cached && this.isFresh(cached.ts, this.LATEST_TTL)) {
        cached.hits += 1;
        return cached.data;
      }
      const inflight = this.latestPerContactsInflight.get(cacheKey);
      if (inflight) return inflight;

      const directContactIds = contacts
        .filter(c => !c.isGroup)
        .map(c => c.id);
      const groupIds = contacts.filter(c => c.isGroup).map(c => c.id);

      const results: Message[] = [];
      const sinceIso = (() => {
        const days = options?.sinceDays ?? 90;
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString();
      })();

      // Fetch latest direct messages in a single query using OR with IN lists
      if (directContactIds.length > 0) {
        const idList = directContactIds.join(',');
        // Build OR conditions:
        // 1) senderId = userId AND recipientId IN (contacts)
        // 2) senderId IN (contacts) AND recipientId = userId
        // 3) aiSenderId IN (contacts) AND recipientId = userId
        const orClause = [
          `and(senderId.eq.${userId},recipientId.in.(${idList}))`,
          `and(senderId.in.(${idList}),recipientId.eq.${userId})`,
          `and(aiSenderId.in.(${idList}),recipientId.eq.${userId})`,
          `and(senderId.eq.${userId},aiSenderId.in.(${idList}))`
        ].join(',');

        let directQuery = supabase
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
            attachments,
            isAiMessage,
            isForwarded,
            forwardedFromMessageId,
            forwardedFromContactId,
            forwardedById,
            forwardedToContactId,
            replyToId,
            replyToText,
            replyToSenderId,
            replyToSenderName
          `)
          .is('groupId', null)
          .or(orClause)
          .gte('timestamp', sinceIso)
          .order('timestamp', { ascending: false })
          .limit(Math.max(50, perContactLimit * directContactIds.length * 2));

        const { data, error } = await directQuery;

        if (error) {
          console.error('Error fetching latest direct messages:', error);
        } else if (data) {
          results.push(
            ...data.map(msg => ({
              type: 'chat' as const,
              id: msg.id,
              contactId: (msg.senderId && msg.senderId !== userId) ? msg.senderId : (msg.recipientId && msg.recipientId !== userId ? msg.recipientId : (msg.aiSenderId || '')),
              text: msg.text,
              senderId: msg.isAiMessage ? msg.aiSenderId : msg.senderId,
              senderName: msg.senderName || 'Unknown',
              timestamp: msg.timestamp,
              status: msg.status as 'sent' | 'delivered' | 'read',
              isGroup: false,
              isForwarded: !!(msg as any).isForwarded,
              forwardedFromMessageId: (msg as any).forwardedFromMessageId || undefined,
              forwardedFromContactId: (msg as any).forwardedFromContactId || undefined,
              forwardedById: (msg as any).forwardedById || undefined,
              forwardedToContactId: (msg as any).forwardedToContactId || undefined,
              // Handle legacy single attachment (for backward compatibility)
              ...(msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length === 1 && {
                attachment: {
                  type: msg.attachments[0].type || 'image',
                  url: msg.attachments[0].url,
                  fileName: msg.attachments[0].fileName,
                  fileSize: msg.attachments[0].fileSize,
                  mimeType: msg.attachments[0].mimeType
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
            }))
          );
        }
      }

      // Fetch latest group messages
      if (groupIds.length > 0) {
        let groupQuery = supabase
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
            attachments,
            isAiMessage,
            isForwarded,
            forwardedFromMessageId,
            forwardedFromContactId,
            forwardedById,
            forwardedToContactId,
            replyToId,
            replyToText,
            replyToSenderId,
            replyToSenderName
          `)
          .in('groupId', groupIds)
          .gte('timestamp', sinceIso)
          .order('timestamp', { ascending: false })
          .limit(Math.max(50, perContactLimit * groupIds.length * 2));

        const { data, error } = await groupQuery;

        if (error) {
          console.error('Error fetching latest group messages:', error);
        } else if (data) {
          results.push(
            ...data.map(msg => ({
              type: 'chat' as const,
              id: msg.id,
              contactId: msg.groupId || '',
              text: msg.text,
              senderId: msg.isAiMessage ? msg.aiSenderId : msg.senderId,
              senderName: msg.senderName || 'Unknown',
              timestamp: msg.timestamp,
              status: msg.status as 'sent' | 'delivered' | 'read',
              isGroup: true,
              isForwarded: !!(msg as any).isForwarded,
              forwardedFromMessageId: (msg as any).forwardedFromMessageId || undefined,
              forwardedFromContactId: (msg as any).forwardedFromContactId || undefined,
              forwardedById: (msg as any).forwardedById || undefined,
              forwardedToContactId: (msg as any).forwardedToContactId || undefined,
              // Handle legacy single attachment (for backward compatibility)
              ...(msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length === 1 && {
                attachment: {
                  type: msg.attachments[0].type || 'image',
                  url: msg.attachments[0].url,
                  fileName: msg.attachments[0].fileName,
                  fileSize: msg.attachments[0].fileSize,
                  mimeType: msg.attachments[0].mimeType
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
            }))
          );
        }
      }

      // Reduce to latest per contact
      const latestByContact: Record<string, Message[]> = {};
      const seen = new Set<string>();

      // Sort all results descending by timestamp to pick newest first
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      for (const msg of results) {
        const key = msg.contactId;
        if (!key || seen.has(key)) continue;
        latestByContact[key] = [msg];
        seen.add(key);
        if (seen.size >= contacts.length) break;
      }

      // Ensure ascending order within each contact bucket
      Object.values(latestByContact).forEach(arr => arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));

      this.evictOldEntries(this.latestPerContactsCache);
      this.latestPerContactsCache.set(cacheKey, { data: latestByContact, ts: Date.now(), hits: 1 });
      return latestByContact;
    } catch (error) {
      console.error('Error fetching latest messages for contacts:', error);
      return {};
    }
  }

  /**
   * Mark a message as read in the database
   */
  static async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('Message')
        .update({ status: 'read' })
        .eq('id', messageId);

      if (error) {
        console.error('Error marking message as read:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }
}
