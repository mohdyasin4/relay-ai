import React, { useState, useCallback, useEffect, useRef } from 'react';
import { databaseService } from './services/databaseService';
import { DatabaseService } from './services/databaseService';
import { useSelectedContactWithLastSeen } from './hooks/useSelectedContactWithLastSeen';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import SettingsModal from './components/SettingsModal';
import NewGroupModal from './components/NewGroupModal';
import EditGroupModal from './components/EditGroupModal';
import Lightbox from './components/Lightbox';
import ForwardMessageModal from './components/ForwardMessageModal';
import InviteUserModal from './components/InviteUserModal';
import FriendRequestsModal from './components/FriendRequestsModal';
import { generateUUID } from './utils/uuidUtils';
import { sendMessageToBot } from './services/geminiService';
import { FriendsService } from './services/friendsService';
import { MessageService } from './services/messageService';
import { GroupService } from './services/groupService';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAuth } from './contexts/AuthContext';
import type { Contact, Message, MessagesState, User, Attachment, Theme, MqttPayload, Invitation, ReadReceipt, DeliveryReceipt, TypingIndicatorPayload, ReactionPayload } from './types';
import { AI_PERSONAS } from './constants';
import { mqttService } from './services/mqttService';

const App: React.FC = () => {
  console.log('App component rendering');
  const { user: authUser, logout } = useAuth(); // Access authenticated user and logout from AuthContext
  console.log('Auth user from context:', authUser);
  const [user, setUser] = useState<User | null>(authUser); // Initialize with auth user
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'dark');
  const [sidebarWidth, setSidebarWidth] = useLocalStorage<number>('sidebarWidth', 320);
  const [mqttStatus, setMqttStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagesState>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [typingIndicators, setTypingIndicators] = useState<Record<string, Record<string, string>>>({});
  
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);

  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isNewGroupOpen, setNewGroupOpen] = useState(false);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [isFriendRequestsOpen, setFriendRequestsOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Contact | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  
  const isResizing = useRef(false);

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
                    console.log('Quote message saved to database');
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

      // Set user offline on window/tab close, pagehide, or when tab becomes inactive
      const goOffline = async () => {
        try {
          if (updatedUser.id) {
            await DatabaseService.updateUserStatus(updatedUser.id, 'offline');
          }
        } catch (e) {
          // Ignore errors
        }
      };

      // Handle tab close/unload
      window.addEventListener('beforeunload', goOffline);
      window.addEventListener('pagehide', goOffline);

      // Handle tab inactivity (visibilitychange)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          goOffline();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('beforeunload', goOffline);
        window.removeEventListener('pagehide', goOffline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [authUser, setUser]);

  const loadAllContactMessages = useCallback(async (contactsList: Contact[]) => {
    console.log('Loading messages for all contacts for proper sorting');
    const messagePromises = contactsList.map(async (contact) => {
      try {
        // Only load messages for real contacts and groups, not AI assistants
        if (!contact.isAi) {
          const dbMessages = await MessageService.getMessages(contact.id, contact.isGroup);
          return { contactId: contact.id, messages: dbMessages };
        }
        return null;
      } catch (error) {
        console.error(`Failed to load messages for contact ${contact.id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(messagePromises);
    const messagesMap: MessagesState = {};
    
    results.forEach(result => {
      if (result) {
        messagesMap[result.contactId] = result.messages;
      }
    });

    setMessages(messagesMap);
    console.log('Loaded messages for all contacts:', messagesMap);
  }, []);

  const loadContactsFromDatabase = useCallback(async () => {
    if (!user) return;
    
    console.log('Loading contacts from database for user:', user.id);
    try {
      // Load all contacts from database (including AI assistants)
      const allContacts = await FriendsService.getContacts(user.id);
      console.log('Contacts loaded from database:', allContacts);
      
      // Subscribe to MQTT topics for new contacts
      allContacts.forEach(contact => {
        if (!contact.isAi) {
          const topic = contact.isGroup ? `chat/${contact.id}` : `chat/${[user.id, contact.id].sort().join('-')}`;
          mqttService.subscribe(topic);
          console.log(`Subscribed to topic for contact ${contact.name}: ${topic}`);
        }
      });
      
      setContacts(allContacts);
      
      // Load recent messages for all contacts to enable proper sorting
      await loadAllContactMessages(allContacts);
    } catch (error) {
      console.error('Failed to load contacts from database:', error);
      // Fallback to empty contacts on error
      setContacts([]);
    }
  }, [user, loadAllContactMessages]);

  // Load contacts from database when user changes
  useEffect(() => {
    if (user) {
      loadContactsFromDatabase();
    }
  }, [user, loadContactsFromDatabase]);

  const processQueuedMessages = useCallback(async () => {
    if (!user) return;
    
    console.log('Processing queued messages...');
    
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme !== 'light');
    document.documentElement.classList.toggle('midnight', theme === 'midnight');
    
    let bodyClass = '';
    if (theme === 'light') {
      bodyClass = 'bg-slate-50';
    } else if (theme === 'dark') {
      bodyClass = 'bg-slate-950';
    } else { // midnight
      bodyClass = 'bg-slate-900';
    }
    document.body.className = bodyClass;
  }, [theme]);

  const handleMqttPayload = useCallback(async (payload: MqttPayload, topic: string) => {
    console.log('Received MQTT Payload:', payload, 'on topic:', topic);

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
    else if (payload.type === 'chat') {
      const message = payload as Message;
      const contactId = message.isGroup 
            ? message.contactId 
            : (message.senderId === user?.id ? message.contactId : message.senderId);

      // Save incoming message to database (if it's not from the current user)
      if (contactId && message.senderId !== user?.id && user) {
        // Check if sender is in our contacts list
        const senderContact = contacts.find(c => c.id === message.senderId);
        if (!senderContact && !AI_PERSONAS.some(ai => ai.id === message.senderId)) {
          console.log('Received message from unknown contact, reloading contacts:', message.senderId);
          loadContactsFromDatabase();
        }
        
        try {
          // Check if sender is an AI persona
          const isAiSender = AI_PERSONAS.some(ai => ai.id === message.senderId);
          
          if (isAiSender) {
            // Save AI message to database with new schema
            await MessageService.saveMessage(message);
            console.log('AI message from other user saved to database:', message.id);
          } else {
            // Regular user message
            await MessageService.saveMessage(message);
            console.log('Incoming message saved to database:', message.id);
            
            // Send delivery receipt to sender (if it's not from an AI)
            const deliveryContact = contacts.find(c => c.id === message.senderId);
            if (!deliveryContact?.isAi) {
              const topic = message.isGroup 
                ? `chat/${contactId}` 
                : `chat/${[user.id, message.senderId].sort().join('-')}`;
              
              const deliveryReceipt: DeliveryReceipt = {
                type: 'delivery_receipt',
                contactId: contactId,
                readerId: user.id,
                messageIds: [message.id]
              };
              
              // Send delivery confirmation
              mqttService.publish(topic, deliveryReceipt);
            }
          }
        } catch (error) {
          console.error('Failed to save incoming message to database:', error);
        }
      }

      // Increment unread count if this chat is not active
      if (user && message.senderId !== user.id && contactId && contactId !== selectedContactId) {
        setUnreadCounts(prev => ({
            ...prev,
            [contactId]: (prev[contactId] || 0) + 1
        }));
      }

      setMessages(prev => {
        if (!contactId) return prev;

        const contactMessages = prev[contactId] || [];
        if (contactMessages.some(m => m.id === message.id)) {
            return prev;
        }
        
        const newMessages = [...contactMessages, message];
        // When a message is received, mark my 'typing' status as stopped for this chat
        setTypingIndicators(prevTyping => {
            const newTyping = { ...prevTyping };
            if (newTyping[contactId] && message.senderId) {
                delete newTyping[contactId][message.senderId];
            }
            return newTyping;
        });

        return { ...prev, [contactId]: newMessages };
      });
    }
    else if (payload.type === 'delivery_receipt') {
        const { contactId, readerId, messageIds } = payload as DeliveryReceipt;
        if (readerId === user?.id) return; // Don't process our own delivery receipts

        const contact = contacts.find(c => c.id === contactId);
        const chatKey = contact?.isGroup ? contactId : readerId;

        // Update message status to 'delivered' in local state and database
        setMessages(prev => {
            const contactMessages = prev[chatKey] || [];
            if (!contactMessages.length) return prev;

            let changed = false;
            const updatedMessages = contactMessages.map(msg => {
                if (msg.senderId === user?.id && 
                    (!messageIds || messageIds.includes(msg.id)) && 
                    msg.status === 'sent') {
                    changed = true;
                    // Update in database
                    MessageService.updateMessageStatus(msg.id, 'delivered').catch(err => 
                        console.error('Failed to update message status to delivered:', err)
                    );
                    return { ...msg, status: 'delivered' as const };
                }
                return msg;
            });
            
            if (!changed) return prev;
            return { ...prev, [chatKey]: updatedMessages };
        });
    }
    else if (payload.type === 'read_receipt') {
        const { contactId, readerId } = payload as ReadReceipt;
        if (readerId === user?.id) return; // Don't process our own read receipts

        const contact = contacts.find(c => c.id === contactId);
        const chatKey = contact?.isGroup ? contactId : readerId;

        setMessages(prev => {
            const contactMessages = prev[chatKey] || [];
            if (!contactMessages.length) return prev;

            let changed = false;
            const updatedMessages = contactMessages.map(msg => {
                if (msg.senderId === user?.id && 
                    (!payload.messageIds || payload.messageIds.includes(msg.id)) && 
                    msg.status !== 'read') {
                    changed = true;
                    // Update in database
                    MessageService.updateMessageStatus(msg.id, 'read').catch(err => 
                        console.error('Failed to update message status to read:', err)
                    );
                    return { ...msg, status: 'read' as const };
                }
                return msg;
            });
            
            if (!changed) return prev;
            return { ...prev, [chatKey]: updatedMessages };
        });
    }
    else if (payload.type === 'typing') {
        const { contactId, userId, userName, state } = payload as TypingIndicatorPayload;
        if (userId === user?.id) return; // Ignore our own typing events

        const contact = contacts.find(c => c.id === contactId);
        const chatKey = contact?.isGroup ? contactId : userId;

        setTypingIndicators(prev => {
            const newIndicators = { ...prev };
            const chatIndicators = { ...(newIndicators[chatKey] || {}) };

            if (state === 'start') {
                chatIndicators[userId] = userName;
            } else {
                delete chatIndicators[userId];
            }
            
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
  }, [contacts, setContacts, setMessages, user, setTypingIndicators, selectedContactId, setUnreadCounts]);
  
  // MQTT Connection and message handling
  useEffect(() => {
    if (user) {
        mqttService.connect(user);
        mqttService.addListener(handleMqttPayload);
        setMqttStatus(mqttService.getConnectionStatus());

        // Subscribe to personal "inbox" topic for invitations
        const personalTopic = `user/${user.id}`;
        mqttService.subscribe(personalTopic);
        console.log(`Subscribed to personal topic: ${personalTopic}`);

        // Subscribe to topics for all existing contacts
        contacts.forEach(contact => {
            if (!contact.isAi) {
                const topic = contact.isGroup ? `chat/${contact.id}` : `chat/${[user.id, contact.id].sort().join('-')}`;
                mqttService.subscribe(topic);
            }
        });

        // Load unread messages received while user was offline
        const loadUnreadMessages = async () => {
            try {
                console.log('Checking for unread messages received while offline...');
                const unreadMessages = await MessageService.getUnreadMessages(user.id);
                
                // Update unread counts in state
                const newUnreadCounts: Record<string, number> = {};
                Object.entries(unreadMessages).forEach(([contactId, messages]) => {
                    if (messages.length > 0) {
                        newUnreadCounts[contactId] = messages.length;
                        
                        // Update messages state to include these unread messages
                        setMessages(prev => {
                            const existingMessages = prev[contactId] || [];
                            
                            // Avoid duplicates by checking IDs
                            const existingIds = new Set(existingMessages.map(m => m.id));
                            const newMessages = messages.filter(m => !existingIds.has(m.id));
                            
                            if (newMessages.length === 0) return prev;
                            
                            // Sort by timestamp after merging
                            const combined = [...existingMessages, ...newMessages].sort((a, b) => {
                                const timeA = new Date(a.timestamp).getTime();
                                const timeB = new Date(b.timestamp).getTime();
                                return timeA - timeB;
                            });
                            
                            return {...prev, [contactId]: combined};
                        });
                    }
                });
                
                // Update unread counts
                if (Object.keys(newUnreadCounts).length > 0) {
                    console.log('Found unread messages:', newUnreadCounts);
                    setUnreadCounts(prev => ({...prev, ...newUnreadCounts}));
                } else {
                    console.log('No unread messages found');
                }
            } catch (error) {
                console.error('Error loading unread messages:', error);
            }
        };
        
        loadUnreadMessages();
        
        // Periodically check MQTT connection status
        const statusInterval = setInterval(() => {
            const prevStatus = mqttStatus;
            const status = mqttService.getConnectionStatus();
            setMqttStatus(status);
            
            // If we just reconnected, process any queued messages
            if (prevStatus !== 'connected' && status === 'connected') {
                console.log('[App] MQTT reconnected, processing queued messages...');
                processQueuedMessages();
                
                // Also reload unread messages when reconnecting
                loadUnreadMessages();
            }
            
            // If disconnected or error, try to reconnect
            if (status === 'disconnected' || status === 'error') {
                console.log('[App] MQTT appears to be disconnected, attempting to reconnect...');
                mqttService.checkConnection().then(connected => {
                    console.log(`[App] MQTT reconnection attempt result: ${connected ? 'connected' : 'failed'}`);
                });
            }
        }, 30000); // Check every 30 seconds
        
        return () => {
            clearInterval(statusInterval);
            mqttService.removeListener(handleMqttPayload);
            mqttService.disconnect();
        };
    }
  }, [user, contacts, handleMqttPayload, processQueuedMessages]);

  const selectedContact = useSelectedContactWithLastSeen(selectedContactId, contacts);

  const loadMessagesFromDatabase = useCallback(async (contactId: string, isGroup: boolean = false) => {
    try {
      console.log('Loading messages for contact:', contactId, 'isGroup:', isGroup);
      const dbMessages = await MessageService.getMessages(contactId, isGroup);
      console.log('Messages loaded from database:', dbMessages);
      
      setMessages(prev => ({
        ...prev,
        [contactId]: dbMessages
      }));
    } catch (error) {
      console.error('Failed to load messages from database:', error);
    }
  }, [setMessages]);

  const handleSelectContact = useCallback(async (contactId: string) => {
    setSelectedContactId(contactId);
    
    // Load messages from database for this contact
    const contact = contacts.find(c => c.id === contactId);
    if (contact && (contact.isGroup || !contact.isAi)) {
      await loadMessagesFromDatabase(contactId, contact.isGroup);
    }
    
    // Send read receipts for unread messages and update their status in database
    if (user && !contact?.isAi) {
      const chatMessages = messages[contactId] || [];
      const unreadMessages = chatMessages.filter(msg => 
        msg.senderId !== user.id && msg.status !== 'read'
      );
      
      if (unreadMessages.length > 0) {
        // Update message statuses to 'read' in database
        for (const msg of unreadMessages) {
          try {
            await MessageService.updateMessageStatus(msg.id, 'read');
          } catch (error) {
            console.error('Failed to update message status to read:', error);
          }
        }
        
        // Send read receipt via MQTT to notify sender
        const topic = contact?.isGroup 
          ? `chat/${contactId}` 
          : `chat/${[user.id, contactId].sort().join('-')}`;
        
        const readReceipt: ReadReceipt = {
          type: 'read_receipt',
          contactId: contactId,
          readerId: user.id,
          messageIds: unreadMessages.map(m => m.id)
        };
        
        mqttService.publish(topic, readReceipt);
        
        // Update local message statuses
        setMessages(prev => {
          const contactMessages = prev[contactId] || [];
          const updatedMessages = contactMessages.map(msg =>
            unreadMessages.some(unread => unread.id === msg.id) 
              ? { ...msg, status: 'read' as const }
              : msg
          );
          return { ...prev, [contactId]: updatedMessages };
        });
      }
    }
    
    // Find the first unread message before clearing the count
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
        setFirstUnreadMessageId(null); // Clear if there are no unread messages
    }

    // Clear unread count for this contact
    setUnreadCounts(prev => {
      if (!prev[contactId]) {
        return prev; // No change needed
      }
      const newCounts = { ...prev };
      delete newCounts[contactId];
      return newCounts;
    });
  }, [setUnreadCounts, unreadCounts, messages, contacts, loadMessagesFromDatabase]);

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
        const stream = await sendMessageToBot(aiContact, messageForBot);

        if (!groupContext) { // Mark as delivered only in 1-on-1 chats
            setMessages(prev => {
                const contactMessages = prev[aiContact.id] || [];
                const updatedMessages = contactMessages.map(msg =>
                    msg.id === userMessage.id ? { ...msg, status: 'delivered' as const } : msg
                );
                return { ...prev, [aiContact.id]: updatedMessages };
            });
        }

        let fullResponse = '';
        for await (const chunk of stream) {
            fullResponse += chunk.text;
            setMessages(prev => {
                const currentMessages = prev[userMessage.contactId] || [];
                const updatedMessages = currentMessages.map(msg =>
                    msg.id === aiMessageId ? { ...msg, text: fullResponse, timestamp: new Date() } : msg
                );
                return { ...prev, [userMessage.contactId]: updatedMessages };
            });
        }

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
        if (!groupContext) { // Mark as read only in 1-on-1 chats
             setMessages(prev => {
                const contactMessages = prev[aiContact.id] || [];
                const updatedMessages = contactMessages.map(msg =>
                    msg.id === userMessage.id ? { ...msg, status: 'read' as const } : msg
                );
                return { ...prev, [aiContact.id]: updatedMessages };
            });
        }
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
      status: mqttStatus === 'connected' ? 'sent' : 'queued',
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
      
      // Update status in database after successful save
      const finalStatus = mqttStatus === 'connected' ? 'sent' : 'queued';
      await MessageService.updateMessageStatus(userMessage.id, finalStatus);
    } catch (error) {
      console.error('Failed to save message to database:', error);
    }

    if (selectedContact.isAi) {
        triggerAiResponse(selectedContact, userMessage);
    } else {
        const topic = selectedContact.isGroup 
            ? `chat/${selectedContact.id}` 
            : `chat/${[user.id, selectedContact.id].sort().join('-')}`;
        
        mqttService.publish(topic, userMessage);
        
        setMessages(prev => {
            const contactMessages = prev[selectedContact.id] || [];
            const updatedMessages = contactMessages.map(msg =>
                msg.id === userMessage.id ? { ...msg, status: 'delivered' as const } : msg
            );
            return { ...prev, [selectedContact.id]: updatedMessages };
        });

        // Check for AI mentions in a group chat
        if (selectedContact.isGroup) {
            const groupMembers = selectedContact.memberIds || [];
            AI_PERSONAS.forEach(aiPersona => {
                if (groupMembers.includes(aiPersona.id)) {
                    const mentionTag = `@${aiPersona.name}`;
                    if (userMessage.text.includes(mentionTag)) {
                        const messageForBot = { ...userMessage };
                        messageForBot.text = messageForBot.text.replace(mentionTag, '').trim();
                        triggerAiResponse(aiPersona, messageForBot, { group: selectedContact });
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
    console.log('Reloading contacts from database...');
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
          : `chat/${[user.id, selectedContact.id].sort().join('-')}`;
      
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
      localStorage.removeItem('userProfile'); // Clear user profile as well
      localStorage.removeItem('user'); // Make sure to clear the 'user' item too
      
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

  const handleMouseDown = useCallback((_e: React.MouseEvent) => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (event: MouseEvent) => {
        if (isResizing.current) {
            const newWidth = Math.max(280, Math.min(500, event.clientX));
            setSidebarWidth(newWidth);
        }
    };

    const handleMouseUp = () => {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [setSidebarWidth]);

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

  return (
    <>
      <div className="h-screen w-screen text-slate-800 dark:text-slate-200 flex font-sans antialiased">
        <Sidebar
          style={{ width: `${sidebarWidth}px`}}
          theme={theme}
          contacts={contacts}
          messages={messages}
          unreadCounts={unreadCounts}
          selectedContactId={selectedContactId}
          onSelectContact={handleSelectContact}
          user={user}
          onNewGroup={() => setNewGroupOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          onTogglePin={handleTogglePinContact}
          onInviteUser={() => setInviteModalOpen(true)}
          onFriendRequests={() => setFriendRequestsOpen(true)}
          typingIndicators={typingIndicators}
        />
        <div
            onMouseDown={handleMouseDown}
            className="w-1.5 cursor-col-resize bg-slate-200 dark:bg-slate-800 hover:bg-indigo-300 dark:hover:bg-indigo-700 transition-colors duration-200"
            role="separator"
            aria-label="Resize sidebar"
        />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatView
            contact={selectedContact || undefined}
            currentUser={user}
            contacts={contacts}
            messages={selectedContact ? messages[selectedContact.id] || [] : []}
            isLoading={isLoading}
            typingIndicators={selectedContact ? typingIndicators[selectedContact.id] || {} : {}}
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
          />
        </main>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onUserUpdate={setUser}
        theme={theme}
        onThemeChange={setTheme}
        aiPersonas={AI_PERSONAS}
        contacts={contacts}
        onToggleAiContact={handleToggleAiContact}
      />
      <NewGroupModal
        isOpen={isNewGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        contacts={contacts.filter(c => !c.isGroup && !c.isAi)}
        aiPersonas={AI_PERSONAS}
        onCreateGroup={handleCreateGroup}
      />
      <EditGroupModal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        group={editingGroup}
        contacts={contacts.filter(c => !c.isGroup && !c.isAi)}
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
};

export default App;