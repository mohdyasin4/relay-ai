import { QueryClient } from '@tanstack/react-query';

// Configure React Query client with optimized cache settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache API responses for 5 minutes by default
      staleTime: 1000 * 60 * 5,
      // Keep data in cache for 10 minutes
      gcTime: 1000 * 60 * 10,
      // Don't refetch on window focus for better performance
      refetchOnWindowFocus: false,
      // Retry failed requests 1 time only
      retry: 1,
    },
    mutations: {
      // Retry failed mutations 1 time
      retry: 1,
    },
  },
});

// Query keys for consistent caching
export const queryKeys = {
  user: ['user'],
  userProfile: (userId: string) => ['user', 'profile', userId],
  contacts: ['contacts'],
  userContacts: (userId: string) => ['contacts', 'user', userId],
  messages: (contactId: string) => ['messages', contactId],
  messagesForContact: (contactId: string, isGroup: boolean) => ['messages', contactId, isGroup ? 'group' : 'direct'],
  latestMessages: (userId: string) => ['messages', 'latest', userId],
  unreadMessages: (userId: string, lastSeen?: string) => ['messages', 'unread', userId, lastSeen],
  friendRequests: (userId: string) => ['friend-requests', userId],
  groupInfo: (groupId: string) => ['group', groupId],
  aiPersonas: ['ai-personas'],
} as const;
