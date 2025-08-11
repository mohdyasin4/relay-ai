import React, { useMemo, useState, useEffect } from 'react';
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
import { Pin, PlusIcon } from 'lucide-react';
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
  ...sidebarProps
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // const userMenuRef = useRef<HTMLDivElement>(null);

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

  return (
    <ShSidebar collapsible="offcanvas" variant="sidebar" {...sidebarProps}>
      <SidebarHeader>
        <NavUser
          user={{ name: user.name, email: user.email, avatar: user.avatarUrl || '' }}
          onSettings={onSettings}
          onLogout={onLogout}
          onNotifications={onFriendRequests}
          pendingNotifications={pendingFriendRequestsCount}
        />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 pt-2">
              <Button onClick={onNewGroup} className="w-full" aria-label="Start a new chat">
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
              className="pl-10"
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
              {(() => {
                const pinned = filteredContacts.filter(c => !!c.isPinned);
                const unread = filteredContacts.filter(c => !c.isPinned && (unreadCounts[c.id] || 0) > 0);
                const others = filteredContacts.filter(c => !c.isPinned && (unreadCounts[c.id] || 0) === 0);

                const renderList = (list: Contact[]) => (
                  <ul>
                    {list.map((contact) => {
                const contactMessages = messages[contact.id] || [];
                const lastMessage = contactMessages[contactMessages.length - 1];
                const isSelected = contact.id === selectedContactId;
                const unreadCount = unreadCounts[contact.id] || 0;
                const isUnread = unreadCount > 0;

                      return (
                        <li key={contact.id} className="group relative">
                    <button
                      onClick={() => onSelectContact(contact.id)}
                      className={`w-full text-left p-3 flex items-start gap-3 rounded-lg transition-colors duration-200 ${
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
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
                        />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center">
                          {contact.isPinned && (
                            <Pin fill={contact.isPinned ? 'currentColor' : 'none'} className="w-4 h-4 mr-1.5 text-primary flex-shrink-0" />
                          )}
                          <h2 className={`font-semibold truncate text-base ${isSelected ? '' : ''}`}>{contact.name}</h2>
                        </div>
                        <p className={`text-sm truncate flex-1 pt-1 ${isUnread ? 'font-bold' : 'text-muted-foreground'}`}>
                          {typingIndicators[contact.id] && Object.keys(typingIndicators[contact.id]).length > 0 ? (
                            <span className="flex items-center gap-2">
                                  <span className="italic">{Object.values(typingIndicators[contact.id])[0]} is typing</span>
                            </span>
                          ) : lastMessage?.isForwarded ? (
                            'Forwarded Message'
                          ) : lastMessage?.attachment && !lastMessage.isForwarded ? (
                            '📷 Image'
                          ) : !lastMessage?.isForwarded && lastMessage?.text ? (
                            lastMessage.text
                          ) : !lastMessage ? (
                            'Start a conversation...'
                          ) : (
                            ''
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                        <span className={`text-xs ${isUnread ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {lastMessage ? DateUtils.formatSidebarTime(lastMessage.timestamp) : ''}
                        </span>
                        {unreadCount > 0 ? (
                          <span className="bg-primary text-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        ) : (
                          <div className="h-5 w-5" />
                        )}
                      </div>
                    </button>
                    <Button
                      variant={'ghost'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(contact.id);
                      }}
                      className={`absolute right-2 bottom-2 p-1.5 rounded-xl transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100`}
                      aria-label={contact.isPinned ? 'Unpin contact' : 'Pin contact'}
                    >
                      <Pin className={`w-5 h-5 ${contact.isPinned ? 'text-primary' : 'text-muted-foreground'}`} fill={contact.isPinned ? 'currentColor' : 'none'} />
                    </Button>
                        </li>
                      );
                    })}
                  </ul>
                );

                return (
                  <>
                    {pinned.length > 0 && (
                      <SidebarGroup>
                        <SidebarGroupLabel>Pinned</SidebarGroupLabel>
                        <SidebarGroupContent>{renderList(pinned)}</SidebarGroupContent>
                      </SidebarGroup>
                    )}
                    {unread.length > 0 && (
                      <SidebarGroup>
                        <SidebarGroupLabel>Unread</SidebarGroupLabel>
                        <SidebarGroupContent>{renderList(unread)}</SidebarGroupContent>
                      </SidebarGroup>
                    )}
                    {others.length > 0 && (
                      <SidebarGroup>
                        <SidebarGroupLabel>All Chats</SidebarGroupLabel>
                        <SidebarGroupContent>{renderList(others)}</SidebarGroupContent>
                      </SidebarGroup>
                    )}
                  </>
                );
              })()}
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


