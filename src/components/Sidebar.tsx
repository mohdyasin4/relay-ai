import React, { useMemo, useState, useRef, useEffect } from "react";
import type { Contact, MessagesState, User, Theme } from "../types";
import GeneratedAvatar from "./GeneratedAvatar";
import SettingsIcon from "./icons/SettingsIcon";
import { Bell as IconBell, Pin, PlusIcon } from "lucide-react";
import { Badge } from "./ui/badge";
import SearchIcon from "./icons/SearchIcon";
import CloseIcon from "./icons/CloseIcon";
import LogOutIcon from "./icons/LogOutIcon";
import TypingIndicator from "./icons/TypingIndicator";
import TypingIndicatorWithAvatars from "./TypingIndicatorWithAvatars";
import { DateUtils } from "../utils/dateUtils";
import { Button } from "./ui/button";

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
  pendingFriendRequestsCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
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
  onInviteUser,
  onFriendRequests,
  style,
  theme,
  typingIndicators,
  pendingFriendRequestsCount = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Only filter here; sorting is handled upstream. This ensures the sidebar
  // renders contacts according to the sorted list provided by parent.
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const lower = searchTerm.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(lower));
  }, [contacts, searchTerm]);

  const sidebarBg =
    theme === "dark" ? "dark:bg-black" : "dark:bg-background";

  return (
    <aside
      style={style}
      className={`bg-sidebar h-full border-r-1 border-sidebar-border  flex flex-col flex-shrink-0 w-full sm:w-auto`}
    >
      <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
        <div className="relative flex-1 min-w-0" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((p) => !p)}
            className="flex items-center gap-3 text-left rounded-lg p-1 -m-1 hover:bg-slate-200 dark:hover:bg-slate-800 w-full transition-colors"
            aria-haspopup="true"
            aria-expanded={isUserMenuOpen}
          >
            {user && (
              <GeneratedAvatar
                name={user.name}
                allContacts={contacts}
                currentUser={user}
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                {user?.name}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                My Account
              </p>
            </div>
          </button>
          {isUserMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-30 animate-[fade-in_0.1s]">
              <ul className="py-1" role="menu">
                <li role="presentation">
                  <button
                    onClick={() => {
                      onSettings();
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    role="menuitem"
                  >
                    <SettingsIcon className="w-5 h-5" /> Settings
                  </button>
                </li>
                <li role="presentation">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    role="menuitem"
                  >
                    <LogOutIcon className="w-5 h-5" /> Sign Out
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button
            onClick={onFriendRequests}
            variant="ghost"
            aria-label="Friend requests"
          >
            <IconBell className="w-6 h-6" />
            {pendingFriendRequestsCount > 0 && (
              <span className="absolute">
                <Badge
                  className="absolute -top-4 px-1 py-0 text-[10px] leading-none rounded-full"
                  variant="destructive"
                >
                  {pendingFriendRequestsCount}
                </Badge>
              </span>
            )}
          </Button>
        </div>
      </header>
      <div className="p-2 border-b border-slate-200 dark:border-slate-800 space-y-2 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 dark:supports-[backdrop-filter]:bg-slate-900/60">
        <div className="flex justify-end">
          <Button
            onClick={onNewGroup}
            className="w-full px-3 py-1.5 flex justify-center items-center cursor-pointer text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            aria-label="Start a new chat"
          >
            <PlusIcon className="w-5 h-5 inline-block mr-1" />
            New Chat
          </Button>
        </div>
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
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              aria-label="Clear search"
            >
              <CloseIcon className="w-5 h-5 text-slate-500 hover:text-slate-600 dark:hover:text-slate-200" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length > 0 ? (
          <ul>
            {filteredContacts.map((contact) => {
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
                        ? "bg-indigo-100 dark:bg-indigo-900/40"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
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
                          <Pin
                            fill={`${
                              contact.isPinned ? "currentColor" : "none"
                            }`}
                            className="w-4 h-4 mr-1.5 text-indigo-500 flex-shrink-0"
                          />
                        )}
                        <h2
                          className={`font-semibold truncate text-base ${
                            isSelected
                              ? "text-indigo-700 dark:text-white"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {contact.name}
                        </h2>
                      </div>
                      <p
                        className={`text-sm truncate flex-1 pt-1 ${
                          isUnread
                            ? "font-bold text-slate-700 dark:text-slate-200"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {typingIndicators[contact.id] &&
                        Object.keys(typingIndicators[contact.id]).length > 0 ? (
                          <TypingIndicatorWithAvatars
                            typingUsers={Object.entries(typingIndicators[contact.id]).map(([userId, userName]) => {
                              const user = contacts.find(c => c.id === userId);
                              return {
                                id: userId,
                                name: userName,
                                avatarUrl: user?.avatarUrl
                              };
                            })}
                            showAvatars={true}
                            maxAvatars={2}
                            className="truncate"
                          />
                        ) : lastMessage?.isForwarded ? (
                          "Forwarded Message"
                        ) : lastMessage?.attachment &&
                          !lastMessage.isForwarded ? (
                          "📷 Image"
                        ) : !lastMessage?.isForwarded && lastMessage?.text ? (
                          lastMessage.text
                        ) : !lastMessage ? (
                          "Start a conversation..."
                        ) : (
                          ""
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                      <span
                        className={`text-xs ${
                          isUnread
                            ? "text-indigo-600 dark:text-indigo-400 font-bold"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {lastMessage
                          ? DateUtils.formatSidebarTime(lastMessage.timestamp)
                          : ""}
                      </span>
                      {unreadCount > 0 ? (
                        <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : (
                        <div className="h-5 w-5" />
                      )}
                    </div>
                  </button>
                  <Button
                    variant={"ghost"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(contact.id);
                    }}
                    className={`absolute right-2 bottom-2 p-1.5 rounded-xl transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100 dark:group-hover:bg-transparent}`}
                    aria-label={
                      contact.isPinned ? "Unpin contact" : "Pin contact"
                    }
                  >
                    <Pin
                      className={`w-5 h-5 ${
                        contact.isPinned
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                      fill={contact.isPinned ? "currentColor" : "none"}
                    />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-10 px-4">
            <p className="font-medium text-slate-600 dark:text-slate-400">
              No contacts found
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Try a different search term.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
