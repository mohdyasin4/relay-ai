
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Contact, Message, Attachment, User, ReadReceipt, TypingIndicatorPayload } from '../types';
import GeneratedAvatar from './GeneratedAvatar';
import MessageBubble from './MessageBubble';
import SendIcon from './icons/SendIcon';
import AttachIcon from './icons/AttachIcon';
import CloseIcon from './icons/CloseIcon';
import EditIcon from './icons/EditIcon';
import PlusIcon from './icons/PlusIcon';
import CheckIcon from './icons/CheckIcon';
import ChatBubbleLeftRightIcon from './icons/ChatBubbleLeftRightIcon';
import { fileToBase64 } from '../utils/imageUtils';
import { getTimelineDate, formatPresence } from '../utils/dateUtils';
import DateSeparator from './DateSeparator';
import NewMessagesSeparator from './NewMessagesSeparator';
import { mqttService } from '../services/mqttService';
import MentionSuggestions from './MentionSuggestions';

interface ChatViewProps {
  contact: Contact | undefined;
  currentUser: User;
  contacts: Contact[];
  messages: Message[];
  isLoading: boolean;
  typingIndicators: Record<string, string>;
  onSendMessage: (text: string, attachment?: Attachment) => void;
  onImageClick: (url: string) => void;
  onEditGroup: (group: Contact) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward: (message: Message) => void;
  onNewGroup: () => void;
  onInviteUser: () => void;
  onAddAiContact: (contact: Contact) => void;
  aiPersonas: Contact[];
  firstUnreadMessageId: string | null;
}

interface SuggestionState {
    isOpen: boolean;
    query: string;
    suggestions: Contact[];
    triggerIndex: number | null;
    activeIndex: number;
}

const TypingIndicator: React.FC = () => (
  <div className="flex items-center space-x-1.5 p-4">
    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-pulse"></div>
  </div>
);

const ChatView: React.FC<ChatViewProps> = ({ 
    contact, currentUser, contacts, messages, isLoading, typingIndicators, 
    onSendMessage, onImageClick, onEditGroup, onReact, onForward,
    onNewGroup, onInviteUser, onAddAiContact, aiPersonas,
    firstUnreadMessageId
}) => {
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  
  const [suggestionState, setSuggestionState] = useState<SuggestionState>({
    isOpen: false,
    query: '',
    suggestions: [],
    triggerIndex: null,
    activeIndex: 0,
  });

  // Move all hooks to the top before any conditional logic
  const allKnownContacts = useMemo(() => [...contacts, ...aiPersonas], [contacts, aiPersonas]);
  
  const messagesWithDates = useMemo(() => {
    const grouped: (Message | { type: 'date_marker'; id: string; date: string })[] = [];
    let lastDate: string | null = null;

    messages.forEach(message => {
      const messageDate = new Date(message.timestamp);
      const timelineDate = getTimelineDate(messageDate);

      if (timelineDate !== lastDate) {
        grouped.push({ type: 'date_marker', id: `date-${timelineDate}-${message.id}`, date: timelineDate });
        lastDate = timelineDate;
      }
      grouped.push(message);
    });
    return grouped;
  }, [messages]);

  const sendReadReceipt = useCallback(() => {
    if (!contact || contact.isAi || !messages.length || !currentUser) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.senderId !== currentUser.id) {
        const topic = contact.isGroup 
            ? `chat/${contact.id}` 
            : `chat/${[currentUser.id, contact.id].sort().join('-')}`;
        
        const payload: ReadReceipt = {
            type: 'read_receipt',
            contactId: contact.id,
            readerId: currentUser.id,
        };
        mqttService.publish(topic, payload);
    }
  }, [contact, currentUser, messages]);

  useEffect(() => {
    if (separatorRef.current) {
        separatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, typingIndicators, firstUnreadMessageId]);
  
  useEffect(() => {
      setInputText('');
      setAttachment(null);
      setSuggestionState(p => ({...p, isOpen: false}));
  }, [contact]);
  
  useEffect(() => {
    if (!contact || contact.isAi || !messages.length || !currentUser) {
        return;
    }
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.senderId !== currentUser.id) {
        const topic = contact.isGroup 
            ? `chat/${contact.id}` 
            : `chat/${[currentUser.id, contact.id].sort().join('-')}`;
        
        const payload: ReadReceipt = {
            type: 'read_receipt',
            contactId: contact.id,
            readerId: currentUser.id,
        };
        mqttService.publish(topic, payload);
    }
  }, [messages, contact, currentUser]);

  useEffect(() => {
    return () => {
        if (typingTimeoutRef.current && contact && !contact.isAi && currentUser) {
             clearTimeout(typingTimeoutRef.current);
             const topic = contact.isGroup 
                ? `chat/${contact.id}` 
                : `chat/${[currentUser.id, contact.id].sort().join('-')}`;
            const payload: TypingIndicatorPayload = { type: 'typing', contactId: contact.id, userId: currentUser.id, userName: currentUser.name, state: 'stop' };
            mqttService.publish(topic, payload);
             typingTimeoutRef.current = null;
        }
    }
  }, [contact, currentUser]);

  useEffect(() => {
    sendReadReceipt();
  }, [sendReadReceipt]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const url = await fileToBase64(file);
        setAttachment({ type: 'image', file, url });
    }
    if(fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursorPosition = e.target.selectionStart;

    setInputText(text);
    
    // MENTION LOGIC
    if (contact?.isGroup) {
        const textUpToCursor = text.substring(0, cursorPosition);
        const triggerIndex = textUpToCursor.lastIndexOf('@');
        const precedingChar = textUpToCursor.charAt(triggerIndex - 1);
        const isValidTrigger = triggerIndex === 0 || /\s/.test(precedingChar);

        if (triggerIndex !== -1 && isValidTrigger) {
            const query = text.substring(triggerIndex + 1, cursorPosition);
            
            if (!/\s/.test(query)) {
                const members = (contact.memberIds || [])
                    .map(id => [...contacts, ...aiPersonas].find(c => c.id === id))
                    .filter((c): c is Contact => !!c && c.id !== currentUser.id);

                const filteredSuggestions = members.filter(member => 
                    member.name.toLowerCase().startsWith(query.toLowerCase())
                );
                
                if (filteredSuggestions.length > 0) {
                    setSuggestionState({
                        isOpen: true,
                        query: query,
                        suggestions: filteredSuggestions,
                        triggerIndex: triggerIndex,
                        activeIndex: 0,
                    });
                } else {
                   setSuggestionState(p => ({ ...p, isOpen: false }));
                }
            } else {
                setSuggestionState(p => ({ ...p, isOpen: false }));
            }
        } else {
            setSuggestionState(p => ({ ...p, isOpen: false }));
        }
    }
    
    if (!contact || contact.isAi) return;

    const topic = contact.isGroup 
        ? `chat/${contact.id}` 
        : `chat/${[currentUser.id, contact.id].sort().join('-')}`;

    const publishTyping = (state: 'start' | 'stop') => {
        const payload: TypingIndicatorPayload = { type: 'typing', contactId: contact.id, userId: currentUser.id, userName: currentUser.name, state };
        mqttService.publish(topic, payload);
    };

    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    } else {
        publishTyping('start');
    }

    typingTimeoutRef.current = window.setTimeout(() => {
        publishTyping('stop');
        typingTimeoutRef.current = null;
    }, 2500);
  };
  
  const handleSelectMention = (member: Contact) => {
    if (suggestionState.triggerIndex === null || !inputRef.current) return;
    
    const text = inputText;
    const selectionStart = inputRef.current.selectionStart;
    
    const textBefore = text.substring(0, suggestionState.triggerIndex);
    const textAfter = text.substring(selectionStart);
    
    const newText = `${textBefore}@${member.name} ${textAfter}`;
    
    setInputText(newText);
    setSuggestionState({ isOpen: false, query: '', suggestions: [], triggerIndex: null, activeIndex: 0 });

    setTimeout(() => {
        const newCursorPos = (suggestionState.triggerIndex || 0) + member.name.length + 2;
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };
  
  const renderHighlightedText = (text: string): string => {
    if (!contact?.isGroup) return escapeHtml(text);

    const memberNames = (contact.memberIds || [])
        .map(id => [...contacts, ...aiPersonas].find(c => c.id === id)?.name)
        .filter((name): name is string => !!name)
        .sort((a, b) => b.length - a.length);

    if (memberNames.length === 0) return escapeHtml(text);
    
    // Split by the regex but keep the delimiters
    const parts = text.split(new RegExp(`(@(?:${memberNames.map(escapeRegex).join('|')}))(?![\\w])`, 'g'));

    return parts.map(part => {
        const isMention = part.startsWith('@') && memberNames.includes(part.substring(1));
        if (isMention) {
            return `<span class="mention-highlight">${escapeHtml(part)}</span>`;
        }
        return escapeHtml(part);
    }).join('');
  };
  
  const escapeRegex = (string: string) => {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  const escapeHtml = (text: string) => {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (typingTimeoutRef.current && contact && !contact.isAi && currentUser) {
        clearTimeout(typingTimeoutRef.current);
        const topic = contact.isGroup 
            ? `chat/${contact.id}` 
            : `chat/${[currentUser.id, contact.id].sort().join('-')}`;
        const payload: TypingIndicatorPayload = { type: 'typing', contactId: contact.id, userId: currentUser.id, userName: currentUser.name, state: 'stop' };
        mqttService.publish(topic, payload);
        typingTimeoutRef.current = null;
    }

    if ((inputText.trim() || attachment) && !isLoading) {
      onSendMessage(inputText.trim(), attachment || undefined);
      setInputText('');
      setAttachment(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestionState.isOpen && suggestionState.suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSuggestionState(prev => ({
                ...prev,
                activeIndex: (prev.activeIndex + 1) % prev.suggestions.length,
            }));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSuggestionState(prev => ({
                ...prev,
                activeIndex: (prev.activeIndex - 1 + prev.suggestions.length) % prev.suggestions.length,
            }));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            handleSelectMention(suggestionState.suggestions[suggestionState.activeIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setSuggestionState(prev => ({ ...prev, isOpen: false }));
        }
    } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
    }
  };


  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900 overflow-y-auto p-4 md:p-8">
        <div className="text-center max-w-2xl w-full animate-[fade-in_0.5s]">
          <div className="inline-block p-4 bg-indigo-100 dark:bg-indigo-900/40 rounded-full mb-6">
            <ChatBubbleLeftRightIcon className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Welcome, {currentUser.name}!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
            Select a conversation from the sidebar or start a new one.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button
              onClick={onInviteUser}
              className="flex-1 text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 dark:focus:ring-indigo-800 font-medium rounded-lg text-base px-6 py-3.5 text-center transition-colors"
            >
              Invite a Friend
            </button>
            <button
              onClick={onNewGroup}
              className="flex-1 text-slate-900 bg-slate-200 hover:bg-slate-300 focus:ring-4 focus:outline-none focus:ring-slate-300 font-medium rounded-lg text-base px-6 py-3.5 text-center dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 dark:focus:ring-slate-700 transition-colors"
            >
              Create a Group
            </button>
          </div>

          <div className="text-left">
            <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-4">Or, chat with an AI assistant</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiPersonas.map(persona => {
                const isAdded = contacts.some(c => c.id === persona.id);
                return (
                  <div key={persona.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg flex items-center gap-4 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                    <GeneratedAvatar name={persona.name} allContacts={[...aiPersonas, ...contacts]} currentUser={currentUser} />
                    <div className="flex-1 text-left overflow-hidden">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">{persona.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {persona.systemInstruction?.split('.')[0]}.
                      </p>
                    </div>
                    <button
                      onClick={() => onAddAiContact(persona)}
                      disabled={isAdded}
                      className="p-2 rounded-full text-slate-600 dark:text-slate-400 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-pointer"
                      aria-label={isAdded ? `${persona.name} is already added` : `Add ${persona.name}`}
                    >
                      {isAdded ? <CheckIcon className="w-5 h-5 text-green-500" /> : <PlusIcon className="w-5 h-5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAiTyping = contact?.isAi && isLoading && messages[messages.length-1]?.senderId === contact.id;
  const typingUserNames = Object.values(typingIndicators);
  const isUserTyping = contact && !contact.isAi && typingUserNames.length > 0;
  
  const getMemberNames = () => {
    if (!contact.isGroup) return null;
    return (contact.memberIds || [])
        .map(id => {
            if (id === currentUser.id) return "You";
            return allKnownContacts.find(c => c.id === id)?.name || id;
        })
        .filter((name): name is string => !!name)
        .join(', ');
  }

  const renderPresence = () => {
    if (contact.isGroup) {
        return <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{getMemberNames()}</p>;
    }

    const presenceText = formatPresence(contact);
    const statusColor = contact.status === 'online' 
      ? 'bg-green-500' 
      : contact.status === 'away' ? 'bg-amber-500' : 'hidden';

    return (
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{presenceText}</p>
        </div>
    );
  }


  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900">
      <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
        <GeneratedAvatar 
            name={contact.name} 
            isGroup={contact.isGroup} 
            memberIds={contact.memberIds} 
            creatorId={contact.creatorId}
            allContacts={allKnownContacts}
            currentUser={currentUser}
        />
        <div className="flex-1 overflow-hidden">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{contact.name}</h2>
            {renderPresence()}
        </div>
        {contact.isGroup && (
            <button
                onClick={() => onEditGroup(contact)}
                className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Edit group"
            >
                <EditIcon className="w-5 h-5" />
            </button>
        )}
      </header>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          {messagesWithDates.map((item) => {
            if ('type' in item && item.type === 'date_marker') {
              return <DateSeparator key={item.id} date={item.date} />;
            }
            const msg = item as Message;
            const showSeparator = msg.id === firstUnreadMessageId;

            return (
                <React.Fragment key={msg.id}>
                    {showSeparator && <div ref={separatorRef}><NewMessagesSeparator /></div>}
                    <MessageBubble 
                        message={msg} 
                        currentUser={currentUser} 
                        isGroup={contact.isGroup}
                        onImageClick={onImageClick} 
                        onReact={onReact} 
                        onForward={onForward} 
                        allContacts={allKnownContacts}
                    />
                </React.Fragment>
            );
          })}
          {isAiTyping && (
             <div className="flex justify-start">
               <div className="flex items-start gap-2.5">
                <GeneratedAvatar name={contact.name} isGroup={contact.isGroup} memberIds={contact.memberIds} allContacts={allKnownContacts} currentUser={currentUser} />
                <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl rounded-bl-lg">
                    <TypingIndicator/>
                </div>
               </div>
            </div>
          )}
          {isUserTyping && (
             <div className="flex justify-start">
               <div className="flex items-start gap-2.5">
                <GeneratedAvatar name={typingUserNames[0]} allContacts={allKnownContacts} currentUser={currentUser} />
                <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl rounded-bl-lg">
                    <TypingIndicator/>
                </div>
               </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
        {attachment && (
            <div className="relative w-24 h-24 mb-2 p-1 border border-slate-300 dark:border-slate-700 rounded-lg">
                <img src={attachment.url} alt="Attachment preview" className="w-full h-full object-cover rounded"/>
                <button 
                    onClick={() => setAttachment(null)}
                    className="absolute -top-2 -right-2 bg-slate-700 text-white rounded-full p-0.5 hover:bg-slate-600"
                    aria-label="Remove attachment"
                >
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-start gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-3 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 self-end"
            aria-label="Attach file"
          >
            <AttachIcon className="w-6 h-6" />
          </button>
          
          <div className="chat-input-container">
            {suggestionState.isOpen && (
              <MentionSuggestions
                suggestions={suggestionState.suggestions}
                onSelect={handleSelectMention}
                activeIndex={suggestionState.activeIndex}
                currentUser={currentUser}
                allContacts={allKnownContacts}
              />
            )}
            <div
                className="chat-input-backdrop bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                dangerouslySetInnerHTML={{ __html: renderHighlightedText(inputText) }}
            />
            <textarea
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="chat-input border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500"
                disabled={isLoading}
                rows={1}
                autoComplete="off"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading || (!inputText.trim() && !attachment)}
            className="bg-indigo-600 text-white rounded-lg p-3 disabled:bg-indigo-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors self-end"
             aria-label="Send message"
          >
            <SendIcon className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
