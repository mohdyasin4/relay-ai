import React, { useMemo, useCallback } from 'react';
import { cn } from '../lib/utils';
import VirtualizedList from './ui/VirtualizedList';
import LazyImage from './ui/LazyImage';
import type { Contact, Message, MessagesState } from '../types';
import { usePrefetchData } from '@/hooks/useApi';

interface ContactListProps {
  contacts: Contact[];
  messages: MessagesState;
  unreadCounts: Record<string, number>;
  selectedContactId: string | null;
  typingIndicators: Record<string, Record<string, string>>;
  onSelectContact: (contactId: string) => void;
  onTogglePin: (contactId: string) => void;
  className?: string;
  height?: number;
}

// Memoized individual contact item to prevent unnecessary re-renders
const ContactItem = React.memo<{
  contact: Contact;
  lastMessage?: Message;
  unreadCount: number;
  isSelected: boolean;
  isTyping: boolean;
  typingUsers: string;
  onSelect: () => void;
  onTogglePin: () => void;
  onHover: () => void;
  style: React.CSSProperties;
}>(({
  contact,
  lastMessage,
  unreadCount,
  isSelected,
  isTyping,
  typingUsers,
  onSelect,
  onTogglePin,
  onHover,
  style,
}) => {
  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return '';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div
      style={style}
      className={cn(
        'flex items-center p-3 cursor-pointer transition-colors border-b border-slate-200 dark:border-slate-700',
        isSelected
          ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0 mr-3">
        {contact.avatarUrl ? (
          <LazyImage
            src={contact.avatarUrl}
            alt={contact.name}
            className="w-12 h-12 rounded-full"
            sizes="48px"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
            {contact.name.charAt(0).toUpperCase()}
          </div>
        )}
        {/* Status indicator */}
        {!contact.isAi && (
          <div className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900',
            getStatusColor(contact.status || 'offline')
          )} />
        )}
        {/* Pin indicator */}
        {contact.isPinned && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h3 className={cn(
            'font-medium truncate',
            isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-slate-900 dark:text-slate-100',
            unreadCount > 0 && 'font-semibold'
          )}>
            {contact.name}
            {contact.isGroup && (
              <span className="ml-2 text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                Group
              </span>
            )}
          </h3>
          <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
            {lastMessage && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(lastMessage.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Last message or typing indicator */}
        <div className="mt-1">
          {isTyping ? (
            <p className="text-sm text-green-600 dark:text-green-400 italic">
              {typingUsers} typing...
            </p>
          ) : lastMessage ? (
            <p className={cn(
              'text-sm truncate',
              unreadCount > 0 
                ? 'text-slate-700 dark:text-slate-300 font-medium' 
                : 'text-slate-500 dark:text-slate-400'
            )}>
              {lastMessage.senderId && lastMessage.senderName && contact.isGroup && (
                <span className="font-medium mr-1">
                  {lastMessage.senderName}:
                </span>
              )}
              {lastMessage.attachment ? 'Sent an image' : lastMessage.text}
            </p>
          ) : contact.status === 'offline' && contact.lastSeen ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Last seen {formatLastSeen(contact.lastSeen)}
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {contact.status || 'offline'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

const ContactList: React.FC<ContactListProps> = ({
  contacts,
  messages,
  unreadCounts,
  selectedContactId,
  typingIndicators,
  onSelectContact,
  onTogglePin,
  className,
  height = 600,
}) => {
  const { prefetchMessages } = usePrefetchData();
  // Prefetch last 50 messages for hovered contact
  const handleHover = useCallback((contact: Contact) => {
    prefetchMessages(contact.id, !!contact.isGroup, 50);
  }, [prefetchMessages]);
  // Memoize sorted contacts to prevent unnecessary sorting on every render
  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      // Pinned contacts first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // Then sort by last message timestamp
      const aMessages = messages[a.id] || [];
      const bMessages = messages[b.id] || [];
      const aLast = aMessages.length ? new Date(aMessages[aMessages.length - 1].timestamp).getTime() : 0;
      const bLast = bMessages.length ? new Date(bMessages[bMessages.length - 1].timestamp).getTime() : 0;
      
      if (!aLast && !bLast) return 0;
      return bLast - aLast;
    });
  }, [contacts, messages]);

  // Memoize contact data for virtualized list
  const contactsData = useMemo(() => {
    return sortedContacts.map(contact => {
      const contactMessages = messages[contact.id] || [];
      const lastMessage = contactMessages.length > 0 ? contactMessages[contactMessages.length - 1] : undefined;
      const unreadCount = unreadCounts[contact.id] || 0;
      const contactTyping = typingIndicators[contact.id] || {};
      const isTyping = Object.keys(contactTyping).length > 0;
      const typingUsers = Object.values(contactTyping).join(', ');

      return {
        contact,
        lastMessage,
        unreadCount,
        isTyping,
        typingUsers,
      };
    });
  }, [sortedContacts, messages, unreadCounts, typingIndicators]);

  // Render individual contact item
  const renderContactItem = useMemo(() => {
    return (item: typeof contactsData[0], index: number, style: React.CSSProperties) => (
      <ContactItem
        key={item.contact.id}
        contact={item.contact}
        lastMessage={item.lastMessage}
        unreadCount={item.unreadCount}
        isSelected={selectedContactId === item.contact.id}
        isTyping={item.isTyping}
        typingUsers={item.typingUsers}
        onSelect={() => onSelectContact(item.contact.id)}
        onTogglePin={() => onTogglePin(item.contact.id)}
        onHover={() => handleHover(item.contact)}
        style={style}
      />
    );
  }, [selectedContactId, onSelectContact, onTogglePin, handleHover]);

  if (contacts.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8', className)}>
        <div className="text-slate-500 dark:text-slate-400 text-center">
          <p>No contacts yet</p>
          <p className="text-sm mt-1">Start a new chat to begin messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <VirtualizedList
        items={contactsData}
        height={height}
        itemHeight={76} // Fixed height for contact items
        renderItem={renderContactItem}
        itemKey={(index, data) => data[index].contact.id}
        overscan={3}
      />
    </div>
  );
};

export default React.memo(ContactList);
