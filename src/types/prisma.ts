/**
 * This file provides type definitions for interacting with Prisma models
 * from the browser-side code. It doesn't directly import from Prisma
 * to avoid browser compatibility issues.
 */

// Base Prisma model interfaces
export interface PrismaUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaMessage {
  id: string;
  text: string;
  senderId: string;
  groupId: string | null;
  recipientId: string | null;
  status: string;
  timestamp: Date;
  attachmenturl: string | null;
  sender: PrismaUser;
  reactions: PrismaReaction[];
}

export interface PrismaContact {
  id: string;
  userId: string;
  contactUserId: string;
  isPinned: boolean;
  createdAt: Date;
  user: PrismaUser;
}

export interface PrismaGroup {
  id: string;
  name: string;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  members: PrismaUser[];
  creator: PrismaUser;
}

export interface PrismaReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

// Application types (used throughout the UI)
export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'away';
}

export interface Attachment {
  type: 'image';
  // Note: 'file' is for local handling, 'url' for rendering. File is optional for forwarded messages.
  file?: File;
  url: string; // base64 data URL
}

export interface Message {
  type: 'chat';
  id: string;
  contactId: string; // ID of the contact/group this message belongs to
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date | string; // Allow string for serialization
  status?: 'sent' | 'delivered' | 'read'; // For user messages
  attachment?: {
    type: 'image';
    url: string; // base64 data URL
  };
  reactions?: {
    emoji: string;
    userId: string;
  }[];
  isGroup?: boolean;
}

// Helper functions to convert between Prisma and Application types
export function prismaUserToUser(prismaUser: PrismaUser): User {
  return {
    id: prismaUser.id,
    name: prismaUser.name,
    email: prismaUser.email,
    avatarUrl: prismaUser.avatarUrl || undefined,
    status: prismaUser.status as 'online' | 'offline' | 'away',
  };
}

export function prismaMessageToMessage(prismaMessage: PrismaMessage): Message {
  return {
    type: 'chat',
    id: prismaMessage.id,
    contactId: prismaMessage.groupId || prismaMessage.recipientId || '',
    text: prismaMessage.text,
    senderId: prismaMessage.senderId,
    senderName: prismaMessage.sender.name,
    timestamp: prismaMessage.timestamp,
    status: prismaMessage.status as 'sent' | 'delivered' | 'read',
    attachment: prismaMessage.attachmenturl
      ? {
          type: 'image',
          url: prismaMessage.attachmenturl,
        }
      : undefined,
    reactions: prismaMessage.reactions.map(r => ({
      emoji: r.emoji,
      userId: r.userId
    })),
    isGroup: !!prismaMessage.groupId,
  };
}
