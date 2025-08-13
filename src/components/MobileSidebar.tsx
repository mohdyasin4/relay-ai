import React, { useMemo, useState } from 'react';
import type { Contact, MessagesState, User } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import GeneratedAvatar from './GeneratedAvatar';
import { Search, X, Plus, Phone, User as UserIcon, Settings, MessageCircle, MessagesSquare } from 'lucide-react';
import { DateUtils } from '@/utils/dateUtils';
import { Popover, PopoverTrigger } from './ui/popover';
import { PopoverContent } from '@radix-ui/react-popover';
import NavUser from './NavUser';
import { SidebarProvider } from './ui/sidebar';

interface MobileSidebarProps {
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
  onClose?: () => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
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
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const lower = searchTerm.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(lower));
  }, [contacts, searchTerm]);

  // Get recent contacts for horizontal avatar row
  const recentContacts = useMemo(() => {
    return contacts.slice(0, 8); // Show first 8 contacts
  }, [contacts]);

  return (
    <SidebarProvider>
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
        <MessagesSquare className='bg-primary h-8 w-8 p-1 rounded-md' />
          <h1 className="text-xl font-bold">Relay</h1>
        </div>
                 <NavUser
             user={{ name: user.name, email: user.email, avatar: user.avatarUrl || '' }}
             onSettings={onSettings}
             onLogout={onLogout}
             onNotifications={onFriendRequests}
             pendingNotifications={pendingFriendRequestsCount}
             isMobile={true}
             showOnlineStatus={true}
           />
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted/50"
          />
        </div>
      </div>

      {/* Horizontal Contact Avatars */}
      <div className="p-4 border-b">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* New Chat Button */}
          <div className="flex flex-col items-center gap-2 min-w-[60px]">
            <Button
              onClick={onNewGroup}
              size="icon"
              className="w-12 h-12 rounded-full bg-primary"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <span className="text-xs text-muted-foreground">New</span>
          </div>
          
          {recentContacts.map((contact) =>
  contact.status === "online" && !contact.isGroup ? (
    <div
      key={contact.id}
      className="flex flex-col items-center gap-2 min-w-[60px]"
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
          onlineStatus={contact.isAi ? "online" : "online"}
          className="w-12 h-12"
        />
        {unreadCounts[contact.id] > 0 && (
          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCounts[contact.id] > 9
              ? "9+"
              : unreadCounts[contact.id]}
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground truncate w-full text-center">
        {contact.name}
      </span>
    </div>
  ) : null
)}

        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length > 0 ? (
          <div className="space-y-1">
            {filteredContacts.map((contact) => {
              const contactMessages = messages[contact.id] || [];
              const lastMessage = contactMessages[contactMessages.length - 1];
              const isSelected = contact.id === selectedContactId;
              const unreadCount = unreadCounts[contact.id] || 0;
              const isUnread = unreadCount > 0;

              return (
                <div
                  key={contact.id}
                  className={`group relative p-4 hover:bg-muted/50 transition-colors ${
                    isSelected ? 'bg-accent' : ''
                  }`}
                  onClick={() => onSelectContact(contact.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
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
                        className="w-12 h-12"
                      />
                      {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-semibold truncate ${isUnread ? 'font-bold' : ''}`}>
                          {contact.name}
                        </h3>
                        <span className={`text-xs ${isUnread ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {lastMessage ? DateUtils.formatSidebarTime(lastMessage.timestamp) : ''}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${isUnread ? 'font-bold' : 'text-muted-foreground'}`}>
                        {typingIndicators[contact.id] && Object.keys(typingIndicators[contact.id]).length > 0 ? (
                          <span className="italic text-primary">
                            {Object.values(typingIndicators[contact.id])[0]} is typing...
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
                  </div>

                  {/* Pin Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(contact.id);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className={`w-2 h-2 rounded-full ${contact.isPinned ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 px-4">
            <p className="font-medium text-muted-foreground">No contacts found</p>
            <p className="text-sm text-muted-foreground/80 mt-1">Try a different search term.</p>
          </div>
        )}
      </div>

       
       
       {/* Floating New Chat Button */}
       <div className="fixed bottom-6 right-6 z-40">
         <Button
           onClick={onNewGroup}
           size="lg"
           className="h-14 w-14 rounded-full shadow-lg"
           aria-label="Start a new chat"
         >
           <Plus className="h-6 w-6" />
         </Button>
       </div>
     </div>
     </SidebarProvider>
   );
 };

export default MobileSidebar;
