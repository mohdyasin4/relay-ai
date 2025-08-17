import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { FriendsService } from '../services/friendsService';
import { MessageService } from '../services/messageService';
import { DatabaseService } from '../services/databaseService';
import type { User, Contact, Message } from '../types';

// User Profile Hooks
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: () => DatabaseService.getUserById(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // Cache profile for 10 minutes
  });
}

// Contacts Hooks
export function useUserContacts(userId: string) {
  return useQuery({
    queryKey: queryKeys.userContacts(userId),
    queryFn: () => FriendsService.getContacts(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // Cache contacts for 2 minutes
  });
}

export function useToggleContactPin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, contactId, isPinned }: { userId: string; contactId: string; isPinned: boolean }) =>
      FriendsService.togglePin(userId, contactId, isPinned),
    onSuccess: (_, { userId }) => {
      // Invalidate contacts query to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.userContacts(userId) });
    },
  });
}

// Messages Hooks
export function useMessages(contactId: string, isGroup: boolean, enabled = true, limit: number = 100) {
  return useQuery({
    queryKey: [...queryKeys.messagesForContact(contactId, isGroup), limit],
    queryFn: () => MessageService.getMessages(contactId, isGroup, limit),
    enabled: !!contactId && enabled,
    staleTime: 1000 * 30, // Cache messages for 30 seconds
  });
}

export function useLatestMessages(userId: string, contacts: Contact[]) {
  return useQuery({
    queryKey: queryKeys.latestMessages(userId),
    queryFn: () => MessageService.getLatestMessagesForContacts(userId, contacts, 1, { sinceDays: 90 }),
    enabled: !!userId && contacts.length > 0,
    staleTime: 1000 * 60, // Cache latest messages for 1 minute
  });
}

export function useUnreadMessages(userId: string, lastSeen?: string) {
  return useQuery({
    queryKey: queryKeys.unreadMessages(userId, lastSeen),
    queryFn: () => MessageService.getUnreadMessages(userId, lastSeen),
    enabled: !!userId,
    staleTime: 1000 * 30, // Cache unread messages for 30 seconds
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: Message) => MessageService.saveMessage(message),
    onSuccess: (_, message) => {
      // Invalidate messages query for the contact
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.messagesForContact(message.contactId, !!message.isGroup) 
      });
    },
  });
}

// Friend Requests Hooks
export function useFriendRequests(userId: string) {
  return useQuery({
    queryKey: queryKeys.friendRequests(userId),
    queryFn: () => FriendsService.getFriendRequests(userId),
    enabled: !!userId,
    staleTime: 1000 * 60, // Cache friend requests for 1 minute
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, friendId }: { userId: string; friendId: string }) =>
      FriendsService.acceptFriendRequest(userId, friendId),
    onSuccess: (_, { userId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userContacts(userId) });
    },
  });
}

// Status Update Hook
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'online' | 'offline' | 'away' }) =>
      DatabaseService.updateUserStatus(userId, status),
    onSuccess: (_, { userId }) => {
      // Invalidate user profile query
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) });
    },
  });
}

// AI Contact Management
export function useToggleAiContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, aiContactId, shouldAdd }: { userId: string; aiContactId: string; shouldAdd: boolean }) => {
      if (shouldAdd) {
        return FriendsService.addAiContact(userId, aiContactId);
      } else {
        return FriendsService.removeAiContact(userId, aiContactId);
      }
    },
    onSuccess: (_, { userId }) => {
      // Invalidate contacts query
      queryClient.invalidateQueries({ queryKey: queryKeys.userContacts(userId) });
    },
  });
}

// Cache prefetching utilities
export function usePrefetchData() {
  const queryClient = useQueryClient();
  
  const prefetchUserProfile = (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.userProfile(userId),
      queryFn: () => DatabaseService.getUserById(userId),
      staleTime: 1000 * 60 * 5,
    });
  };
  
  const prefetchMessages = (contactId: string, isGroup: boolean, limit: number = 100) => {
    queryClient.prefetchQuery({
      queryKey: [...queryKeys.messagesForContact(contactId, isGroup), limit],
      queryFn: () => MessageService.getMessages(contactId, isGroup, limit),
      staleTime: 1000 * 30,
    });
  };
  
  return { prefetchUserProfile, prefetchMessages };
}
