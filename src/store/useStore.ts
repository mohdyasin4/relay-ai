
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Contact, Message, MessagesState, User, Theme } from '../types';

interface AppState {
  user: User | null;
  contacts: Contact[];
  selectedContactId: string | null;
  messages: MessagesState;
  unreadCounts: Record<string, number>;
  isLoading: boolean;
  isContactsLoading: boolean;
  contactsError: string | null;
  typingIndicators: Record<string, Record<string, string>>;
  firstUnreadMessageId: string | null;
  isSettingsOpen: boolean;
  isNewChatOpen: boolean;
  isInviteModalOpen: boolean;
  isFriendRequestsOpen: boolean;
  pendingFriendRequests: number;
  editingGroup: Contact | null;
  lightboxImage: string | null;
  forwardingMessage: Message | null;
  theme: Theme;
  sidebarWidth: number;
  uiAiStream: { contactId: string; messageId: string; text?: string; stream?: AsyncIterable<string> } | null;

  // Actions
  setUser: (user: User | null) => void;
  setContacts: (contacts: Contact[]) => void;
  setSelectedContactId: (contactId: string | null) => void;
  setMessages: (messages: MessagesState) => void;
  addMessage: (contactId: string, message: Message) => void;
  updateMessage: (contactId: string, messageId: string, updates: Partial<Message>) => void;
  setUnreadCounts: (unreadCounts: Record<string, number>) => void;
  setLoading: (isLoading: boolean) => void;
  setContactsLoading: (isContactsLoading: boolean) => void;
  setContactsError: (error: string | null) => void;
  setTypingIndicator: (contactId: string, userId: string, userName: string, state: 'start' | 'stop') => void;
  setFirstUnreadMessageId: (messageId: string | null) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setNewChatOpen: (isOpen: boolean) => void;
  setInviteModalOpen: (isOpen: boolean) => void;
  setFriendRequestsOpen: (isOpen: boolean) => void;
  setPendingFriendRequests: (count: number) => void;
  setEditingGroup: (group: Contact | null) => void;
  setLightboxImage: (imageUrl: string | null) => void;
  setForwardingMessage: (message: Message | null) => void;
  setTheme: (theme: Theme) => void;
  setSidebarWidth: (width: number) => void;
  setUiAiStream: (stream: { contactId: string; messageId: string; text?: string; stream?: AsyncIterable<string> } | null) => void;
}

export const useStore = create<AppState>()(
  devtools(
    (set) => ({
      user: null,
      contacts: [],
      selectedContactId: null,
      messages: {},
      unreadCounts: {},
      isLoading: false,
      isContactsLoading: true,
      contactsError: null,
      typingIndicators: {},
      firstUnreadMessageId: null,
      isSettingsOpen: false,
      isNewChatOpen: false,
      isInviteModalOpen: false,
      isFriendRequestsOpen: false,
      pendingFriendRequests: 0,
      editingGroup: null,
      lightboxImage: null,
      forwardingMessage: null,
      theme: 'dark',
      sidebarWidth: 320,
      uiAiStream: null,

      // Actions
      setUser: (user) => set({ user }),
      setContacts: (contacts) => set({ contacts }),
      setSelectedContactId: (contactId) => set({ selectedContactId: contactId }),
      setMessages: (messages) => set({ messages }),
      addMessage: (contactId, message) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [contactId]: [...(state.messages[contactId] || []), message],
          },
        })),
      updateMessage: (contactId, messageId, updates) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [contactId]: (state.messages[contactId] || []).map((msg) =>
              msg.id === messageId ? { ...msg, ...updates } : msg
            ),
          },
        })),
      setUnreadCounts: (unreadCounts) => set({ unreadCounts }),
      setLoading: (isLoading) => set({ isLoading }),
      setContactsLoading: (isContactsLoading) => set({ isContactsLoading }),
      setContactsError: (contactsError) => set({ contactsError }),
      setTypingIndicator: (contactId, userId, userName, state) =>
        set((s) => {
          const newIndicators = { ...s.typingIndicators };
          const chatIndicators = { ...(newIndicators[contactId] || {}) };
          if (state === 'start') {
            chatIndicators[userId] = userName;
          } else {
            delete chatIndicators[userId];
          }
          if (Object.keys(chatIndicators).length === 0) {
            delete newIndicators[contactId];
          } else {
            newIndicators[contactId] = chatIndicators;
          }
          return { typingIndicators: newIndicators };
        }),
      setFirstUnreadMessageId: (firstUnreadMessageId) => set({ firstUnreadMessageId }),
      setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      setNewChatOpen: (isNewChatOpen) => set({ isNewChatOpen }),
      setInviteModalOpen: (isInviteModalOpen) => set({ isInviteModalOpen }),
      setFriendRequestsOpen: (isFriendRequestsOpen) => set({ isFriendRequestsOpen }),
      setPendingFriendRequests: (pendingFriendRequests) => set({ pendingFriendRequests }),
      setEditingGroup: (editingGroup) => set({ editingGroup }),
      setLightboxImage: (lightboxImage) => set({ lightboxImage }),
      setForwardingMessage: (forwardingMessage) => set({ forwardingMessage }),
      setTheme: (theme) => set({ theme }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setUiAiStream: (uiAiStream) => set({ uiAiStream }),
    }),
    { name: 'AppStore' }
  )
);

