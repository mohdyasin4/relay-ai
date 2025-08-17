import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
// import { DatabaseService } from './services/databaseService';
import { useSelectedContactWithLastSeen } from './hooks/useSelectedContactWithLastSeen';
import { useOptimizedContactSelection } from './hooks/useOptimizedContactSelection';
import AppSidebar from './components/AppSidebar';
import MobileSidebar from './components/MobileSidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import ChatView from './components/ChatView';
import SettingsModal from './components/SettingsModal';
// import NewGroupModal from './components/NewGroupModal';
import NewChatDialog from './components/NewChatDialog';
import EditGroupModal from './components/EditGroupModal';
import Lightbox from './components/Lightbox';
import ForwardMessageModal from './components/ForwardMessageModal';
import InviteUserModal from './components/InviteUserModal';
import FriendRequestsModal from './components/FriendRequestsModal';
// import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { generateUUID } from './utils/uuidUtils';
import { sendMessageToBot } from './services/geminiService';
import { FriendsService } from './services/friendsService';
import { MessageService } from './services/messageService';
import { GroupService } from './services/groupService';
import { databaseClient } from './services/databaseClient';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAuth } from './contexts/AuthContext';
import type { Contact, Message, MessagesState, User, Attachment, MqttPayload, Invitation, ReadReceipt, DeliveryReceipt, TypingIndicatorPayload, ReactionPayload, FriendRequest, FriendRequestProcessed } from './types';
import { AI_PERSONAS } from './constants';
import { mqttService } from './services/mqttService';
// UI-only imports removed (unused)
import { AnimatePresence, motion } from 'motion/react';
// import { cn } from './lib/utils';

const App: React.FC = () => {
  if (import.meta.env?.MODE === 'development') {
    console.log('App component rendering');
  }
  const { user: authUser, logout } = useAuth(); // Access authenticated user and logout from AuthContext
  if (import.meta.env?.MODE === 'development') {
    console.log('Auth user from context:', authUser);
  }
  const [user, setUser] = useState<User | null>(authUser); // Initialize with auth user
  // const { theme } = useTheme();

  // Persistent sidebar width in px
  // Use default width unless user has resized
  // Desktop sidebar width (resizable)
  const DEFAULT_SIDEBAR_WIDTH = 320;
  const [sidebarWidth, setSidebarWidth] = useLocalStorage<number>('sidebarWidth', DEFAULT_SIDEBAR_WIDTH);
  const resizingRef = useRef<boolean>(false);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const newWidth = Math.min(Math.max(e.clientX, 220), 600);
      setSidebarWidth(newWidth);
    };
    const onUp = () => { resizingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [setSidebarWidth]);
  // Avoid local MQTT status state to prevent re-renders; use mqttService.isConnected()

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagesState>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isContactsLoading, setIsContactsLoading] = useState<boolean>(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [typingIndicators, setTypingIndicators] = useState<Record<string, Record<string, string>>>({});
  
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);
  
  // UI stream state for streaming AI typewriter in ChatView
  const [uiAiStream, setUiAiStream] = useState<{ contactId: string; messageId: string; text?: string; stream?: AsyncIterable<string> } | null>(null);

  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [, setNewGroupOpen] = useState(false);
  const [isNewChatOpen, setNewChatOpen] = useState(false);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [isFriendRequestsOpen, setFriendRequestsOpen] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<number>(0);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isUserActive, setIsUserActive] = useState(true);

  const [editingGroup, setEditingGroup] = useState<Contact | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  
  // const isResizing = useRef(false);

  // --- Start of Quote Bot Proactive Messaging ---
  const contactsRef = useRef(contacts);
  const userRef = useRef(user);
  const setMessagesRef = useRef(setMessages);
  const selectedContactIdRef = useRef(selectedContactId);
  const setUnreadCountsRef = useRef(setUnreadCounts);

  useEffect(() => {
    contactsRef.current = contacts;
    userRef.current = user;
    setMessagesRef.current = setMessages;
    selectedContactIdRef.current = selectedContactId;
    setUnreadCountsRef.current = setUnreadCounts;
  });

  useEffect(() => {
    const fetchAndAddQuote = async () => {
        const quoteBotId = 'daily-quotes-assistant';
        const currentContacts = contactsRef.current;
        const currentUser = userRef.current;
        const currentSetMessages = setMessagesRef.current;
        const currentSelectedContactId = selectedContactIdRef.current;
        const currentSetUnreadCounts = setUnreadCountsRef.current;

        const quoteBot = currentContacts.find(c => c.id === quoteBotId);

        if (!quoteBot || !currentUser) {
            return;
        }

        try {
            const dummyApiMessage: Message = {
                type: 'chat',
                id: `quote-request-${generateUUID()}`,
                contactId: quoteBot.id,
                text: "Give me another inspirational quote.",
                senderId: currentUser.id,
                senderName: currentUser.name,
                timestamp: new Date(),
            };

            const stream = await sendMessageToBot(quoteBot, dummyApiMessage);

            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk.text;
            }

            if (fullResponse.trim()) {
                const newQuoteMessage: Message = {
                    type: 'chat',
                    id: generateUUID(),
                    contactId: quoteBot.id,
                    text: fullResponse.trim(),
                    senderId: quoteBot.id,
                    senderName: quoteBot.name,
                    timestamp: new Date(),
                };

                // Save quote message to database
                try {
                    await MessageService.saveMessage(newQuoteMessage);
                    if (import.meta.env?.MODE === 'development') console.log('Quote message saved to database');
                } catch (error) {
                    console.error('Failed to save quote message to database:', error);
                }

                currentSetMessages(prevMessages => {
                    const chatHistory = prevMessages[quoteBot.id] || [];
                    if (chatHistory.some(m => m.text === newQuoteMessage.text)) {
                        return prevMessages;
                    }
                    return {
                        ...prevMessages,
                        [quoteBot.id]: [...chatHistory, newQuoteMessage],
                    };
                });
                
                if (quoteBotId !== currentSelectedContactId) {
                    currentSetUnreadCounts(prev => ({
                        ...prev,
                        [quoteBotId]: (prev[quoteBotId] || 0) + 1,
                    }));
                }
            }
        } catch (error) {
            console.error("Error fetching automatic quote:", error);
        }
    };

    const intervalId = setInterval(fetchAndAddQuote, 120000); // 2 minutes

    return () => clearInterval(intervalId);
  }, []);
  // --- End of Quote Bot Proactive Messaging ---

  // Sync user from auth context
  useEffect(() => {
    if (authUser) {
      console.log('Updating user profile from auth context:', authUser);
      // Create a new user object with the correct type
      const updatedUser: User = {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        avatarUrl: authUser.avatar,
        status: (authUser as any).status || 'online'
      };
      setUser(updatedUser);

      // Ensure MQTT disconnect on tab close/unload for reliable offline status
      const handleUnload = () => {
        try { mqttService.disconnect(); } catch {}
      };
      window.addEventListener('beforeunload', handleUnload);
      window.addEventListener('unload', handleUnload);

              // Handle tab inactivity (visibilitychange) with delay
        let visibilityTimeout: NodeJS.Timeout | null = null;
        const handleVisibilityChange = () => {
          if (document.hidden) {
            // User switched to another tab or minimized browser
            // Wait 30 seconds before marking offline to avoid flicker
            console.log('[App] Tab hidden, will mark offline in 30 seconds if still hidden');
            setIsUserActive(false);
            visibilityTimeout = setTimeout(() => {
              if (document.hidden && authUser) {
                console.log('[App] Tab still hidden after 30s, setting user status to offline');
                mqttService.publish(`user/${authUser.id}/status`, {
                  status: 'offline',
                  timestamp: new Date().toISOString()
                });
                // Update database status
                databaseClient.updateUserStatus(authUser.id, 'offline').catch((error: Error) =>
                  console.error('Failed to update user status in database:', error)
                );
              }
            }, 30000); // 30 seconds delay
          } else {
            // User returned to the tab
            console.log('[App] Tab visible, setting user status to online');
            if (visibilityTimeout) {
              clearTimeout(visibilityTimeout);
              visibilityTimeout = null;
            }
            setIsUserActive(true);
            setLastActivity(Date.now());
            if (authUser) {
              mqttService.publish(`user/${authUser.id}/status`, {
                status: 'online',
                timestamp: new Date().toISOString()
              });
              // Update database status
              databaseClient.updateUserStatus(authUser.id, 'online').catch((error: Error) =>
                console.error('Failed to update user status in database:', error)
              );
            }
          }
        };
                document.addEventListener('visibilitychange', handleVisibilityChange);

        // Track user activity to maintain online status (without publishing every time)
        const handleUserActivity = () => {
          if (isUserActive && authUser) {
            setLastActivity(Date.now());
            // Don't publish on every activity - MQTT heartbeat handles this
          }
        };

        // Add activity listeners
        document.addEventListener('mousedown', handleUserActivity);
        document.addEventListener('keydown', handleUserActivity);
        document.addEventListener('scroll', handleUserActivity);
        document.addEventListener('touchstart', handleUserActivity);

                return () => {
          window.removeEventListener('beforeunload', handleUnload);
          window.removeEventListener('unload', handleUnload);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          document.removeEventListener('mousedown', handleUserActivity);
          document.removeEventListener('keydown', handleUserActivity);
          document.removeEventListener('scroll', handleUserActivity);
          document.removeEventListener('touchstart', handleUserActivity);
          // Clean up visibility timeout
          if (visibilityTimeout) {
            clearTimeout(visibilityTimeout);
          }
        };
    }
  }, [authUser, setUser]);

  // Inactivity timer to set status to offline after 5 minutes of no activity
  useEffect(() => {
    if (!authUser || !isUserActive) return;

    const inactivityTimeout = setTimeout(() => {
      console.log('[App] User inactive for 5 minutes, setting status to offline');
      setIsUserActive(false);
      mqttService.publish(`user/${authUser.id}/status`, {
        status: 'offline',
        timestamp: new Date().toISOString()
      });
      // Update database status
      databaseClient.updateUserStatus(authUser.id, 'offline').catch((error: Error) =>
        console.error('Failed to update user status in database:', error)
      );
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearTimeout(inactivityTimeout);
  }, [authUser, isUserActive, lastActivity]);

  // On initial app load, fetch last 50 messages for each contact
  // REMOVED: This was causing delays and blocking the UI
  // Messages are now loaded on-demand when contacts are selected

  const loadContactsFromDatabase = useCallback(async () => {
    if (!user) return;
    
    console.log('Loading contacts from database for user:', user.id);
    try {
      setIsContactsLoading(true);
      setContactsError(null);
      
      // Load all contacts from database (including AI assistants)
      const allContacts = await FriendsService.getContacts(user.id);
      console.log('Contacts loaded from database:', allContacts);
      
      // Set contacts immediately for instant UI feedback
      setContacts(allContacts);
      setIsContactsLoading(false);
      
      // Subscribe to MQTT topics for new contacts asynchronously
      setTimeout(() => {
        allContacts.forEach(contact => {
          if (!contact.isAi) {
            const topic = contact.isGroup ? `chat/${contact.id}` : (contact.topicId || `chat/${[user.id, contact.id].sort().join('-')}`);
            mqttService.subscribe(topic);
            console.log(`Subscribed to topic for contact ${contact.name}: ${topic}`);
          }
        });
      }, 0);
      
      // Prime latest messages asynchronously
      setTimeout(async () => {
        try {
          const latest = await MessageService.getLatestMessagesForContacts(user.id, allContacts, 1, { sinceDays: 90 });
          setMessages(prev => {
            const next = { ...prev };
            for (const cid of Object.keys(latest)) {
              const existing = next[cid] || [];
              const incoming = latest[cid] || [];
              const existingIds = new Set(existing.map(m => m.id));
              const unique = incoming.filter(m => !existingIds.has(m.id));
              if (unique.length > 0) {
                next[cid] = [...existing, ...unique].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              }
            }
            return next;
          });
        } catch (e) {
          console.error('Priming latest messages failed (non-blocking):', e);
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to load contacts from database:', error);
      // Fallback to empty contacts on error
      setContacts([]);
      setContactsError('Failed to load contacts. Please try again.');
      setIsContactsLoading(false);
    }
  }, [user]);

  // Load contacts from database when user changes
  useEffect(() => {
    if (user) {
      loadContactsFromDatabase();
      // Load initial friend requests count
      loadPendingFriendRequests();
      
      // Realtime subscription for friend requests
      mqttService.subscribe(`user/${user.id}`);
      const listener = (payload: any, topic: string) => {
        if (topic === `user/${user.id}` && payload?.type === 'friend_request_accepted') {
          // Reduce pending when a sent request gets accepted
          setPendingFriendRequests(prev => Math.max(0, prev - 1));
        }
        if (topic === `user/${user.id}` && payload?.type === 'friend_request') {
          // Increase pending on incoming request
          setPendingFriendRequests(prev => prev + 1);
        }
      };
      mqttService.addListener(listener);
      return () => {
        try { mqttService.unsubscribe(`user/${user.id}`); } catch {}
        try { mqttService.removeListener(listener); } catch {}
      };
    }
  }, [user, loadContactsFromDatabase]);

  const processQueuedMessages = useCallback(async () => {
    if (!user) return;
    
    if (import.meta.env?.MODE === 'development') console.log('Processing queued messages...');
    
    // Find all queued messages in current messages state
    const queuedMessageIds: string[] = [];
    Object.values(messages).forEach(contactMessages => {
      contactMessages.forEach(message => {
        if (message.status === 'queued' && message.senderId === user.id) {
          queuedMessageIds.push(message.id);
        }
      });
    });
    
    if (queuedMessageIds.length > 0) {
      console.log(`Found ${queuedMessageIds.length} queued messages to send`);
      
      // Update all queued messages to 'sent' status
      for (const messageId of queuedMessageIds) {
        try {
          await MessageService.updateMessageStatus(messageId, 'sent');
        } catch (error) {
          console.error('Failed to update queued message status:', messageId, error);
        }
      }
      
      // Update local state
      setMessages(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(contactId => {
          updated[contactId] = updated[contactId].map(msg => 
            msg.status === 'queued' && msg.senderId === user.id 
              ? { ...msg, status: 'sent' as const }
              : msg
          );
        });
        return updated;
      });
      
      console.log('Queued messages processed successfully');
    }
  }, [user, messages]);

  const handleMqttPayload = useCallback(async (payload: MqttPayload, topic: string) => {
    if (import.meta.env?.MODE === 'development') console.log('Received MQTT Payload:', payload, 'on topic:', topic);

    // Handle user status updates
    if (topic.includes('/status') && (payload as any).status) {
      const userId = topic.split('/')[1]; // Extract user ID from topic like "user/123/status"
      const statusPayload = payload as unknown as { status: 'online' | 'offline' | 'away'; timestamp?: string };
      if (userId && userId !== user?.id) {
        setContacts(prevContacts => {
          const contact = prevContacts.find(c => c.id === userId);
          if (contact && !contact.isAi) {
            return prevContacts.map(c => 
              c.id === userId ? { 
                ...c, 
                status: statusPayload.status,
                lastSeen: statusPayload.status === 'offline' ? new Date().toISOString() : c.lastSeen
              } : c
            );
          }
          return prevContacts;
        });
      }
      return; // Don't process status updates as regular messages
    }

    // --- Unified Presence Update ---
    const getSenderId = (p: MqttPayload): string | undefined => {
        if (p.type === 'chat') return (p as Message).senderId;
        if (p.type === 'typing') return (p as TypingIndicatorPayload).userId;
        if (p.type === 'read_receipt') return (p as ReadReceipt).readerId;
        if (p.type === 'delivery_receipt') return (p as DeliveryReceipt).readerId;
        if (p.type === 'reaction') return (p as ReactionPayload).reactorId;
        return undefined;
    };

    const senderId = getSenderId(payload);
    if (senderId && user && senderId !== user.id) {
        setContacts(prevContacts => {
            const contact = prevContacts.find(c => c.id === senderId);
            // Only update if contact exists and status is not already online.
            if (contact && contact.status !== 'online') {
                return prevContacts.map(c => 
                    c.id === senderId ? { ...c, status: 'online', lastSeen: new Date().toISOString() } : c
                );
            }
            return prevContacts;
        });
    }

    if (payload.type === 'invitation') {
      const { contact: newContact, topic: chatTopic } = payload as Invitation;
      setContacts(prevContacts => {
        if (!prevContacts.some(c => c.id === newContact.id)) {
          mqttService.subscribe(chatTopic);
          console.log(`Accepted invitation from ${newContact.name} and subscribed to ${chatTopic}`);
          // When we receive an invitation, the sender is online.
          const contactWithStatus = { ...newContact, status: 'online' as const, lastSeen: new Date().toISOString() };
          return [contactWithStatus, ...prevContacts];
        }
        return prevContacts;
      });
    }
    else if (payload.type === 'friend_request_accepted') {
      console.log('Friend request accepted notification received:', payload);
      // Reload contacts from database to include the new friend
      if (user) {
        loadContactsFromDatabase();
        console.log('Reloading contacts due to friend request acceptance');
      }
    }
    else if (payload.type === 'friend_request') {
      console.log('New friend request received:', payload);
      // Update pending friend requests count in real-time
      setPendingFriendRequests(prev => prev + 1);
    }
    else if (payload.type === 'friend_request_processed') {
      console.log('Friend request processed:', payload);
      // Decrease pending friend requests count when request is processed
      setPendingFriendRequests(prev => Math.max(0, prev - 1));
    }
    else if (payload.type === 'chat') {
      const message = payload as Message;
      const contactId = message.isGroup 
            ? message.contactId 
            : (message.senderId === user?.id ? message.contactId : message.senderId);

      // Save incoming message to database (if it's not from the current user)
      if (contactId && message.senderId !== user?.id && user) {
        // Update messages state immediately for instant UI feedback
        setMessages(prev => {
          const existingMessages = prev[contactId] || [];
          // Check if message already exists to prevent duplicates
          if (existingMessages.some(m => m.id === message.id)) {
            return prev;
          }
          return {
            ...prev,
            [contactId]: [...existingMessages, message].sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
          };
        });

        // Update unread count if not currently viewing this chat
        if (selectedContactId !== contactId) {
          setUnreadCounts(prev => ({
            ...prev,
            [contactId]: (prev[contactId] || 0) + 1
          }));
        }

        // Save to database asynchronously
        setTimeout(() => {
          MessageService.saveMessage(message).catch(error =>
            console.error('Failed to save incoming message:', error)
          );
        }, 0);

        // Publish delivery receipt immediately
        try {
          const topic = message.isGroup 
            ? `chat/${contactId}` 
            : `chat/${[user.id, message.senderId].sort().join('-')}`;
          
          const deliveryReceipt: DeliveryReceipt = {
            type: 'delivery_receipt',
            contactId: contactId,
            readerId: user.id,
            messageIds: [message.id]
          };
          
          mqttService.publish(topic, deliveryReceipt);
          console.log('Published delivery receipt for message:', message.id);
        } catch (error) {
          console.error('Failed to publish delivery receipt:', error);
        }
      }
    }
    else if (payload.type === 'typing') {
        const { contactId, userId, userName, state } = payload as TypingIndicatorPayload;
        if (userId === user?.id) return; // Ignore our own typing events

        // Determine if this is a group or direct chat based on contactId
        const contact = contacts.find(c => c.id === contactId);
        const chatKey = contact?.isGroup ? contactId : userId; // DM threads are keyed by the other user's ID

        setTypingIndicators(prev => {
            const chatIndicators = { ...(prev[chatKey] || {}) };
            
            if (state === 'start') {
                chatIndicators[userId] = userName;
            } else if (state === 'stop') {
                delete chatIndicators[userId];
            }
            
            const newIndicators = { ...prev };
            if (Object.keys(chatIndicators).length === 0) {
                delete newIndicators[chatKey];
            } else {
                newIndicators[chatKey] = chatIndicators;
            }

            return newIndicators;
        });
    }
    else if (payload.type === 'reaction') {
        const { contactId, messageId, reactorId, emoji, action } = payload as ReactionPayload;
        if (reactorId === user?.id) return; // Ignore our own reaction events

        const contact = contacts.find(c => c.id === contactId);
        const chatKey = contact?.isGroup ? contactId : reactorId;

        setMessages(prev => {
            const contactMessages = prev[chatKey] || [];
            if (!contactMessages.length) return prev;
            
            let changed = false;
            const updatedMessages = contactMessages.map(msg => {
                if (msg.id === messageId) {
                    const reactions = msg.reactions || [];
                    if (action === 'add') {
                        // Check if this exact reaction already exists
                        const existingReactionIndex = reactions.findIndex(
                            r => r.emoji === emoji && r.userId === reactorId
                        );
                        
                        if (existingReactionIndex === -1) {
                            changed = true;
                            return { 
                                ...msg, 
                                reactions: [...reactions, { emoji, userId: reactorId }] 
                            };
                        }
                    }
                    if (action === 'remove') {
                        const newReactions = reactions.filter(
                            r => !(r.emoji === emoji && r.userId === reactorId)
                        );
                        if (newReactions.length !== reactions.length) {
                            changed = true;
                            return { ...msg, reactions: newReactions };
                        }
                    }
                }
                return msg;
            });

            if (!changed) return prev;
            return { ...prev, [chatKey]: updatedMessages };
        });
    }
    else if (payload.type === 'read_receipt') {
        const { contactId, readerId, messageIds } = payload as ReadReceipt;
        
        // Skip if this is our own read receipt or if messageIds is missing
        if (readerId === user?.id || !messageIds) return;
        
        console.log(`[Read Receipt] Received from ${readerId} for messages:`, messageIds);
        
        // Determine if this is a group receipt. If we can't find a matching group contact,
        // treat it as a direct message receipt.
        const isGroupReceipt = contacts.some(c => c.id === contactId && c.isGroup);
        
        if (isGroupReceipt) {
            // Group: update by group contactId
            setMessages(prev => {
                const contactMessages = prev[contactId] || [];
                const updatedMessages = contactMessages.map(msg => {
                    if (messageIds.includes(msg.id)) {
                        console.log(`[Message Status] Updating message ${msg.id} to read`);
                        return { ...msg, status: 'read' as const };
                    }
                    return msg;
                });
                return { ...prev, [contactId]: updatedMessages };
            });
            setTimeout(() => { messageIds.forEach(id => MessageService.updateMessageStatus(id, 'read')); }, 0);
        } else {
            // Direct: key by the readerId (other participant)
            const chatKey = readerId;
            setMessages(prev => {
                const dmMessages = prev[chatKey] || prev[contactId] || [];
                const updated = dmMessages.map(msg => {
                    if (messageIds.includes(msg.id)) {
                        console.log(`[Message Status] DM updating message ${msg.id} to read`);
                        return { ...msg, status: 'read' as const };
                    }
                    return msg;
                });
                return { ...prev, [chatKey]: updated };
            });
            setTimeout(() => { messageIds.forEach(id => MessageService.updateMessageStatus(id, 'read')); }, 0);
        }
    }
    else if (payload.type === 'delivery_receipt') {
        const { contactId, readerId, messageIds } = payload as DeliveryReceipt;
        
        // Skip if this is our own delivery receipt or if messageIds is missing
        if (readerId === user?.id || !messageIds) return;
        
        console.log(`[Delivery Receipt] Received from ${readerId} for messages:`, messageIds);
        
        // Determine if this is a group receipt similar to read receipts
        const isGroupReceipt = contacts.some(c => c.id === contactId && c.isGroup);
        
        if (isGroupReceipt) {
            setMessages(prev => {
                const contactMessages = prev[contactId] || [];
                const updatedMessages = contactMessages.map(msg => {
                    if (messageIds.includes(msg.id)) {
                        console.log(`[Message Status] Updating message ${msg.id} to delivered`);
                        return { ...msg, status: 'delivered' as const };
                    }
                    return msg;
                });
                return { ...prev, [contactId]: updatedMessages };
            });
            setTimeout(() => { messageIds.forEach(id => MessageService.updateMessageStatus(id, 'delivered')); }, 0);
        } else {
            // Direct: use readerId as the DM key
            const chatKey = readerId;
            setMessages(prev => {
                const dmMessages = prev[chatKey] || prev[contactId] || [];
                const updated = dmMessages.map(msg => {
                    if (messageIds.includes(msg.id)) {
                        console.log(`[Message Status] DM updating message ${msg.id} to delivered`);
                        return { ...msg, status: 'delivered' as const };
                    }
                    return msg;
                });
                return { ...prev, [chatKey]: updated };
            });
            setTimeout(() => { messageIds.forEach(id => MessageService.updateMessageStatus(id, 'delivered')); }, 0);
        }
    }
  }, [contacts, setContacts, setMessages, user, setTypingIndicators, selectedContactId, setUnreadCounts]);

  // Ensure outgoing messages never downgrade to queued while connected
  useEffect(() => {
    if (!user) return;
    if (!mqttService.isConnected()) return;
    // Promote any of our queued messages to sent when we are connected
    setMessages(prev => {
      let changed = false;
      const updated: typeof prev = {} as any;
      for (const [contactId, list] of Object.entries(prev)) {
        const newList = list.map(m => {
          if (m.senderId === user.id && (m.status === 'queued' || !m.status)) {
            changed = true;
            return { ...m, status: 'sent' as const };
          }
          return m;
        });
        updated[contactId] = newList as any;
      }
      return changed ? updated : prev;
    });
  }, [messages, user?.id]);
  
  // Load pending friend requests count
  const loadPendingFriendRequests = useCallback(async () => {
    if (!user) return;
    try {
      const count = await FriendsService.getPendingFriendRequestsCount(user.id);
      setPendingFriendRequests(count);
    } catch (error) {
      console.error('Error loading pending friend requests count:', error);
    }
  }, [user]);

  // Load unread messages received while user was offline or during reconnect (shared)
  const loadUnreadMessages = useCallback(async () => {
    if (!user) return;
    try {
      console.log('Checking for unread messages received while offline...');
      const unreadMessages = await MessageService.getUnreadMessages(user.id, user.lastSeen);

      const newUnread: Record<string, number> = {};
      Object.entries(unreadMessages).forEach(([contactId, msgs]) => {
        if (msgs.length > 0) {
          newUnread[contactId] = msgs.length;
          setMessages(prev => {
            const existing = prev[contactId] || [];
            const existingIds = new Set(existing.map(m => m.id));
            const unique = msgs.filter(m => !existingIds.has(m.id));
            if (unique.length === 0) return prev;
            const combined = [...existing, ...unique].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            return { ...prev, [contactId]: combined };
          });
        }
      });

      if (Object.keys(newUnread).length > 0) {
        setUnreadCounts(prev => ({ ...prev, ...newUnread }));
      }
    } catch (error) {
      console.error('Error loading unread messages:', error);
    }
  }, [user, setMessages, setUnreadCounts]);



  // Connect once per user
  useEffect(() => {
    if (!user) return;
    console.log('[MQTT] Connecting to MQTT service for user:', user.id);
    mqttService.connect(user);
    
    // Check connection status after a delay
    const checkConnection = setTimeout(() => {
      const isConnected = mqttService.isConnected();
      const status = mqttService.getConnectionStatus();
      console.log('[MQTT] Connection status after connect:', { isConnected, status });
      
      if (!isConnected) {
        console.warn('[MQTT] Failed to connect, attempting reconnection...');
        mqttService.checkConnection();
      }
    }, 2000);
    
    return () => clearTimeout(checkConnection);
  }, [user?.id]);

  // Attach payload listener
  useEffect(() => {
    if (!user) return;
    mqttService.addListener(handleMqttPayload);
    return () => { mqttService.removeListener(handleMqttPayload); };
  }, [user?.id, handleMqttPayload]);

  // Register reconnect helpers for mqttService (via window bridge already used in service)
  useEffect(() => {
    if (!user) return;
    (window as any).processQueuedMessages = processQueuedMessages;
    (window as any).loadUnreadMessages = loadUnreadMessages;
    // run once on mount
    loadUnreadMessages();
    return () => {
      try { delete (window as any).processQueuedMessages; } catch {}
      try { delete (window as any).loadUnreadMessages; } catch {}
    };
  }, [user?.id, processQueuedMessages, loadUnreadMessages]);

  // Manage subscriptions without reconnect churn
  const prevTopicsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    const topics = new Set<string>();
    // Personal inbox
    topics.add(`user/${user.id}`);
    // Contacts
    contacts.forEach(contact => {
      const topic = contact.isGroup ? `chat/${contact.id}` : (contact.topicId || `chat/${[user.id, contact.id].sort().join('-')}`);
      topics.add(topic);
      // Subscribe to user status updates for non-AI contacts
      if (!contact.isAi) {
        topics.add(`user/${contact.id}/status`);
      }
    });

    // Subscribe to new topics
    topics.forEach(t => {
      if (!prevTopicsRef.current.has(t)) {
        mqttService.subscribe(t);
      }
    });
    // Unsubscribe removed topics
    prevTopicsRef.current.forEach(t => {
      if (!topics.has(t)) {
        try { mqttService.unsubscribe(t); } catch {}
      }
    });

    prevTopicsRef.current = topics;
  }, [user?.id, contacts]);

  const selectedContact = useSelectedContactWithLastSeen(selectedContactId, contacts);

  // Import the optimized contact selection hook
  const { handleSelectContact } = useOptimizedContactSelection({
    user,
    contacts,
    messages,
    unreadCounts,
    setSelectedContactId,
    setMessages,
    setUnreadCounts,
    setFirstUnreadMessageId,
    setUiAiStream,
  });

  const triggerAiResponse = useCallback(async (aiContact: Contact, userMessage: Message, groupContext?: { group: Contact }) => {
    setIsLoading(true); // Maybe use a more granular loading state in the future
    const aiMessageId = generateUUID();
    const initialAiMessage: Message = {
        type: 'chat',
        id: aiMessageId,
        contactId: userMessage.contactId, // group ID or direct chat ID
      text: '',
        senderId: aiContact.id,
        senderName: aiContact.name,
        timestamp: new Date(),
        isGroup: !!groupContext,
    };

    setMessages(prev => ({
        ...prev,
        [userMessage.contactId]: [
            ...(prev[userMessage.contactId] || []),
            initialAiMessage,
        ],
    }));

    // Add context for the AI if it's in a group
    let messageForBot = { ...userMessage };
    if (groupContext) {
        messageForBot.text = `(You are in a group chat named "${groupContext.group.name}". User "${userMessage.senderName}" is talking to you.)\n\n${userMessage.text}`;
    }

    try {
        const rawStream = await sendMessageToBot(aiContact, messageForBot);

        // Collect full response first (showing shimmer in UI), then typewriter the final text
        let collected = '';

        // Mark user message as delivered when AI starts responding
        setMessages(prev => {
            const contactMessages = prev[userMessage.contactId] || [];
            const updatedMessages = contactMessages.map(msg =>
                msg.id === userMessage.id ? { ...msg, status: 'delivered' as const } : msg
            );
            return { ...prev, [userMessage.contactId]: updatedMessages };
        });

        // Accumulate across chunks and emit only parsed text segments
        let leftover = '';
        // Append helper
        const pushCollected = (txt: string) => { if (!txt) return; collected += txt; };
        for await (const chunk of rawStream as any) {
          // Case 1: SDK object chunk
          if (chunk && typeof chunk === 'object') {
            try {
              const parts = chunk?.candidates?.[0]?.content?.parts;
              if (Array.isArray(parts)) {
                const piece = parts.map((p: any) => p?.text || '').join('');
                if (piece) { pushCollected(piece); continue; }
              }
              const piece = (chunk?.text ?? '') as string;
              if (piece) { pushCollected(piece); continue; }
            } catch {}
          }
          // Case 2: SSE string chunk
          const raw = (typeof chunk === 'string') ? chunk : '';
          if (raw) {
            leftover += raw;
            let sepIndex: number;
            while ((sepIndex = leftover.indexOf('\n\n')) !== -1) {
              const eventBlock = leftover.slice(0, sepIndex);
              leftover = leftover.slice(sepIndex + 2);
              const lines = eventBlock.split('\n');
              for (const line of lines) {
                const m = line.match(/^data:\s*(.*)$/);
                if (!m) continue;
                const payload = m[1];
                if (payload === '[DONE]' || payload === '') continue;
                try {
                  const obj = JSON.parse(payload);
                  const text = obj?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
                  if (text) pushCollected(text);
                } catch {
                  pushCollected(payload);
                }
              }
            }
          }
        }
        // Flush remaining SSE payload if present
        if (leftover) {
          const lm = leftover.match(/data:\s*(.*)$/m);
          if (lm && lm[1] && lm[1] !== '[DONE]') {
            try {
              const obj = JSON.parse(lm[1]);
              const text = obj?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
              if (text) pushCollected(text);
            } catch {}
          }
        }
        const fullResponse = collected;

        // Save the final AI response to database and broadcast to other users
        if (fullResponse.trim()) {
            try {
                const finalAiMessage: Message = {
                    type: 'chat',
                    id: aiMessageId,
                    contactId: userMessage.contactId,
                    text: fullResponse.trim(),
                    senderId: aiContact.id,
                    senderName: aiContact.name,
                    timestamp: new Date(),
                    isGroup: !!groupContext,
                };
                
                // Save AI message to database with new schema
                await MessageService.saveMessage(finalAiMessage);
                console.log('AI response saved to database:', aiMessageId);
                
                // Broadcast to other users via MQTT for group chats
                if (groupContext && user) {
                    const topic = `chat/${userMessage.contactId}`;
                    mqttService.publish(topic, finalAiMessage);
                    console.log('AI group response broadcasted via MQTT');
                }
                
                // Update the message in state with the final text
                setMessages(prev => {
                    const currentMessages = prev[userMessage.contactId] || [];
                    const updatedMessages = currentMessages.map(msg =>
                        msg.id === aiMessageId ? { ...msg, text: finalAiMessage.text } : msg
                    );
                    return { ...prev, [userMessage.contactId]: updatedMessages };
                });
                // Kick off typewriter stream in UI after full text is known
                setUiAiStream({ contactId: userMessage.contactId, messageId: aiMessageId, text: finalAiMessage.text });
            } catch (error) {
                console.error('Failed to save AI response to database:', error);
            }
        }
    } catch (error) {
        console.error("Error sending message to Gemini:", error);
        setMessages(prev => {
            const currentMessages = prev[userMessage.contactId] || [];
            const updatedMessages = currentMessages.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: "Sorry, I seem to be having trouble connecting. Please try again later." } : msg
            );
            return { ...prev, [userMessage.contactId]: updatedMessages };
        });
    } finally {
        setIsLoading(false);
        // Ensure UI switches away from streaming mode
        setUiAiStream(null);
        // Mark user message as read when AI finishes responding (both 1-on-1 and group chats)
        setMessages(prev => {
            const contactMessages = prev[userMessage.contactId] || [];
            const updatedMessages = contactMessages.map(msg =>
                msg.id === userMessage.id ? { ...msg, status: 'read' as const } : msg
            );
            return { ...prev, [userMessage.contactId]: updatedMessages };
        });
    }
  }, [setMessages, setIsLoading]);

  const handleSendMessage = useCallback(async (text: string, attachment?: Attachment, replyInfo?: { replyTo: Message['replyTo'] }) => {
    if (!selectedContact || isLoading || !user) return;

    let attachmentForMessage: Message['attachment'] | undefined;

    if (attachment?.file) {
      attachmentForMessage = { type: 'image', url: attachment.url };
    }

    const userMessage: Message = {
      type: 'chat',
      id: generateUUID(),
      contactId: selectedContact.id,
      text,
      senderId: user.id,
      senderName: user.name,
      timestamp: new Date(),
      status: mqttService.isConnected() ? 'sent' : 'queued',
      isGroup: !!selectedContact.isGroup,
      ...(attachmentForMessage && { attachment: attachmentForMessage }),
      ...(replyInfo && { replyTo: replyInfo.replyTo })
    };

    // Update local state immediately for instant UI feedback
    setMessages(prev => ({
      ...prev,
      [selectedContact.id]: [
        ...(prev[selectedContact.id] || []),
        userMessage
      ],
    }));

    // Save message to database (for both AI and non-AI contacts)
    try {
      if (attachment?.file) {
        // If there's a file attachment, use the special method
        await MessageService.saveMessageWithAttachment(userMessage, attachment.file);
      } else {
        // Otherwise use the regular save method
        await MessageService.saveMessage(userMessage);
      }
      
      console.log('Message saved to database:', userMessage.id);
      
      // Update status in database after successful save (mirror optimistic rule)
      const shouldOptimisticallyDeliver = selectedContact.isGroup
        ? (selectedContact.memberIds || []).some(id => id !== user.id && !AI_PERSONAS.some(ai => ai.id === id))
        : true;
      const dbStatus = mqttService.isConnected() && shouldOptimisticallyDeliver
        ? ('delivered' as const)
        : (mqttService.isConnected() ? ('sent' as const) : ('queued' as const));
      await MessageService.updateMessageStatus(userMessage.id, dbStatus);

      // Reflect latest DB status in UI immediately (avoid waiting for receipts)
      setMessages(prev => {
        const contactMessages = prev[selectedContact.id] || [];
        const updatedMessages = contactMessages.map(msg =>
          msg.id === userMessage.id && (msg.status === 'queued' || !msg.status)
            ? { ...msg, status: dbStatus }
            : msg
        );
        return { ...prev, [selectedContact.id]: updatedMessages };
      });
    } catch (error) {
      console.error('Failed to save message to database:', error);
    }

    if (selectedContact.isAi) {
        triggerAiResponse(selectedContact, userMessage);
    } else {
        const topic = selectedContact.isGroup 
            ? `chat/${selectedContact.id}` 
            : (selectedContact.topicId || `chat/${[user.id, selectedContact.id].sort().join('-')}`);
        
        mqttService.publish(topic, userMessage);
        
        // Optimistic UI: mark as delivered if there is at least one other online human member in group,
        // or in direct chat assume delivery after publish
        setMessages(prev => {
            const contactMessages = prev[selectedContact.id] || [];
            const shouldOptimisticallyDeliver = selectedContact.isGroup
              ? (selectedContact.memberIds || []).some(id => id !== user.id && !AI_PERSONAS.some(ai => ai.id === id))
              : true;
            const updatedMessages = contactMessages.map(msg =>
                msg.id === userMessage.id
                  ? { ...msg, status: shouldOptimisticallyDeliver ? ('delivered' as const) : ('sent' as const) }
                  : msg
            );
            
            const newStatus = shouldOptimisticallyDeliver ? 'delivered' : 'sent';
            console.log(`[Message Status] Message ${userMessage.id} status updated to: ${newStatus} (optimistic)`);
            
            return { ...prev, [selectedContact.id]: updatedMessages };
        });

        // Check for AI mentions in a group chat - anywhere in the message
        if (selectedContact.isGroup) {
            const groupMembers = selectedContact.memberIds || [];
            AI_PERSONAS.forEach(aiPersona => {
                if (groupMembers.includes(aiPersona.id)) {
                    // Check for different variations of the mention tag
                    const mentionVariations = [
                        `@${aiPersona.name}`,
                        `@${aiPersona.name.toLowerCase()}`,
                        `@${aiPersona.name.toUpperCase()}`,
                        `@${aiPersona.name.replace(/\s+/g, '')}`, // Remove spaces
                        `@${aiPersona.name.replace(/\s+/g, '-')}`, // Replace spaces with hyphens
                    ];
                    
                    const foundMention = mentionVariations.find(mention => 
                        userMessage.text.toLowerCase().includes(mention.toLowerCase())
                    );
                    
                    if (foundMention) {
                        console.log(`AI mention detected: ${foundMention} in message: "${userMessage.text}"`);
                        
                        // Send the entire message to AI, but remove the mention tag for cleaner context
                        const messageForBot = { ...userMessage };
                        
                        // Remove the found mention variation (case-insensitive)
                        const regex = new RegExp(foundMention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                        messageForBot.text = messageForBot.text.replace(regex, '').trim();
                        
                        console.log(`Sending to AI "${aiPersona.name}": "${messageForBot.text}"`);
                        
                        // Ensure we don't send empty messages
                        if (messageForBot.text.trim()) {
                            triggerAiResponse(aiPersona, messageForBot, { group: selectedContact });
                        } else {
                            // If message is empty after removing mention, send a default prompt
                            messageForBot.text = "Please help me with this.";
                            triggerAiResponse(aiPersona, messageForBot, { group: selectedContact });
                        }
                    }
                }
            });
        }
    }

  }, [selectedContact, isLoading, setMessages, user, triggerAiResponse]);

  const handleCreateGroup = async (name: string, members: string[]) => {
    if (!user) return;
    
    try {
      // Create group in database
      const newGroup = await GroupService.createGroup(name, user.id, members);
      
      // Add group to local state
      setContacts(prev => [newGroup, ...prev]);

      // Subscribe to the group topic
      const topic = `chat/${newGroup.id}`;
      mqttService.subscribe(topic);
      
      // Send invitations to all human members
      const invitation: Invitation = {
          type: 'invitation',
          contact: newGroup,
          topic: topic
      };
      members.forEach(memberId => {
          const isAi = AI_PERSONAS.some(p => p.id === memberId);
          if (!isAi) {
             const memberTopic = `user/${memberId}`;
             mqttService.publish(memberTopic, invitation);
          }
      });

      setNewGroupOpen(false);
      setSelectedContactId(newGroup.id);
    } catch (error) {
      console.error('Failed to create group:', error);
      // TODO: Show error message to user
    }
  }

  const handleUpdateGroup = async (groupId: string, name: string, memberIds: string[]) => {
    if (!user) return;
    
    try {
      // Update group in database
      await GroupService.updateGroup(groupId, name, memberIds, user.id);
      
      // Update local state
      setContacts(prev => prev.map(c => {
        if (c.id === groupId) {
          return { ...c, name, memberIds: [...new Set([user.id, ...memberIds])] };
        }
        return c;
      }));
      
      setEditingGroup(null);
    } catch (error) {
      console.error('Failed to update group:', error);
      // TODO: Show error message to user
    }
  };

  const handleTogglePinContact = useCallback(async (contactId: string) => {
    if (!user) return;
    
    // Get current pin status
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const newPinStatus = !contact.isPinned;
    
    // Update local state optimistically
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isPinned: newPinStatus } : c));
    
    // Update in database if it's a real contact (not AI)
    if (!contact.isAi) {
      try {
        await FriendsService.togglePin(user.id, contactId, newPinStatus);
      } catch (error) {
        console.error('Failed to update pin status in database:', error);
        // Revert local state on error
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isPinned: !newPinStatus } : c));
      }
    }
  }, [user, contacts, setContacts]);

  const handleFriendRequestAccepted = useCallback(async (friendId: string) => {
    console.log('Friend request accepted for user:', friendId);
    setPendingFriendRequests(prev => (prev > 0 ? prev - 1 : 0));
    // Reload contacts from database to include the new friend
    await loadContactsFromDatabase();
    console.log('Contacts reloaded successfully');
  }, [loadContactsFromDatabase]);

  const handleReactToMessage = useCallback(async (messageId: string, emoji: string) => {
    if (!selectedContactId || !user || !selectedContact) return;

    // Find the message to react to
    const message = messages[selectedContactId]?.find(m => m.id === messageId);
    if (!message) return;
    
    // Check if the user already reacted with this emoji
    const existingReaction = message.reactions?.find(r => 
      r.emoji === emoji && r.userId === user.id
    );
    
    // Determine if we're adding or removing the reaction
    const action = existingReaction ? 'remove' : 'add';

    // Optimistically update local state
    setMessages(prev => {
      const contactMessages = prev[selectedContactId] || [];
      const updatedMessages = contactMessages.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || [];
          
          if (action === 'remove') {
            // Remove the reaction
            return {
              ...msg,
              reactions: reactions.filter(r => !(r.emoji === emoji && r.userId === user.id))
            };
          } else {
            // Add the reaction
            return {
              ...msg,
              reactions: [...reactions, { emoji, userId: user.id }]
            };
          }
        }
        return msg;
      });
      return { ...prev, [selectedContactId]: updatedMessages };
    });

    // Save reaction to database
    try {
      if (action === 'add') {
        await MessageService.addReaction(messageId, user.id, emoji);
      } else {
        await MessageService.removeReaction(messageId, user.id, emoji);
      }
    } catch (error) {
      console.error('Failed to save reaction to database:', error);
    }

    // Publish the event to other users
    if (!selectedContact.isAi) {
      const topic = selectedContact.isGroup 
          ? `chat/${selectedContact.id}` 
          : (selectedContact.topicId || `chat/${[user.id, selectedContact.id].sort().join('-')}`);
      
      const payload: ReactionPayload = {
          type: 'reaction',
          contactId: selectedContactId,
          messageId,
          reactorId: user.id,
          emoji,
          action,
      };
      mqttService.publish(topic, payload);
    }
  }, [selectedContact, selectedContactId, user, messages, setMessages]);

  const handleForwardMessage = useCallback(async (targetContactId: string) => {
    if (!forwardingMessage || !user) return;
    
    const originalText = forwardingMessage.text;
    const originalAttachment = forwardingMessage.attachment;
    
    // Close the forwarding modal
    setForwardingMessage(null);
    
    // Find the target contact
    const targetContact = contacts.find(c => c.id === targetContactId);
    if (!targetContact) return;
    
    // Switch to the target contact's chat
    handleSelectContact(targetContactId);
    
    // Create attachment object if needed
    let attachment: Attachment | undefined;
    if (originalAttachment) {
      attachment = {
        type: 'image',
        url: originalAttachment.url
      };
    }
    
    // Create and send a new message with isForwarded flag
    const messageId = generateUUID();
    const newMessage: Message = {
      type: 'chat',
      id: messageId,
      contactId: targetContactId,
      text: originalText,
      senderId: user.id,
      senderName: user.name,
      timestamp: new Date(),
      status: 'sent',
      attachment,
      isForwarded: true,
      forwardedFromMessageId: forwardingMessage.id,
      forwardedFromContactId: forwardingMessage.contactId,
      forwardedById: user.id,
      forwardedToContactId: targetContactId,
      isGroup: targetContact.isGroup,
    };
    
    // Add message to local state first
    setMessages(prev => ({
      ...prev,
      [targetContactId]: [...(prev[targetContactId] || []), newMessage]
    }));
    
    // Save to database and publish to MQTT
    await MessageService.saveMessage(newMessage);
    const topic = targetContact.isGroup 
      ? `group/${targetContactId}` 
      : `chat/${targetContactId}/${user.id}`;
    mqttService.publish(topic, newMessage);

  }, [forwardingMessage, contacts, user, handleSelectContact, setMessages]);
  
  const handleAddAiContact = useCallback(async (aiContact: Contact) => {
    if (!user) return;
    
    // If contact already exists, just select it
    if (contacts.some(c => c.id === aiContact.id)) {
        setSelectedContactId(aiContact.id);
        return;
    }
    // Otherwise, add it to the list and then select it
    const newContactWithStatus = { ...aiContact, status: 'online' as const };
    setContacts(prev => [newContactWithStatus, ...prev]);
    setSelectedContactId(aiContact.id);
    
    // Save to database
    try {
      await FriendsService.addAiContact(user.id, aiContact.id);
    } catch (error) {
      console.error('Failed to add AI contact to database:', error);
    }
  }, [contacts, setContacts, user]);
  
  const handleToggleAiContact = useCallback(async (aiContactId: string, shouldBeEnabled: boolean) => {
    if (!user) return;
    
    setContacts(prevContacts => {
        const contactExists = prevContacts.some(c => c.id === aiContactId);

        if (shouldBeEnabled && !contactExists) {
            // Add the contact
            const contactToAdd = AI_PERSONAS.find(p => p.id === aiContactId);
            if (contactToAdd) {
                // Save to database
                FriendsService.addAiContact(user.id, aiContactId).catch(err => {
                  console.error('Failed to add AI contact to database:', err);
                });
                return [...prevContacts, contactToAdd];
            }
        } else if (!shouldBeEnabled && contactExists) {
            // Remove the contact, but also check if it's the currently selected one
            if (selectedContactId === aiContactId) {
                setSelectedContactId(null);
            }
            // Remove from database
            FriendsService.removeAiContact(user.id, aiContactId).catch(err => {
              console.error('Failed to remove AI contact from database:', err);
            });
            
            return prevContacts.filter(c => c.id !== aiContactId);
        }
        // No change needed
        return prevContacts;
    });
  }, [setContacts, selectedContactId, user]);

  const handleLogout = useCallback(async () => {
    try {
      // Disconnect from MQTT service
      mqttService.disconnect();
      
      // Clear local storage data (keeping theme, sidebarWidth, and user session data)
              // Clear any remaining auth data
        console.log('Clearing auth data on logout');
      
      // Properly log out using Supabase auth
      await logout();
      
      console.log('Logout successful, redirecting to login page');
      
      // Redirect to login page after a small delay to ensure Supabase has time to process the logout
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    } catch (error) {
      console.error('Error during logout:', error);
      // Still redirect to login page even if there's an error
      window.location.href = '/login';
    }
  }, [logout]);

  // Remove manual mouse event resizing logic, use ResizablePanel's onResize

  // If no user, show a loading state instead of rendering nothing
  if (!user) {
    console.log('No user profile found in App component');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center p-8 max-w-md mx-auto bg-slate-800 rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl text-white mb-2">Loading your profile...</h2>
          <p className="text-slate-400">If this persists, please try logging out and back in again.</p>
        </div>
      </div>
    );
  }

  // Sort contacts by last message timestamp (descending)
  const sortedContacts = [...contacts].sort((a, b) => {
    const aMessages = messages[a.id] || [];
    const bMessages = messages[b.id] || [];
    const aLast = aMessages.length ? new Date(aMessages[aMessages.length - 1].timestamp).getTime() : 0;
    const bLast = bMessages.length ? new Date(bMessages[bMessages.length - 1].timestamp).getTime() : 0;
    // If both have no messages, keep original order
    if (!aLast && !bLast) return 0;
    return bLast - aLast;
  });


    return (
    <>{/* Mobile Layout (Motion / motion.dev slide in/out) */}
<div className="md:hidden relative w-full h-screen overflow-hidden">
  <AnimatePresence initial={false} mode="wait">
    {!selectedContact ? (
      <motion.div
        key="mobile-sidebar"
        initial={{ x: 0 }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="absolute inset-0 w-full h-full z-20"
      >
        <MobileSidebar
          contacts={sortedContacts}
          messages={messages}
          unreadCounts={unreadCounts}
          selectedContactId={selectedContactId}
          onSelectContact={handleSelectContact}
          user={user}
          onNewGroup={() => setNewChatOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          onTogglePin={handleTogglePinContact}
          onFriendRequests={() => setFriendRequestsOpen(true)}
          typingIndicators={typingIndicators}
          pendingFriendRequestsCount={pendingFriendRequests}
          onClose={() => {
            // Handle mobile sidebar close
          }}
        />
      </motion.div>
    ) : (
      <motion.div
        key="mobile-chat"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="absolute inset-0 w-full h-full z-30"
      >
        <ChatView
          contact={selectedContact}
          currentUser={user}
          aiStream={
            selectedContact &&
            uiAiStream &&
            uiAiStream.contactId === selectedContact.id
              ? {
                  messageId: uiAiStream.messageId,
                  stream: uiAiStream.stream,
                  text: uiAiStream.text,
                }
              : null
          }
          contacts={contacts}
          messages={selectedContact ? messages[selectedContact.id] || [] : []}
          isLoading={isLoading}
          typingIndicators={
            selectedContact ? typingIndicators[selectedContact.id] || {} : {}
          }
          onSendMessage={handleSendMessage}
          onImageClick={setLightboxImage}
          onEditGroup={setEditingGroup}
          onReact={handleReactToMessage}
          onForward={setForwardingMessage}
          onNewGroup={() => setNewGroupOpen(true)}
          onInviteUser={() => setInviteModalOpen(true)}
          onAddAiContact={handleAddAiContact}
          aiPersonas={AI_PERSONAS}
          firstUnreadMessageId={firstUnreadMessageId}
          setFirstUnreadMessageId={setFirstUnreadMessageId}
          onBack={() => setSelectedContactId(null)}
          onLoadOlder={(contactId, merged) => {
            setMessages(prev => ({ ...prev, [contactId]: merged }));
          }}
        />
      </motion.div>
    )}
  </AnimatePresence>
</div>

      {/* Desktop Layout */}
      <div className="hidden md:flex h-screen">
        <SidebarProvider
          style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
        >
        <AppSidebar
          contacts={sortedContacts}
          messages={messages}
          unreadCounts={unreadCounts}
          selectedContactId={selectedContactId}
          onSelectContact={handleSelectContact}
          user={user}
          onNewGroup={() => setNewChatOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          onTogglePin={handleTogglePinContact}
          onFriendRequests={() => setFriendRequestsOpen(true)}
          typingIndicators={typingIndicators}
          pendingFriendRequestsCount={pendingFriendRequests}
          isLoading={isContactsLoading}
          error={contactsError}
          onRetry={loadContactsFromDatabase}
          onClose={() => {
            // Handled by sidebar's built-in close functionality
          }}
        />
  
        <SidebarInset className="h-screen shadow-lg flex flex-1 overflow-hidden">
          <ChatView
            contact={selectedContact || undefined}
            currentUser={user}
            aiStream={
              selectedContact &&
              uiAiStream &&
              uiAiStream.contactId === selectedContact.id
                ? {
                    messageId: uiAiStream.messageId,
                    stream: uiAiStream.stream,
                    text: uiAiStream.text,
                  }
                : null
            }
            contacts={contacts}
            messages={selectedContact ? messages[selectedContact.id] || [] : []}
            isLoading={isLoading}
            typingIndicators={
              selectedContact ? typingIndicators[selectedContact.id] || {} : {}
            }
            onSendMessage={handleSendMessage}
            onImageClick={setLightboxImage}
            onEditGroup={setEditingGroup}
            onReact={handleReactToMessage}
            onForward={setForwardingMessage}
            onNewGroup={() => setNewGroupOpen(true)}
            onInviteUser={() => setInviteModalOpen(true)}
            onAddAiContact={handleAddAiContact}
            aiPersonas={AI_PERSONAS}
            firstUnreadMessageId={firstUnreadMessageId}
            setFirstUnreadMessageId={setFirstUnreadMessageId}
            onLoadOlder={(contactId, merged) => {
              setMessages(prev => ({ ...prev, [contactId]: merged }));
            }}
          />
        </SidebarInset>
        </SidebarProvider>
      </div>
  
      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onUserUpdate={setUser}
        aiPersonas={AI_PERSONAS}
        contacts={contacts}
        onToggleAiContact={handleToggleAiContact}
      />
  
      <NewChatDialog
        isOpen={isNewChatOpen}
        onClose={() => setNewChatOpen(false)}
        currentUser={user!}
        contacts={contacts}
        aiPersonas={AI_PERSONAS}
        onCreateGroup={handleCreateGroup}
      />
  
      <EditGroupModal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        group={editingGroup}
        contacts={contacts.filter((c) => !c.isGroup && !c.isAi)}
        aiPersonas={AI_PERSONAS}
        onUpdateGroup={handleUpdateGroup}
      />
  
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        currentUser={user!}
      />
  
      <FriendRequestsModal
        isOpen={isFriendRequestsOpen}
        onClose={() => setFriendRequestsOpen(false)}
        currentUser={user!}
        onRequestAccepted={handleFriendRequestAccepted}
      />
  
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        contacts={contacts}
        onForward={handleForwardMessage}
        currentUser={user}
        message={forwardingMessage || undefined}
      />
  
      {lightboxImage && (
        <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
  

    </>
  );
}

export default App;