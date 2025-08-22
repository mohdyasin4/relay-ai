export type Theme = 'light' | 'dark' | 'system';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'away';
  lastSeen?: string;
}

export interface Attachment {
  type: 'image' | 'document' | 'audio' | 'video';
  // Note: 'file' is for local handling, 'url' for rendering. File is optional for forwarded messages.
  file?: File;
  url: string; // base64 data URL or blob URL
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

export type Message = {
  id: string
  contactId: string
  senderId: string
  senderName: string
  text: string
  timestamp: string
  isGroup: boolean
  status?: "sending" | "sent" | "delivered" | "read" | "failed"
  attachment?: Attachment
  attachments?: Attachment[]
  reactions?: Reaction[]
  isAiMessage?: boolean
  aiSenderId?: string
  replyTo?: {
    id: string
    text: string
    senderId: string
    senderName: string
  }
  isForwarded?: boolean
}

export interface Contact {
  id: string;
  name: string;
  avatarUrl?: string; // Avatar URL for the contact
  systemInstruction?: string; // Optional, for AI contacts
  isGroup?: boolean;
  isAi?: boolean;
  memberIds?: string[];
  creatorId?: string; // ID of the user who created the group
  isPinned?: boolean;
  topicId?: string; // Common MQTT topic for this contact (DMs only)
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
    messageIds?: string[]; // Optional array of message IDs that were read
}

export interface DeliveryReceipt {
    type: 'delivery_receipt';
    contactId: string;
    readerId: string;
    messageIds?: string[]; // Optional array of message IDs that were delivered
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

export interface FriendRequestAccepted {
    type: 'friend_request_accepted';
    accepterId: string;
    accepterName: string;
    requesterId: string;
}

export interface FriendRequest {
    type: 'friend_request';
    requesterId: string;
    requesterName: string;
    requesterEmail: string;
}

export interface FriendRequestProcessed {
    type: 'friend_request_processed';
    requesterId: string;
    processedBy: string;
    action: 'accepted' | 'rejected';
}

export type MqttPayload = Message | Invitation | ReadReceipt | DeliveryReceipt | TypingIndicatorPayload | ReactionPayload | FriendRequestAccepted | FriendRequest | FriendRequestProcessed;

export interface MessagesState {
  [contactId: string]: Message[];
}