import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Contact, MessagesState, User } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import GeneratedAvatar from './GeneratedAvatar';
import { Search, Plus, MessagesSquare } from 'lucide-react';
import { DateUtils } from '@/utils/dateUtils';
// Popover imports reserved for future quick actions
// import { Popover, PopoverTrigger } from './ui/popover';
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
  // onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const lower = searchTerm.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(lower));
  }, [contacts, searchTerm]);

  // Long-press to pin/unpin (mobile)
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const handlePressStart = useCallback((contactId: string) => {
    if (pressTimer) window.clearTimeout(pressTimer);
    const t = window.setTimeout(() => onTogglePin(contactId), 500);
    setPressTimer(t);
  }, [pressTimer, onTogglePin]);
  const handlePressEnd = useCallback(() => {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      setPressTimer(null);
    }
  }, [pressTimer]);

  // Get recent contacts for horizontal avatar row
  const recentContacts = useMemo(() => {
    return contacts.slice(0, 8); // Show first 8 contacts
  }, [contacts]);

  // Simple edge-swipe to close the mobile sidebar when on the list screen
  const touchStartX = React.useRef<number | null>(null)
  const edgeSwipeThreshold = 24 // px from left edge
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const x = e.touches?.[0]?.clientX ?? 0
    // Only start tracking swipes from very left edge (avoid accidental drags)
    if (x <= edgeSwipeThreshold) touchStartX.current = x
  }
  const onTouchMove = (_e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return
    // Optionally: visual feedback could be implemented here
  }
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return
    const endX = e.changedTouches?.[0]?.clientX ?? 0
    const delta = endX - touchStartX.current
    touchStartX.current = null
    if (delta > minSwipeDistance && typeof window !== 'undefined') {
      // Go back to chat list close behavior via hash change
      // Parent manages showing/hiding this component; we just hint via location
      if (typeof history !== 'undefined' && history.length > 0) {
        history.back()
      }
    }
  }

  return (
    <SidebarProvider>
    <div className="fixed inset-0 z-50 bg-background flex flex-col" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
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
            <AnimatePresence initial={false}>
            {filteredContacts.map((contact) => {
              const contactMessages = messages[contact.id] || [];
              const lastMessage = contactMessages[contactMessages.length - 1];
              const isSelected = contact.id === selectedContactId;
              const unreadCount = unreadCounts[contact.id] || 0;
              const isUnread = unreadCount > 0;

              return (
                <motion.div
                  key={contact.id}
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 24, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                  className={`group relative p-4 hover:bg-muted/60 transition-colors ${
                    isSelected ? 'bg-accent' : ''
                  }`}
                  onClick={() => onSelectContact(contact.id)}
                  onPointerDown={() => handlePressStart(contact.id)}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={handlePressEnd}
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
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                          className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center"
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.div>
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

                  {/* Hint: long-press to pin/unpin */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Long press to pin</div>
                </motion.div>
              );
            })}
            </AnimatePresence>
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
