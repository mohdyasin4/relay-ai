
export type Theme = 'light' | 'dark' | 'midnight';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface User {
  id: string;
  name: string;
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
  reactions?: string[];
  isForwarded?: boolean;
  isGroup?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  systemInstruction?: string; // Optional, for AI contacts
  isGroup?: boolean;
  isAi?: boolean;
  memberIds?: string[];
  creatorId?: string; // ID of the user who created the group
  isPinned?: boolean;
  status: 'online' | 'away' | 'offline';
  lastSeen?: string; // ISO string
}

export interface Invitation {
    type: 'invitation';
    contact: Contact; // The contact/group to be added
    topic: string; // The topic to subscribe to for the chat
}

export interface ReadReceipt {
    type: 'read_receipt';
    contactId: string;
    readerId: string;
}

export interface TypingIndicatorPayload {
    type: 'typing';
    contactId: string;
    userId: string;
    userName: string;
    state: 'start' | 'stop';
}

export interface ReactionPayload {
    type: 'reaction';
    contactId: string;
    messageId: string;
    reactorId: string;
    emoji: string;
    action: 'add' | 'remove';
}

export type MqttPayload = Message | Invitation | ReadReceipt | TypingIndicatorPayload | ReactionPayload;

export interface MessagesState {
  [contactId: string]: Message[];
}