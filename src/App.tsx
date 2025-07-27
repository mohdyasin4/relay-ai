import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import Onboarding from './components/Onboarding';
import SettingsModal from './components/SettingsModal';
import NewGroupModal from './components/NewGroupModal';
import EditGroupModal from './components/EditGroupModal';
import Lightbox from './components/Lightbox';
import ForwardMessageModal from './components/ForwardMessageModal';
import InviteUserModal from './components/InviteUserModal';
import { sendMessageToBot } from './services/geminiService';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Contact, Message, MessagesState, User, Attachment, Theme, MqttPayload, Invitation, ReadReceipt, TypingIndicatorPayload, ReactionPayload } from './types';
import { CONTACTS, AI_PERSONAS } from './constants';
import { mqttService } from './services/mqttService';

const App: React.FC = () => {
  const [user, setUser] = useLocalStorage<User | null>('userProfile', null);
  const [hasOnboarded, setHasOnboarded] = useLocalStorage<boolean>('hasOnboarded', false);
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'dark');
  const [sidebarWidth, setSidebarWidth] = useLocalStorage<number>('sidebarWidth', 320);

  const [contacts, setContacts] = useLocalStorage<Contact[]>('contacts', CONTACTS);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messages, setMessages] = useLocalStorage<MessagesState>('messages', {});
  const [unreadCounts, setUnreadCounts] = useLocalStorage<Record<string, number>>('unreadCounts', {});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [typingIndicators, setTypingIndicators] = useState<Record<string, Record<string, string>>>({});
  
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);

  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isNewGroupOpen, setNewGroupOpen] = useState(false);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
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
                id: `quote-request-${crypto.randomUUID()}`,
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
                    id: crypto.randomUUID(),
                    contactId: quoteBot.id,
                    text: fullResponse.trim(),
                    senderId: quoteBot.id,
                    senderName: quoteBot.name,
                    timestamp: new Date(),
                };

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

  const handleMqttPayload = useCallback((payload: MqttPayload, topic: string) => {
    console.log('Received MQTT Payload:', payload, 'on topic:', topic);

    // --- Unified Presence Update ---
    const getSenderId = (p: MqttPayload): string | undefined => {
        if (p.type === 'chat') return (p as Message).senderId;
        if (p.type === 'typing') return (p as TypingIndicatorPayload).userId;
        if (p.type === 'read_receipt') return (p as ReadReceipt).readerId;
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
    else if (payload.type === 'chat') {
      const message = payload as Message;
      const contactId = message.isGroup 
            ? message.contactId 
            : (message.senderId === user?.id ? message.contactId : message.senderId);

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
                if (msg.senderId === user?.id && msg.status !== 'read') {
                    changed = true;
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
                    if (action === 'add' && !reactions.includes(emoji)) {
                        changed = true;
                        return { ...msg, reactions: [...reactions, emoji] };
                    }
                    if (action === 'remove') {
                        const newReactions = reactions.filter(r => r !== emoji);
                        if (newReactions.length !== reactions.length) {
                           changed = true;
                        }
                        return { ...msg, reactions: newReactions };
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
    if (hasOnboarded && user) {
        mqttService.connect(user);
        mqttService.addListener(handleMqttPayload);

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

        return () => {
            mqttService.removeListener(handleMqttPayload);
            mqttService.disconnect();
        };
    }
  }, [hasOnboarded, user, contacts, handleMqttPayload]);

  const selectedContact = useMemo(() =>
    contacts.find(c => c.id === selectedContactId),
    [contacts, selectedContactId]
  );

  const handleSelectContact = useCallback((contactId: string) => {
    setSelectedContactId(contactId);
    
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
  }, [setUnreadCounts, unreadCounts, messages]);

  const triggerAiResponse = useCallback(async (aiContact: Contact, userMessage: Message, groupContext?: { group: Contact }) => {
    setIsLoading(true); // Maybe use a more granular loading state in the future
    const aiMessageId = crypto.randomUUID();
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

  const handleSendMessage = useCallback(async (text: string, attachment?: Attachment) => {
    if (!selectedContact || isLoading || !user) return;

    let attachmentForMessage: Message['attachment'] | undefined;

    if (attachment?.file) {
      attachmentForMessage = { type: 'image', url: attachment.url };
    }

    const userMessage: Message = {
      type: 'chat',
      id: crypto.randomUUID(),
      contactId: selectedContact.id,
      text,
      senderId: user.id,
      senderName: user.name,
      timestamp: new Date(),
      status: 'sent',
      isGroup: !!selectedContact.isGroup,
      ...(attachmentForMessage && { attachment: attachmentForMessage }),
    };

    setMessages(prev => ({
      ...prev,
      [selectedContact.id]: [
        ...(prev[selectedContact.id] || []),
        userMessage
      ],
    }));

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

  const handleCreateGroup = (name: string, members: string[]) => {
    if (!user) return;
    const newGroup: Contact = {
        id: crypto.randomUUID(),
        name,
        isGroup: true,
        isAi: false,
        creatorId: user.id,
        memberIds: [...new Set([user.id, ...members])],
        status: 'online',
    };
    
    // 1. Add group locally
    setContacts(prev => [newGroup, ...prev]);

    // 2. Subscribe to the group topic
    const topic = `chat/${newGroup.id}`;
    mqttService.subscribe(topic);
    
    // 3. Send invitations to all human members
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
  }

  const handleUpdateGroup = (groupId: string, name: string, memberIds: string[]) => {
      setContacts(prev => prev.map(c => {
        if (c.id === groupId) {
          return { ...c, name, memberIds: [...new Set([user!.id, ...memberIds])] };
        }
        return c;
      }));
      setEditingGroup(null);
  };

  const handleTogglePinContact = useCallback((contactId: string) => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isPinned: !c.isPinned } : c));
  }, [setContacts]);

  const handleReactToMessage = useCallback((messageId: string, emoji: string) => {
    if (!selectedContactId || !user || !selectedContact) return;

    const message = messages[selectedContactId]?.find(m => m.id === messageId);
    const action = message?.reactions?.includes(emoji) ? 'remove' : 'add';

    // Optimistically update local state
    setMessages(prev => {
      const contactMessages = prev[selectedContactId] || [];
      const updatedMessages = contactMessages.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || [];
          return reactions.includes(emoji)
            ? { ...msg, reactions: reactions.filter(r => r !== emoji) }
            : { ...msg, reactions: [...reactions, emoji] };
        }
        return msg;
      });
      return { ...prev, [selectedContactId]: updatedMessages };
    });

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

    setForwardingMessage(null);
    
    const targetContact = contacts.find(c => c.id === targetContactId);
    if (!targetContact) return;

    handleSelectContact(targetContactId);

    let attachment: Attachment | undefined;
    if (originalAttachment) {
      attachment = {
        type: 'image',
        url: originalAttachment.url
      };
    }
    
    handleSendMessage(originalText, attachment);

  }, [forwardingMessage, contacts, setMessages, setIsLoading, setSelectedContactId, user, handleSendMessage, handleSelectContact]);
  
  const handleInviteUser = useCallback((newUserToInvite: Contact) => {
    if (!user) return;
    if (contacts.some(c => c.id === newUserToInvite.id)) {
        alert("This contact is already in your list.");
        return;
    }

    // 1. Add contact locally
    setContacts(prev => [newUserToInvite, ...prev]);

    // 2. Define shared topic and subscribe
    const chatTopic = `chat/${[user.id, newUserToInvite.id].sort().join('-')}`;
    mqttService.subscribe(chatTopic);

    // 3. Create invitation payload
    const invitation: Invitation = {
        type: 'invitation',
        topic: chatTopic,
        // The contact object for the inviter (me)
        contact: {
            id: user.id,
            name: user.name,
            isAi: false,
            status: 'online', 
        }
    };
    
    // 4. Publish invitation to the invitee's personal topic
    const inviteeTopic = `user/${newUserToInvite.id}`;
    mqttService.publish(inviteeTopic, invitation);

    setInviteModalOpen(false);
    setSelectedContactId(newUserToInvite.id);
  }, [user, contacts, setContacts]);
  
  const handleAddAiContact = useCallback((aiContact: Contact) => {
    // If contact already exists, just select it
    if (contacts.some(c => c.id === aiContact.id)) {
        setSelectedContactId(aiContact.id);
        return;
    }
    // Otherwise, add it to the list and then select it
    const newContactWithStatus = { ...aiContact, status: 'online' as const };
    setContacts(prev => [newContactWithStatus, ...prev]);
    setSelectedContactId(aiContact.id);
  }, [contacts, setContacts]);
  
  const handleToggleAiContact = useCallback((aiContactId: string, shouldBeEnabled: boolean) => {
    setContacts(prevContacts => {
        const contactExists = prevContacts.some(c => c.id === aiContactId);

        if (shouldBeEnabled && !contactExists) {
            // Add the contact
            const contactToAdd = AI_PERSONAS.find(p => p.id === aiContactId);
            if (contactToAdd) {
                return [...prevContacts, contactToAdd];
            }
        } else if (!shouldBeEnabled && contactExists) {
            // Remove the contact, but also check if it's the currently selected one
            if (selectedContactId === aiContactId) {
                setSelectedContactId(null);
            }
            return prevContacts.filter(c => c.id !== aiContactId);
        }
        // No change needed
        return prevContacts;
    });
  }, [setContacts, selectedContactId]);

  const handleLogout = useCallback(() => {
    // Keep user profile for quicker login, but clear session data.
    localStorage.removeItem('hasOnboarded');
    localStorage.removeItem('contacts');
    localStorage.removeItem('messages');
    localStorage.removeItem('unreadCounts');
    localStorage.removeItem('theme');
    localStorage.removeItem('sidebarWidth');
    mqttService.disconnect();
    window.location.reload();
  }, []);

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


  if (!hasOnboarded || !user) {
    return <Onboarding onComplete={(newUser) => {
      setUser(newUser);
      setHasOnboarded(true);
      // Don't auto-select a contact, let the welcome screen show.
    }} />;
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
        />
        <div
            onMouseDown={handleMouseDown}
            className="w-1.5 cursor-col-resize bg-slate-200 dark:bg-slate-800 hover:bg-indigo-300 dark:hover:bg-indigo-700 transition-colors duration-200"
            role="separator"
            aria-label="Resize sidebar"
        />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatView
            contact={selectedContact}
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
        onInvite={handleInviteUser}
        existingContacts={contacts}
      />
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        contacts={contacts}
        onForward={handleForwardMessage}
        currentUser={user}
      />
      {lightboxImage && (
        <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </>
  );
};

export default App;