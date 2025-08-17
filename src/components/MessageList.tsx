import React, { useMemo, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import VirtualizedList from './ui/VirtualizedList';
import LazyImage from './ui/LazyImage';
import type { Message, User } from '../types';

interface MessageListProps {
  messages: Message[];
  currentUser: User;
  onImageClick: (imageUrl: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward: (message: Message) => void;
  className?: string;
  height?: number;
  firstUnreadMessageId?: string | null;
}

// Memoized individual message component
const MessageItem = React.memo<{
  message: Message;
  isCurrentUser: boolean;
  showSender: boolean;
  isFirstUnread: boolean;
  onImageClick: (imageUrl: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward: (message: Message) => void;
  style: React.CSSProperties;
}>(({
  message,
  isCurrentUser,
  showSender,
  isFirstUnread,
  onImageClick,
  onReact,
  onForward,
  style,
}) => {
  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓';
      default: return '';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'read': return 'text-blue-500';
      case 'delivered': return 'text-slate-500';
      case 'sent': return 'text-slate-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div style={style} className="px-4 py-1">
      {isFirstUnread && (
        <div className="flex items-center justify-center my-4">
          <div className="h-px bg-blue-500 flex-1" />
          <span className="px-4 text-sm text-blue-500 bg-white dark:bg-slate-900">
            New Messages
          </span>
          <div className="h-px bg-blue-500 flex-1" />
        </div>
      )}
      
      <div className={cn(
        'flex mb-2',
        isCurrentUser ? 'justify-end' : 'justify-start'
      )}>
        <div className={cn(
          'max-w-[70%] group relative',
          isCurrentUser ? 'order-2' : 'order-1'
        )}>
          {/* Sender name (for group chats) */}
          {showSender && !isCurrentUser && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 ml-3">
              {message.senderName}
            </div>
          )}
          
          {/* Message bubble */}
          <div className={cn(
            'relative rounded-2xl px-4 py-2 break-words',
            isCurrentUser
              ? 'bg-blue-500 text-white rounded-br-md'
              : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-md border border-slate-200 dark:border-slate-600'
          )}>
            {/* Reply context */}
            {message.replyTo && (
              <div className={cn(
                'border-l-2 pl-2 mb-2 text-sm opacity-75',
                isCurrentUser ? 'border-blue-300' : 'border-slate-300 dark:border-slate-500'
              )}>
                <div className="font-medium">
                  {message.replyTo.senderName}
                </div>
                <div className="truncate">
                  {message.replyTo.text || 'Image'}
                </div>
              </div>
            )}
            
            {/* Message content */}
            {message.attachment?.type === 'image' && (
              <div className="mb-2">
                <LazyImage
                  src={message.attachment.url}
                  alt="Attached image"
                  className="rounded-lg max-w-full h-auto cursor-pointer"
                  onClick={() => onImageClick(message.attachment!.url)}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            )}
            
            {message.text && (
              <div className="whitespace-pre-wrap">
                {message.text}
              </div>
            )}
            
            {/* Forward indicator */}
            {message.isForwarded && (
              <div className={cn(
                'text-xs opacity-75 mt-1 flex items-center',
                isCurrentUser ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
              )}>
                <svg className="w-3 h-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Forwarded
              </div>
            )}
            
            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(
                  message.reactions.reduce((acc, reaction) => {
                    if (!acc[reaction.emoji]) {
                      acc[reaction.emoji] = [];
                    }
                    acc[reaction.emoji].push(reaction.userId);
                    return acc;
                  }, {} as Record<string, string[]>)
                ).map(([emoji, userIds]) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(message.id, emoji)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-full border transition-colors',
                      isCurrentUser
                        ? 'bg-white/20 border-white/30 text-white hover:bg-white/30'
                        : 'bg-slate-100 dark:bg-slate-600 border-slate-200 dark:border-slate-500 hover:bg-slate-200 dark:hover:bg-slate-500'
                    )}
                  >
                    {emoji} {userIds.length}
                  </button>
                ))}
              </div>
            )}
            
            {/* Timestamp and status */}
            <div className={cn(
              'flex items-center justify-end gap-1 text-xs mt-1',
              isCurrentUser ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
            )}>
              <span>{formatTime(message.timestamp)}</span>
              {isCurrentUser && message.status && (
                <span className={getStatusColor(message.status)}>
                  {getStatusIcon(message.status)}
                </span>
              )}
            </div>
          </div>
          
          {/* Quick actions (shown on hover) */}
          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 rounded-full shadow-lg p-1 transform -translate-y-1/2 translate-x-2">
            <button
              onClick={() => onReact(message.id, '👍')}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-sm"
              title="React"
            >
              👍
            </button>
            <button
              onClick={() => onForward(message)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-sm"
              title="Forward"
            >
              ↗️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUser,
  onImageClick,
  onReact,
  onForward,
  className,
  height = 400,
  firstUnreadMessageId,
}) => {
  const listRef = useRef<any>(null);

  // Memoize message data with computed properties
  const messagesData = useMemo(() => {
    return messages.map((message, index) => {
      const isCurrentUser = message.senderId === currentUser.id;
      const prevMessage = index > 0 ? messages[index - 1] : null;
      
      // Show sender name if it's a different sender from the previous message
      const showSender = !prevMessage || prevMessage.senderId !== message.senderId;
      
      const isFirstUnread = message.id === firstUnreadMessageId;
      
      return {
        message,
        isCurrentUser,
        showSender,
        isFirstUnread,
      };
    });
  }, [messages, currentUser.id, firstUnreadMessageId]);

  // Calculate dynamic heights for messages
  const getItemHeight = useMemo(() => {
    return (index: number) => {
      const item = messagesData[index];
      if (!item) return 60;
      
      let height = 60; // Base height
      
      // Add height for sender name
      if (item.showSender && !item.isCurrentUser) {
        height += 20;
      }
      
      // Add height for reply context
      if (item.message.replyTo) {
        height += 40;
      }
      
      // Add height for attachments
      if (item.message.attachment) {
        height += 200; // Estimated image height
      }
      
      // Add height for reactions
      if (item.message.reactions && item.message.reactions.length > 0) {
        height += 30;
      }
      
      // Add height for first unread indicator
      if (item.isFirstUnread) {
        height += 40;
      }
      
      // Add estimated height based on text length
      const textLines = Math.ceil((item.message.text?.length || 0) / 50);
      height += textLines * 20;
      
      return Math.max(height, 60);
    };
  }, [messagesData]);

  // Render individual message item
  const renderMessageItem = useMemo(() => {
    return (item: typeof messagesData[0], index: number, style: React.CSSProperties) => (
      <MessageItem
        key={item.message.id}
        message={item.message}
        isCurrentUser={item.isCurrentUser}
        showSender={item.showSender}
        isFirstUnread={item.isFirstUnread}
        onImageClick={onImageClick}
        onReact={onReact}
        onForward={onForward}
        style={style}
      />
    );
  }, [onImageClick, onReact, onForward]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      const lastIndex = messages.length - 1;
      listRef.current.scrollToItem(lastIndex, 'end');
    }
  }, [messages.length]);

  // Scroll to first unread message
  useEffect(() => {
    if (firstUnreadMessageId && listRef.current) {
      const unreadIndex = messages.findIndex(m => m.id === firstUnreadMessageId);
      if (unreadIndex !== -1) {
        listRef.current.scrollToItem(unreadIndex, 'start');
      }
    }
  }, [firstUnreadMessageId, messages]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-slate-500 dark:text-slate-400', className)} style={{ height }}>
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div className={className}>
      <VirtualizedList
        ref={listRef}
        items={messagesData}
        height={height}
        itemHeight={getItemHeight}
        renderItem={renderMessageItem}
        itemKey={(index, data) => data[index].message.id}
        overscan={5}
        initialScrollOffset={999999} // Scroll to bottom initially
      />
    </div>
  );
};

export default React.memo(MessageList);
