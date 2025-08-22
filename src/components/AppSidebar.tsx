import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import type { Contact, MessagesState, User } from '../types';
import {
  Sidebar as ShSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import GeneratedAvatar from './GeneratedAvatar';
import { NavUser } from './NavUser';
import { Pin, PlusIcon, X } from 'lucide-react';
import SearchIcon from './icons/SearchIcon';
import CloseIcon from './icons/CloseIcon';
// import TypingIndicator from './icons/TypingIndicator';
import { DateUtils } from '@/utils/dateUtils';
import { Loader } from './ui/loader';

interface AppSidebarProps extends React.ComponentProps<typeof ShSidebar> {
  contacts: Contact[];
  messages: MessagesState;
  unreadCounts: Record<string, number>;
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  user: User;
  onNewGroup: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onTogglePin: (id: string) => void;
  onFriendRequests: () => void;
  typingIndicators: Record<string, Record<string, string>>;
  pendingFriendRequestsCount?: number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  contacts,
  messages,
  unreadCounts,
  selectedContactId,
  onSelectContact,
  user,
  onNewGroup,
  onSettings,
  onLogout,
  onTogglePin,
  onFriendRequests,
  typingIndicators,
  pendingFriendRequestsCount = 0,
  isLoading = false,
  error = null,
  onRetry,
  onClose,
  ...sidebarProps
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const prevUnreadRef = useRef<Record<string, number>>({});
  const lastClickTime = useRef<number>(0);

  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      // Reserved for future dropdowns/popovers
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const lower = searchTerm.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(lower));
  }, [contacts, searchTerm]);

  useEffect(() => {
    prevUnreadRef.current = unreadCounts;
  }, [unreadCounts]);

  // Optimized contact selection handler
  const handleContactClick = useCallback((contactId: string) => {
    const now = Date.now();
    // Prevent rapid clicks
    if (now - lastClickTime.current < 300) {
      return;
    }
    lastClickTime.current = now;
    
    // Call the parent handler
    onSelectContact(contactId);
  }, [onSelectContact]);

  // Helper function to get last message preview text
  const getLastMessagePreview = useCallback((lastMessage: any) => {
    if (!lastMessage) return 'Start a conversation...';
    if (lastMessage.isForwarded) return 'Forwarded Message';
    
    // Handle attachments - check both attachments array and single attachment
    let attachmentType: string | null = null;
    
    // Check attachments array first
    if (lastMessage.attachments) {
      try {
        const parsedAttachments = typeof lastMessage.attachments === 'string' 
          ? JSON.parse(lastMessage.attachments) 
          : lastMessage.attachments;
        
        if (Array.isArray(parsedAttachments) && parsedAttachments.length > 0) {
          const lastAttachment = parsedAttachments[parsedAttachments.length - 1];
          if (lastAttachment.type === 'image') {
            attachmentType = '🖼️ Image';
          } else if (lastAttachment.type === 'video') {
            attachmentType = '🎥 Video';
          } else if (lastAttachment.type === 'audio') {
            attachmentType = '🎵 Audio';
          } else {
            attachmentType = '📄 Document';
          }
        }
      } catch (error) {
        console.error('Error parsing attachments JSON:', error);
      }
    }
    
    // If no attachment type found, check single attachment
    if (!attachmentType && lastMessage.attachment && !lastMessage.isForwarded) {
      if (lastMessage.attachment.type === 'image') {
        attachmentType = '🖼️ Image';
      } else if (lastMessage.attachment.type === 'video') {
        attachmentType = '🎥 Video';
      } else if (lastMessage.attachment.type === 'audio') {
        attachmentType = '🎵 Audio';
      } else {
        attachmentType = '📄 Document';
      }
    }
    
    // Return attachment type if found, otherwise return text or default
    if (attachmentType) return attachmentType;
    if (lastMessage.text && !lastMessage.isForwarded) return lastMessage.text;
    return '';
  }, []);

  // Memoize contact groups to prevent unnecessary re-renders
  const contactGroups = useMemo(() => {
    const pinned = filteredContacts.filter(c => !!c.isPinned);
    const unread = filteredContacts.filter(c => !c.isPinned && (unreadCounts[c.id] || 0) > 0);
    const others = filteredContacts.filter(c => !c.isPinned && (unreadCounts[c.id] || 0) === 0);
    
    return { pinned, unread, others };
  }, [filteredContacts, unreadCounts]);

  // Memoize contact list rendering
  const renderContactList = useCallback((list: Contact[]) => (
    <ul>
      {list.map((contact) => {
        const contactMessages = messages[contact.id] || [];
        const lastMessage = contactMessages[contactMessages.length - 1];
        const isSelected = contact.id === selectedContactId;
        const unreadCount = unreadCounts[contact.id] || 0;
        const isUnread = unreadCount > 0;
        const prevUnread = prevUnreadRef.current[contact.id] || 0;
        const trend = unreadCount > prevUnread ? 'up' : unreadCount < prevUnread ? 'down' : 'same';

        return (
          <li key={contact.id} className="group/contact relative">
            <motion.button
              onClick={() => handleContactClick(contact.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -1, scale: 1.01 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`w-full text-left p-3 flex items-start gap-3 cursor-pointer rounded-xl border shadow-sm ${
                isSelected
                  ? 'bg-primary/10 border-primary/40 text-foreground'
                  : isUnread
                  ? 'bg-muted/60 border-border/50'
                  : 'hover:bg-muted/50 border-transparent'
              }`}
              aria-current={isSelected}
            >
              <div className="relative">
                <GeneratedAvatar
                  name={contact.name}
                  isGroup={contact.isGroup}
                  memberIds={contact.memberIds}
                  creatorId={contact.creatorId}
                  allContacts={contacts}
                  currentUser={user}
                  showOnlineStatus={!contact.isGroup}
                  onlineStatus={contact.isAi ? 'online' : 'online'}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center">
                  {contact.isPinned && (
                    <Pin  className="w-4 h-4 mr-1.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                  )}
                  <h2 className={`font-semibold truncate text-base ${isSelected ? '' : ''}`}>{contact.name}</h2>
                </div>
                <p className={`text-sm truncate flex-1 pt-1 ${isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {typingIndicators[contact.id] && Object.keys(typingIndicators[contact.id]).length > 0 ? (
                    <span className="flex items-center gap-2">
                      <span className="italic">
                        {Object.keys(typingIndicators[contact.id]).length === 1 
                          ? `${Object.values(typingIndicators[contact.id])[0]} is typing`
                          : `${Object.values(typingIndicators[contact.id]).slice(0, 2).join(', ')}${Object.keys(typingIndicators[contact.id]).length > 2 ? ' and others' : ''} are typing`
                        }
                      </span>
                    </span>
                  ) : (
                    getLastMessagePreview(lastMessage)
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                <span className={`text-xs ${isUnread ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  {lastMessage ? DateUtils.formatSidebarTime(lastMessage.timestamp) : ''}
                </span>
                {unreadCount > 0 ? (
                  <motion.span
                    key={`badge-${unreadCount}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={trend === 'up' ? { scale: [1, 1.15, 1], opacity: 1 } : trend === 'down' ? { scale: [1, 0.9, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow-sm ring-1 ring-primary/30"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                ) : (
                  <div className="h-5 w-5" />
                )}
              </div>
            </motion.button>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(contact.id);
              }}
              className={`absolute right-2 bottom-2  p-1.5 rounded-xl transition-opacity opacity-0 group-hover/contact:opacity-100 focus:opacity-100`}
              aria-label={contact.isPinned ? 'Unpin contact' : 'Pin contact'}
            >
              <motion.span whileTap={{ scale: 0.85 }}>
                <Pin className={`w-4 h-4  transition-all duration-200 ${contact.isPinned ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
              </motion.span>
            </div>
          </li>
        );
      })}
    </ul>
  ), [messages, selectedContactId, unreadCounts, typingIndicators, contacts, user, handleContactClick, onTogglePin]);

  return (
    <ShSidebar collapsible="offcanvas" variant="inset" className="md:relative sidebar-mobile-full" {...sidebarProps}>
      <SidebarHeader>
        <div className="flex items-center justify-between px-2">
          <NavUser
            user={{ name: user.name, email: user.email, avatar: user.avatarUrl || '' }}
            onSettings={onSettings}
            onLogout={onLogout}
            onNotifications={onFriendRequests}
            pendingNotifications={pendingFriendRequestsCount}
            isMobile={false}
            showOnlineStatus={true}
          />
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 pt-2">
              <Button onClick={onNewGroup} variant="default" className="w-full hidden md:flex" aria-label="Start a new chat">
                <PlusIcon className="w-5 h-5 inline-block mr-1" />
                New Chat
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <Input
              placeholder="Search or start new chat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl"
              aria-label="Search contacts"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                aria-label="Clear search"
              >
                <CloseIcon className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>
      </SidebarHeader>
     <SidebarContent>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
          {isLoading ? (
            <div className="flex h-full w-full justify-center items-center">
              <div className="flex flex-col items-center justify-center space-y-2">
                <Loader className="h-6 w-6" variant='circular' />
                <h2 className="text-lg text-muted-foreground text-center">Loading contacts...</h2>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-10 px-4">
              <p className="font-medium text-destructive mb-2">{error}</p>
              {onRetry && (
                <Button variant="outline" onClick={onRetry}>Retry</Button>
              )}
            </div>
          ) : filteredContacts.length > 0 ? (
            <>
              {contactGroups.pinned.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Pinned</SidebarGroupLabel>
                  <SidebarGroupContent>{renderContactList(contactGroups.pinned)}</SidebarGroupContent>
                </SidebarGroup>
              )}
              {contactGroups.unread.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Unread</SidebarGroupLabel>
                  <SidebarGroupContent>{renderContactList(contactGroups.unread)}</SidebarGroupContent>
                </SidebarGroup>
              )}
              {contactGroups.others.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>All Chats</SidebarGroupLabel>
                  <SidebarGroupContent>{renderContactList(contactGroups.others)}</SidebarGroupContent>
                </SidebarGroup>
              )}
            </>
          ) : (
            <div className="text-center py-10 px-4">
              <p className="font-medium text-muted-foreground">No contacts found</p>
              <p className="text-sm text-muted-foreground/80 mt-1">Try a different search term.</p>
            </div>
          )}
        </div>
      </SidebarContent>
      {/* Footer intentionally left empty per request: single profile entry in header */}
    </ShSidebar>
  );
};

export default AppSidebar;


