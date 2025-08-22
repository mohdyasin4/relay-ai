import { useCallback, useRef } from 'react';
import { MessageService } from '../services/messageService';
import type { Contact, Message, User, ReadReceipt } from '../types';
import { mqttService } from '../services/mqttService';

interface OptimizedContactSelectionProps {
  user: User | null;
  contacts: Contact[];
  messages: Record<string, Message[]>;
  unreadCounts: Record<string, number>;
  setSelectedContactId: (contactId: string | null) => void;
  setMessages: (updater: (prev: Record<string, Message[]>) => Record<string, Message[]>) => void;
  setUnreadCounts: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  setFirstUnreadMessageId: (messageId: string | null) => void;
  setUiAiStream: (stream: any) => void;
}

export function useOptimizedContactSelection({
  user,
  contacts,
  messages,
  unreadCounts,
  setSelectedContactId,
  setMessages,
  setUnreadCounts,
  setFirstUnreadMessageId,
  setUiAiStream,
}: OptimizedContactSelectionProps) {
  const loadingPromises = useRef<Map<string, Promise<void>>>(new Map());
  const lastSelectedContact = useRef<string | null>(null);

  const handleSelectContact = useCallback(async (contactId: string) => {
    if (!user) return;

    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    // Prevent duplicate selections
    if (lastSelectedContact.current === contactId) return;
    lastSelectedContact.current = contactId;
    
    // 1. IMMEDIATE UI UPDATES - NO BLOCKING
    setSelectedContactId(contactId);
    setUiAiStream(null);
    
    // Show any existing messages immediately (this provides instant feedback)
    const existingMessages = messages[contactId] || [];

    // 2. Clear unread count and set first unread message IMMEDIATELY
    const unreadCount = unreadCounts[contactId];
    if (unreadCount > 0) {
      const chatMessages = messages[contactId] || [];
      const firstUnreadIndex = chatMessages.length - unreadCount;
      if (firstUnreadIndex >= 0 && chatMessages[firstUnreadIndex]) {
        setFirstUnreadMessageId(chatMessages[firstUnreadIndex].id);
      } else {
        setFirstUnreadMessageId(null);
      }
    } else {
      setFirstUnreadMessageId(null);
    }

    // Clear unread count immediately
    setUnreadCounts(prev => {
      if (!prev[contactId]) return prev;
      const newCounts = { ...prev };
      delete newCounts[contactId];
      return newCounts;
    });

    // 3. Handle existing messages in state (mark as read) - ASYNC
    if (existingMessages.length > 0 && !contact.isAi) {
      const unreadMessages = existingMessages.filter(msg => 
        msg.senderId !== user.id && msg.status !== 'read'
      );
      
      if (unreadMessages.length > 0) {
        // Update local message statuses IMMEDIATELY
        setMessages(prev => {
          const contactMessages = prev[contactId] || [];
          const updatedMessages = contactMessages.map(msg =>
            unreadMessages.some(unread => unread.id === msg.id) 
              ? { ...msg, status: 'read' as const }
              : msg
          );
          return { ...prev, [contactId]: updatedMessages };
        });

        // Send read receipt ASYNCHRONOUSLY (don't wait)
        setTimeout(() => {
          const topic = contact.isGroup 
            ? `chat/${contactId}` 
            : `chat/${[user.id, contactId].sort().join('-')}`;
          
          const readReceipt: ReadReceipt = {
            type: 'read_receipt',
            contactId: contactId,
            readerId: user.id,
            messageIds: unreadMessages.map(m => m.id)
          };
          
          mqttService.publish(topic, readReceipt);

          // Update database status ASYNCHRONOUSLY
          Promise.all(
            unreadMessages.map(msg => 
              MessageService.updateMessageStatus(msg.id, 'read').catch(error =>
                console.error('Failed to update message status to read:', error)
              )
            )
          );
        }, 0);
      }
    }

    // 4. Load messages immediately for this chat
    console.log('Loading messages for contact:', { contactId, isGroup: !!contact.isGroup, contactType: contact.isGroup ? 'group' : 'direct' });
    await loadMessagesImmediately(contactId, !!contact.isGroup);
  }, [
    user,
    contacts,
    messages,
    unreadCounts,
    setSelectedContactId,
    setUiAiStream,
    setFirstUnreadMessageId,
    setUnreadCounts,
    setMessages,
  ]);

  // Immediate loading function for selected contact
  const loadMessagesImmediately = useCallback(async (contactId: string, isGroup: boolean) => {
    // Prevent duplicate loading requests
    const cacheKey = `${contactId}-${isGroup}`;
    if (loadingPromises.current.has(cacheKey)) {
      return loadingPromises.current.get(cacheKey);
    }

    const loadPromise = (async () => {
      try {
        // Fetch more messages for immediate display (50 for good coverage)
        console.log('Fetching messages immediately for:', { contactId, isGroup, cacheKey });
        const dbMessages = await MessageService.getMessages(contactId, isGroup, 50);
        console.log('Fetched messages immediately:', { contactId, count: dbMessages.length, isGroup });
        
        if (dbMessages.length > 0) {
          setMessages(prev => ({
            ...prev,
            [contactId]: dbMessages
          }));
        }
      } catch (error) {
        console.error('Failed to load messages immediately:', error);
      } finally {
        loadingPromises.current.delete(cacheKey);
      }
    })();

    loadingPromises.current.set(cacheKey, loadPromise);
    return loadPromise;
  }, [setMessages]);

  // Background loading functions that don't block UI
  const loadMessagesInBackground = useCallback(async (contactId: string, isGroup: boolean) => {
    // Prevent duplicate loading requests
    const cacheKey = `${contactId}-${isGroup}`;
    if (loadingPromises.current.has(cacheKey)) {
      return loadingPromises.current.get(cacheKey);
    }

    const loadPromise = (async () => {
      try {
        // Fetch newest ~50 for snappy initial paint (service sorts asc for UI)
        console.log('Fetching messages for:', { contactId, isGroup, cacheKey });
        const dbMessages = await MessageService.getMessages(contactId, isGroup, 50);
        console.log('Fetched messages:', { contactId, count: dbMessages.length, isGroup });
        
        if (dbMessages.length > 0) {
          setMessages(prev => ({
            ...prev,
            [contactId]: dbMessages
          }));
        }
      } catch (error) {
        console.error('Failed to load messages in background:', error);
      } finally {
        loadingPromises.current.delete(cacheKey);
      }
    })();

    loadingPromises.current.set(cacheKey, loadPromise);
    return loadPromise;
  }, [setMessages]);

  // Removed: older backfill handled on scroll inside ChatView

  // Cleanup function
  const cleanup = useCallback(() => {
    loadingPromises.current.clear();
    lastSelectedContact.current = null;
  }, []);

  return { handleSelectContact, cleanup };
}
