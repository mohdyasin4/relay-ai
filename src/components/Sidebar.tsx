import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Contact, MessagesState, User, Theme } from '../types';
import GeneratedAvatar from './GeneratedAvatar';
import UsersIcon from './icons/UsersIcon';
import SettingsIcon from './icons/SettingsIcon';
import PinIcon from './icons/PinIcon';
import UserPlusIcon from './icons/UserPlusIcon';
import UserIcon from './icons/UserIcon';
import SearchIcon from './icons/SearchIcon';
import CloseIcon from './icons/CloseIcon';
import LogOutIcon from './icons/LogOutIcon';
import TypingIndicator from './icons/TypingIndicator';
import { DateUtils } from '../utils/dateUtils';

interface SidebarProps {
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
  onInviteUser: () => void;
  onFriendRequests: () => void;
  style?: React.CSSProperties;
  theme: Theme;
  typingIndicators: Record<string, Record<string, string>>;
}

const Sidebar: React.FC<SidebarProps> = ({ contacts, messages, unreadCounts, selectedContactId, onSelectContact, user, onNewGroup, onSettings, onLogout, onTogglePin, onInviteUser, onFriendRequests, style, theme, typingIndicators }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedContacts = useMemo(() => {
    // Filter contacts by search term if present
    const filtered = searchTerm
      ? contacts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : contacts;

    // Sort contacts by most recent message timestamp (descending)
    return [...filtered].sort((a, b) => {
      const messagesA = messages[a.id] || [];
      const messagesB = messages[b.id] || [];
      const lastMessageA = messagesA[messagesA.length - 1];
      const lastMessageB = messagesB[messagesB.length - 1];
      const timeA = lastMessageA ? new Date(lastMessageA.timestamp).getTime() : 0;
      const timeB = lastMessageB ? new Date(lastMessageB.timestamp).getTime() : 0;

      // Pinned contacts always have the highest priority
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      // Sort by most recent message time (descending)
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      // If timestamps are the same, prioritize higher unread count
      const unreadA = unreadCounts[a.id] || 0;
      const unreadB = unreadCounts[b.id] || 0;
      if (unreadA !== unreadB) {
        return unreadB - unreadA;
      }

      // Fallback to alphabetical sorting for consistency
      return a.name.localeCompare(b.name);
    });
  }, [contacts, searchTerm, messages, unreadCounts]);

  const sidebarBg = theme === 'midnight' ? 'dark:bg-black' : 'dark:bg-slate-900';

  return (
    <aside style={style} className={`bg-slate-50 ${sidebarBg} flex flex-col flex-shrink-0`}>
      <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
        <div className="relative flex-1 min-w-0" ref={userMenuRef}>
            <button
                onClick={() => setUserMenuOpen(p => !p)}
                className="flex items-center gap-3 text-left rounded-lg p-1 -m-1 hover:bg-slate-200 dark:hover:bg-slate-800 w-full transition-colors"
                aria-haspopup="true"
                aria-expanded={isUserMenuOpen}
            >
                {user && <GeneratedAvatar name={user.name} allContacts={contacts} currentUser={user} />}
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name}</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">My Account</p>
                </div>
            </button>
            {isUserMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-30 animate-[fade-in_0.1s]">
                    <ul className="py-1" role="menu">
                        <li role="presentation">
                            <button
                                onClick={() => { onSettings(); setUserMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                                role="menuitem"
                            >
                                <SettingsIcon className="w-5 h-5"/> Settings
                            </button>
                        </li>
                        <li role="presentation">
                            <button
                                onClick={onLogout}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                                role="menuitem"
                            >
                                <LogOutIcon className="w-5 h-5"/> Sign Out
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onInviteUser} className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Invite user">
            <UserPlusIcon className="w-6 h-6" />
          </button>
          <button onClick={onFriendRequests} className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Friend requests">
            <UserIcon className="w-6 h-6" />
          </button>
          <button onClick={onNewGroup} className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="New group">
            <UsersIcon className="w-6 h-6" />
          </button>
        </div>
      </header>
      <div className="p-2 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg py-2 pl-10 pr-10 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            aria-label="Search contacts"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              aria-label="Clear search"
            >
              <CloseIcon className="w-5 h-5 text-slate-500 hover:text-slate-600 dark:hover:text-slate-200" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sortedContacts.length > 0 ? (
          <ul>
            {sortedContacts.map(contact => {
              const contactMessages = messages[contact.id] || [];
              const lastMessage = contactMessages[contactMessages.length - 1];
              const isSelected = contact.id === selectedContactId;
              const unreadCount = unreadCounts[contact.id] || 0;
              const isUnread = unreadCount > 0;

              return (
                <li key={contact.id} className="group relative">
                  <button
                    onClick={() => onSelectContact(contact.id)}
                    className={`w-full text-left p-3 flex items-start gap-3 transition-colors duration-200 ${
                      isSelected 
                        ? 'bg-indigo-100 dark:bg-indigo-900/40' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
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
                          {contact.isPinned && <PinIcon className="w-4 h-4 mr-1.5 text-indigo-500 flex-shrink-0" />}
                          <h2 className={`font-semibold truncate text-base ${isSelected ? 'text-indigo-700 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>{contact.name}</h2>
                      </div>
                      <p className={`text-sm truncate flex-1 pt-1 ${isUnread ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                        {typingIndicators[contact.id] && Object.keys(typingIndicators[contact.id]).length > 0 ? (
                          <span className="flex items-center gap-2">
                            <span className="italic">{Object.values(typingIndicators[contact.id])[0]} is typing</span>
                            <TypingIndicator />
                          </span>
                        ) : lastMessage?.isForwarded ? (
                          'Forwarded Message'
                        ) : lastMessage?.attachment && !lastMessage.isForwarded ? (
                          '📷 Image'
                        ) : !lastMessage?.isForwarded && lastMessage?.text ? (
                          lastMessage.text
                        ) : !lastMessage ? (
                          'Start a conversation...'
                        ) : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                        <span className={`text-xs ${isUnread ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                           {lastMessage ? (
                             DateUtils.formatSidebarTime(lastMessage.timestamp)
                           ) : ''}
                        </span>
                        {unreadCount > 0 ? (
                            <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        ) : (
                           <div className="h-5 w-5" />
                        )}
                    </div>
                  </button>
                  <button
                      onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(contact.id);
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100 ${contact.isPinned ? 'bg-indigo-100 dark:bg-indigo-600/30' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                      aria-label={contact.isPinned ? 'Unpin contact' : 'Pin contact'}
                  >
                      <PinIcon className={`w-5 h-5 ${contact.isPinned ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-10 px-4">
            <p className="font-medium text-slate-600 dark:text-slate-400">No contacts found</p>
            <p className="text-sm text-slate-500 mt-1">Try a different search term.</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;