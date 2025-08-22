// Polling interval for presence updates (in ms)
const PRESENCE_POLL_INTERVAL = 10000;

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  memo,
} from "react";

import { DatabaseService } from "../services/databaseService";
import { mqttService } from "../services/mqttService";
// import { fileToBase64 } from "../utils/imageUtils"; // Not needed with storage service
import { formatPresence, DateUtils } from "../utils/dateUtils";

import GeneratedAvatar from "./GeneratedAvatar";
import DateSeparator from "./DateSeparator";
import { FileAttachment } from "./FileAttachment";
import { FileUpload, FileUploadList, FileUploadItem, FileUploadItemPreview, FileUploadItemDelete, FileUploadItemProgress } from "./ui/file-upload";
import { StorageService } from "../services/storageService";
// import NewMessagesSeparator from "./NewMessagesSeparator";
// import MentionSuggestions from "./MentionSuggestions";

import CloseIcon from "./icons/CloseIcon";
import PlusIcon from "./icons/PlusIcon";
import CheckIcon from "./icons/CheckIcon";
import ReplyIcon from "./icons/ReplyIcon";
// import ChatBubbleLeftRightIcon from "./icons/ChatBubbleLeftRightIcon";

import type {
  Contact,
  Message,
  Attachment,
  User,
  ReadReceipt,
  TypingIndicatorPayload,
} from "../types";
import { Button } from "./ui/button";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { ScrollButton } from "@/components/ui/scroll-button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { Loader } from "@/components/ui/loader";
import { motion } from "motion/react";
import {
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/components/ui/message";
import { ReplyPreview } from "./ReplyPreview";
import { ForwardedMessageIndicator, OtherUserAvatar } from "./ForwardedMessageIndicator";
// Markdown handled inside MessageContent
import {
  Clock,
  Check,
  CheckCheck,
  Smile,
  Reply,
  Forward,
  Edit,
  Send,
  MessagesSquare,
  Copy,
  ArrowLeft,
  Sparkles,
  Ellipsis,
  Paperclip,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import EmojiPickerReact, { SuggestionMode } from "emoji-picker-react";
import { useTheme } from "./theme-provider";
// Using custom scroll button instead of ScrollButton component
import { Mention, MentionContent, MentionInput, MentionItem } from "@/components/ui/mention";
import { Theme as EmojiTheme } from "emoji-picker-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTextStream } from "@/components/ui/response-stream";
import { cookies } from "@/lib/cookies";
import { MentionText } from "@/components/ui/mention-text";
import { getSenderColorClass } from "@/utils/colorUtils";
import { MessageService } from "@/services/messageService";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarGroup, Popover as HeroPopover, PopoverTrigger as HeroPopoverTrigger, PopoverContent as HeroPopoverContent, Button as HeroButton } from "@heroui/react";
import { Download, X } from "lucide-react";

// Memoized components for better performance

const MemoizedMentionText = memo(MentionText);

interface ChatViewProps {
  contact: Contact | undefined;
  currentUser: User;
  contacts: Contact[];
  messages: Message[];
  isLoading: boolean;
  typingIndicators: Record<string, string>;
  onSendMessage: (
    text: string,
    attachment?: Attachment,
    replyInfo?: { replyTo: Message["replyTo"] },
    additionalAttachments?: Attachment[]
  ) => void;
  onImageClick: (url: string) => void;
  onEditGroup: (group: Contact) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward: (message: Message) => void;
  onNewGroup: () => void;
  onInviteUser: () => void;
  onAddAiContact: (contact: Contact) => void;
  aiPersonas: Contact[];
  firstUnreadMessageId: string | null;
  setFirstUnreadMessageId: (messageId: string | null) => void;
  aiStream?: { messageId: string; stream?: AsyncIterable<string>; text?: string } | null;
  onBack?: () => void;
  onLoadOlder?: (contactId: string, mergedMessages: Message[]) => void;
}

// Memoized message item component to prevent unnecessary re-renders
const MessageItem = memo(({
  msg,
  isSelf,
  sender,
  contact,
  aiPersonas,
  aiStream,
  allKnownContacts,
  theme,
  copied,
  setCopied,
  handleCopy,
  onReact,
  onForward,
  setReplyingTo,
  openEmojiForMessageId,
  setOpenEmojiForMessageId,
  currentUser,
  handleImagePreview
}: {
  msg: Message;
  isSelf: boolean;
  sender: Contact | User | undefined;
  contact: Contact;
  aiPersonas: Contact[];
  aiStream: { messageId: string; text?: string; stream?: AsyncIterable<string> } | null | undefined;
  allKnownContacts: Contact[];
  theme: any;
  copied: boolean;
  setCopied: (val: boolean) => void;
  handleCopy: (text: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward: (message: Message) => void;
  setReplyingTo: (msg: Message | null) => void;
  openEmojiForMessageId: string | null;
  setOpenEmojiForMessageId: (id: string | null) => void;
  currentUser: User;
  handleImagePreview: (imageData: { url: string; fileName?: string; fileSize?: number }) => void;
}) => {
  const getMentionClassesForKey = useCallback((key: string) => getSenderColorClass(key), []);

  const renderStatusIcon = useCallback(() => {
    if (isSelf) {
      if (msg.status === 'read') {
        return <CheckCheck className="w-3 h-3 text-green-500" />;
      } else if (msg.status === 'delivered') {
        return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      } else if (msg.status === 'sent') {
        return <Check className="w-3 h-3 text-muted-foreground" />;
      } else {
        return <Clock className="w-3 h-3 text-muted-foreground" />;
      }
    }
    return null;
  }, [isSelf, msg.status]);

  const isStreamingThis = useMemo(() =>
    (contact.isAi || (contact.isGroup && aiPersonas.some(ai => ai.id === msg.senderId))) &&
    !!aiStream &&
    aiStream!.messageId === msg.id,
    [contact.isAi, contact.isGroup, aiPersonas, aiStream?.messageId, msg.senderId, msg.id]
  );

  const isAiSender = useMemo(() => {
    // Check if message has AI-specific fields
    const hasAiFields = (msg as any).isAiMessage || (msg as any).aiSenderId;
    
    // Check if sender name indicates AI (for backward compatibility with old messages)
    const senderName = msg.senderName || '';
    const isAiByName = senderName === 'Code Assistant' || 
                      senderName === 'AI Assistant' || 
                      senderName.includes('Assistant');
    
    // In a direct chat with an AI, treat messages from the AI contact as AI
    if (!contact.isGroup && contact.isAi) {
      const result = msg.senderId === contact.id || 
             aiPersonas.some(ai => ai.id === msg.senderId) ||
             hasAiFields ||
             isAiByName;
      
      // Debug logging for AI detection (development only)
      if (import.meta.env?.MODE === 'development' && (hasAiFields || isAiByName)) {
        console.log('AI detection (direct):', {
          senderId: msg.senderId,
          senderName: senderName,
          aiSenderId: (msg as any).aiSenderId,
          isAiMessage: (msg as any).isAiMessage,
          isAiByName: isAiByName,
          contactId: contact.id,
          aiPersonas: aiPersonas.map(ai => ai.id),
          result
        });
      }
      
      return result;
    }
    
    // In a group, treat as AI if the sender matches any AI persona or has AI fields
    if (contact.isGroup) {
      const result = aiPersonas.some(ai => ai.id === msg.senderId) || 
                    hasAiFields || 
                    isAiByName;
      
      // Debug logging for AI detection (development only)
      if (import.meta.env?.MODE === 'development' && (hasAiFields || isAiByName)) {
        console.log('AI detection (group):', {
          senderId: msg.senderId,
          senderName: senderName,
          aiSenderId: (msg as any).aiSenderId,
          isAiMessage: (msg as any).isAiMessage,
          isAiByName: isAiByName,
          aiPersonas: aiPersonas.map(ai => ai.id),
          result
        });
      }
      
      return result;
    }
    
    return false;
  }, [contact.isGroup, contact.isAi, msg.senderId, msg.senderName, aiPersonas, msg]);

  const aiDisplayedText = useMemo(() =>
    isStreamingThis ? (aiStream?.text || "") : "",
    [isStreamingThis, aiStream?.text]
  );

  const textToRender = useMemo(() =>
    (msg.text || "").toString(),
    [msg.text]
  );

  const isEmojiOnly = useMemo(() => {
    if (!textToRender.trim()) return false;
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji})+(?:\s(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji})+)?$/u;
    return emojiRegex.test(textToRender.trim());
  }, [textToRender]);

  return (
    <div id={msg.id} className={`group flex gap-3 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isSelf && contact.isGroup && <OtherUserAvatar sender={sender} />}

      {/* Message Content */}
      <div className="flex flex-col max-w-[85%] inter-double-storey">
        {/* Sender name for group chats */}
        {contact.isGroup && !isSelf && sender?.name && (
          <div className="mb-1 flex items-center gap-2">
            <span className={`inline-block text-[11px] font-semibold ${getMentionClassesForKey(sender.id || sender.name)}`}>
              {sender.name}
            </span>
            {isAiSender && (
              <Badge variant="secondary" className="h-4 py-0 inline-flex items-center gap-1 rounded-sm bg-amber-500/25 ring-1 ring-border/40">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] text-amber-500 font-semibold">AI</span>
              </Badge>
            )}
          </div>
        )}
        
        {/* Show AI name for direct AI chats (not groups) */}
        {!contact.isGroup && contact.isAi && !isSelf && (
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {contact.name}
            </span>
            <Badge variant="secondary" className="h-4 py-0 inline-flex items-center gap-1 rounded-sm bg-amber-500/25 ring-1 ring-border/40">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] text-amber-500 font-semibold">AI</span>
            </Badge>
          </div>
        )}

        {/* Forwarded Message Indicator */}
        {msg.isForwarded && <ForwardedMessageIndicator />}

        {/* Reply Preview */}
        {msg.replyTo && <ReplyPreview replyTo={msg.replyTo} allKnownContacts={allKnownContacts} />}

        {/* Message Bubble */}
        <div className="relative">
          {/* Message content - handle streaming, attachments, and text */}
          {(() => {
    // AI response rendering with typewriter effect
    if (isStreamingThis) {
      // Show thinking indicator until we have the first chunk
      if (aiDisplayedText.length === 0) {
        return (
          <div className={`bg-muted/70 text-foreground px-2 py-2 rounded-2xl  max-w-lg w-full backdrop-blur-sm border border-border/60 shadow-sm`}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader variant="text-shimmer" text="AI is thinking" />
            </div>
          </div>
        );
      }
      // Render the streaming AI response with proper markdown
      return (
        <MemoizedMessageContent
          markdown={true}
          className={`bg-muted/70 text-foreground rounded-2xl  prose-h2:mt-0! prose-h2:scroll-m-0! px-3 py-2 break-words max-w-lg min-w-[80px] backdrop-blur-sm border border-border/60 shadow-sm`}
          theme={theme.theme}
          copied={copied}
          setCopied={setCopied}
          handleCopy={handleCopy}
          resolveMentionContact={(id) => {
            const c = allKnownContacts.find((x) => x.id === id || x.name === id)
            return c ? { name: c.name, avatarUrl: (c as any).avatarUrl } : undefined
          }}
          id={msg.id}
        >
          {aiDisplayedText}
        </MemoizedMessageContent>
      );
    }

    // Post-stream or regular rendering
            if (!textToRender.trim() && !msg.attachment && !msg.attachments?.length) {
      if (isAiSender) {
        return (
          <div className={`bg-muted/70 text-foreground px-2 py-2 rounded-2xl  max-w-lg w-full backdrop-blur-sm border border-border/60 shadow-sm`}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader variant="text-shimmer" text="AI is thinking" />
            </div>
          </div>
        );
      }
      return null;
    }

    // Emoji-only jumbo
    if (isEmojiOnly) {
      return (
        <MemoizedMessageContent
          markdown={false}
          className={`${isSelf ? "bg-transparent text-foreground" : "bg-transparent text-foreground"} prose-h2:mt-0! prose-h2:scroll-m-0! break-words whitespace-pre-wrap w-full text-6xl leading-none pb-10 text-center`}
          copied={copied}
          setCopied={setCopied}
          handleCopy={handleCopy}
        >
          {textToRender}
        </MemoizedMessageContent>
      );
    }

                // Helper function to get all attachments without duplicates
            const getAllAttachments = () => {
              const attachments = [];
              
              // First check for attachments array
              if (msg.attachments && msg.attachments.length > 0) {
                attachments.push(...msg.attachments);
              } 
              // Only use single attachment if no attachments array exists
              else if (msg.attachment) {
                attachments.push(msg.attachment);
              }
              
              return attachments;
            };

            const allAttachments = getAllAttachments();

            // Use markdown for AI messages, MentionText for user messages
            if (isAiSender) {
      return (
                <div className="space-y-2">
                  {/* Text content */}
                  {textToRender.trim() && (
        <MemoizedMessageContent
          markdown={true}
          className={`bg-muted border border-muted  text-foreground rounded-2xl border prose-h2:mt-0! prose-h2:scroll-m-0! px-2 py-2 break-words max-w-lg w-full backdrop-blur-sm shadow-sm`}
          theme={theme.theme}
          copied={copied}
          setCopied={setCopied}
          handleCopy={handleCopy}
          resolveMentionContact={(id) => {
            const c = allKnownContacts.find((x) => x.id === id || x.name === id)
            return c ? { name: c.name, avatarUrl: (c as any).avatarUrl } : undefined
          }}
          id={msg.id}
        >
          {textToRender}
        </MemoizedMessageContent>
                  )}
                  
                  {/* Render all attachments without duplicates */}
                  {allAttachments.map((attachment, index) => (
                    <FileAttachment
                      key={index}
                      url={attachment.url}
                      fileName={attachment.fileName}
                      fileSize={attachment.fileSize}
                      mimeType={attachment.mimeType}
                      className="max-w-sm"
                      onImagePreview={handleImagePreview}
                      messageStatus={msg.status as any}
                      messageTimestamp={msg.timestamp}
                      isSelf={isSelf}
                      standalone={false}
                    />
                  ))}
                </div>
      );
    } else {
      // Non-AI senders: user or other humans
      const hasText = textToRender.trim();
      const hasAttachments = allAttachments.length > 0;
      
      // If only attachments (no text), render without background
      if (hasAttachments && !hasText) {
      return (
          <div className="flex flex-col gap-2">
            {allAttachments.map((attachment, index) => (
              <FileAttachment
                key={index}
                url={attachment.url}
                fileName={attachment.fileName}
                fileSize={attachment.fileSize}
                mimeType={attachment.mimeType}
                className="max-w-sm"
                onImagePreview={handleImagePreview}
                messageStatus={msg.status as any}
                messageTimestamp={msg.timestamp}
                isSelf={isSelf}
                standalone={true}
              />
            ))}
        </div>
      );
    }
      
      // For messages with text (with or without attachments)
      const baseClass = isSelf
        ? "bg-primary"
        : "bg-secondary border border-muted";

  return (
                <div className={`${baseClass} rounded-2xl px-3 py-2 break-words max-w-lg w-full backdrop-blur-sm shadow-sm`}>
                  {/* Render attachments first (above text) */}
                  {allAttachments.map((attachment, index) => (
                    <div key={index} className="mb-2">
                      <FileAttachment
                        url={attachment.url}
                        fileName={attachment.fileName}
                        fileSize={attachment.fileSize}
                        mimeType={attachment.mimeType}
                        className="max-w-sm"
                        onImagePreview={handleImagePreview}
                        messageStatus={msg.status as any}
                        messageTimestamp={msg.timestamp}
                        isSelf={isSelf}
                        standalone={false}
        />
        </div>
                  ))}
                  
                  {/* Text content */}
                  {hasText && (
                    <MemoizedMentionText
                      text={textToRender}
                      contacts={allKnownContacts}
                      className={isSelf ? "text-white inter-double-storey" : "text-foreground inter-double-storey"}
                    />
            )}
          </div>
              );
            }

            return null;
          })()}

          {/* Timestamp and read receipt inside bubble - only show when no attachments */}
          
          </div>

        <div className={`mt-1 ${isSelf ? 'flex justify-end' : 'flex justify-start'}`}>
            <div className="flex items-center gap-3">
                {/* Reactions: show only when present */}
        {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex items-center gap-1">
              {Object.entries(
                msg.reactions.reduce<Record<string, string[]>>((acc, r) => {
                  (acc[r.emoji] ||= []).push(r.userId);
                  return acc;
                }, {})
                    ).map(([emoji, userIds]) => {
                      const reactedUsers = userIds.map(userId => 
                        allKnownContacts.find(c => c.id === userId)
                      ).filter((user): user is NonNullable<typeof user> => Boolean(user));
                      
                      const popoverKey = `${msg.id}-${emoji}`;
                      const isPopoverOpen = openEmojiForMessageId === popoverKey;
                      
                      return (
                        <HeroPopover 
                          key={popoverKey} 
                          placement="top"
                          isOpen={isPopoverOpen}
                          onOpenChange={(open) => setOpenEmojiForMessageId(open ? popoverKey : null)}
                        >
                          <HeroPopoverTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                            className="h-6 px-2 text-xs rounded-full bg-muted/50 hover:bg-muted/80 transition-colors"
                  onClick={() => onReact(msg.id, emoji)}
                            onMouseEnter={() => setOpenEmojiForMessageId(popoverKey)}
                            onMouseLeave={() => setOpenEmojiForMessageId(null)}
                >
                  <span className="mr-1">{emoji}</span>
                  <span className="text-muted-foreground">{userIds.length}</span>
                </Button>
                          </HeroPopoverTrigger>
                          <HeroPopoverContent 
                            className="p-2 min-w-0"
                            onMouseEnter={() => setOpenEmojiForMessageId(popoverKey)}
                            onMouseLeave={() => setOpenEmojiForMessageId(null)}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                                <span>{emoji}</span>
                                <span>{userIds.length} {userIds.length === 1 ? 'reaction' : 'reactions'}</span>
                              </div>
                              <div className="space-y-0.5">
                                {reactedUsers.map((user) => (
                                  <div key={user.id} className="flex items-center gap-2">
                                    <Avatar
                                      src={user.avatarUrl}
                                      name={user.name}
                                      size="sm"
                                      className="w-4 h-4"
                                    />
                                    <span className="text-xs text-foreground truncate">
                                      {user.id === currentUser.id ? 'You' : user.name}
                                    </span>
                                  </div>
              ))}
            </div>
                            </div>
                          </HeroPopoverContent>
                        </HeroPopover>
                      );
                    })}
          </div>
        )}
                
                {/* Timestamp and read receipt */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
                    <span title={DateUtils.formatFullDateTime(msg.timestamp)}>
                        {DateUtils.formatMessageTime(msg.timestamp, true)}
                    </span>
                    {renderStatusIcon()}
                </div>
            </div>
        </div>
      </div>
      <MessageActions
            className={` ${isSelf ? "left-[-44px]" : "right-[-44px]"} hidden md:flex flex-col justify-center items-center gap-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto z-20`}
          >
            <div className="bg-background/95 backdrop-blur-md rounded-full p-1 shadow-lg border border-border/50 flex items-center gap-1">
              <MessageAction tooltip="Add Reaction" side="top">
                <div
                  onMouseEnter={() => setOpenEmojiForMessageId(msg.id)}
                  onMouseLeave={(e) => {
                    // Check if the mouse is moving to the popover content
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    if (!relatedTarget?.closest('[data-radix-popper-content-wrapper]')) {
                      setOpenEmojiForMessageId(null);
                    }
                  }}
                >
                  <Popover open={openEmojiForMessageId === msg.id} onOpenChange={(open) => setOpenEmojiForMessageId(open ? msg.id : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Reaction"
                        className="rounded-full hover:text-foreground size-7"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      align="end" 
                      side={isSelf ? 'bottom' : 'bottom'} 
                      sideOffset={6} 
                      className="p-1 w-auto min-w-[240px]"
                      onMouseEnter={() => setOpenEmojiForMessageId(msg.id)}
                      onMouseLeave={() => setOpenEmojiForMessageId(null)}
                    >
                      <div className="emoji-picker-container">
                        <EmojiPickerReact
                          reactionsDefaultOpen={true}
                          onReactionClick={(emojiData: any) => {
                            onReact(msg.id, emojiData.emoji);
                            setOpenEmojiForMessageId(null);
                          }}
                          onEmojiClick={(emojiData: any) => {
                            onReact(msg.id, emojiData.emoji);
                            setOpenEmojiForMessageId(null);
                          }}
                          lazyLoadEmojis={true}
                          autoFocusSearch={false}
                          suggestedEmojisMode={SuggestionMode.FREQUENT}
                          theme={
                            document.documentElement.classList.contains('dark')
                              ? ('dark' as EmojiTheme)
                              : ('light' as EmojiTheme)
                          }
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </MessageAction>

              <MessageAction tooltip="Reply" side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Reply"
                  className="rounded-full hover:text-foreground size-7"
                  onClick={() => setReplyingTo(msg)}
                >
                  <Reply className="w-3.5 h-3.5" />
                </Button>
              </MessageAction>

              <MessageAction tooltip="More" side="top">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="More"
                      className="rounded-full hover:text-foreground size-7"
                    >
                      <Ellipsis className="w-3.5 h-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="center" side={isSelf ? 'left' : 'right'} sideOffset={6} className="p-1 w-40">
                    <div className="bg-popover rounded-md">
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left"
                        onClick={() => onForward(msg)}
                      >
                        <Forward className="w-4 h-4" />
                        Forward
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </MessageAction>
            </div>
          </MessageActions>
    </div>
  );
});

MessageItem.displayName = "MessageItem";

// Legacy SuggestionState retained only for reference; DiceUI Mention manages state internally

// legacy typing indicator removed in favor of Loader typing

// Memoize expensive message processing
const MemoizedMessageContent = memo(MessageContent, (prevProps, nextProps) => {
  return (
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className &&
    prevProps.copied === nextProps.copied &&
    prevProps.theme === nextProps.theme
  );
});

MemoizedMessageContent.displayName = 'MemoizedMessageContent';

const ChatView: React.FC<ChatViewProps> = memo(({
  contact,
  currentUser,
  contacts,
  messages,
  isLoading,
  typingIndicators,
  onSendMessage,
  onEditGroup,
  onReact,
  onForward,
  onNewGroup,
  onInviteUser,
  onAddAiContact,
  aiPersonas,
  firstUnreadMessageId,
  // setFirstUnreadMessageId,
  aiStream,
  onBack,
  onLoadOlder,
}) => {
  const [liveContact, setLiveContact] = useState<Contact | undefined>(contact);
  const [inputText, setInputText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<Set<File>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Map<File, number>>(new Map());
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  // Deprecated local per-message popover state
  // const [openEmojiForMessageId, setOpenEmojiForMessageId] = useState<string | null>(null);
  const [isComposerEmojiOpen, setComposerEmojiOpen] = useState<boolean>(false);
  // Clear mentions by remounting the mention input
  const [mentionResetKey, setMentionResetKey] = useState(0);
  const [openEmojiForMessageId, setOpenEmojiForMessageId] = useState<string | null>(null);
  

  
  // Store preview URLs for all files
  const [filePreviewUrls, setFilePreviewUrls] = useState<Map<File, string>>(new Map());
  
  // Reset input and mention state when contact changes
  useEffect(() => {
    // When switching contacts, reset state but preserve text if returning quickly
    setAttachment(null);
    setAttachedFiles([]);
    // Clean up preview URLs when switching contacts
    setFilePreviewUrls(prevUrls => {
      prevUrls.forEach(url => URL.revokeObjectURL(url));
      return new Map();
    });
    setReplyingTo(null);
    setComposerEmojiOpen(false);
    // Only clear text when the contact actually changes to a different id
    setMentionResetKey(prev => prev + 1);
  }, [contact?.id]);

  // Cleanup effect for preview URLs on unmount
  useEffect(() => {
    return () => {
      // Clean up all preview URLs when component unmounts
      setFilePreviewUrls(prevUrls => {
        prevUrls.forEach(url => URL.revokeObjectURL(url));
        return prevUrls; // Don't change state during cleanup, just revoke URLs
      });
    };
  }, []);
  

  
  // Generate a unique key for the mention input to force remount when contact changes
  const mentionKey = `${contact?.id}-${mentionResetKey}`;
  
  const [mobileMessageActions, setMobileMessageActions] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'system'>(
    () => (cookies.get('vite-ui-theme') as 'light' | 'dark' | 'system') || 'system'
  );
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; fileName?: string; fileSize?: number } | null>(null);

  // Handle ESC key to close image preview
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && imagePreview) {
        setImagePreview(null);
      }
    };

    if (imagePreview) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when preview is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [imagePreview]);

  // Function to handle image preview
  const handleImagePreview = useCallback((imageData: { url: string; fileName?: string; fileSize?: number }) => {
    setImagePreview(imageData);
  }, []);



  // Viewport dimensions for mobile popover positioning
  const [, setViewportDimensions] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  }));

  // Handle click outside and viewport changes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isComposerEmojiOpen) {
        const target = event.target as Element;
        if (!target.closest('.emoji-picker-container') && !target.closest('[data-emoji-trigger]')) {
          setComposerEmojiOpen(false);
        }
      }
      if (mobileMessageActions) {
        const target = event.target as Element;
        if (!target.closest('.mobile-message-actions')) {
          setMobileMessageActions(null);
        }
      }
    };

    const handleResize = () => {
      setViewportDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [isComposerEmojiOpen, mobileMessageActions]);

  // Stream only the latest AI message if aiStream is provided
  const {
    displayedText: aiDisplayedText,
    startStreaming: startAiStreaming,
    reset: resetAiStreaming,
  } = useTextStream({
    textStream: aiStream?.stream || aiStream?.text || "",
    mode: "typewriter",
    speed: 350,
  });

  // Track whether an AI response is pending streaming to avoid empty bubbles and false typing
  const isStreamingActive = !!aiStream && !!aiStream.messageId;
  const aiThinking = isStreamingActive && (aiDisplayedText?.length ?? 0) === 0;

  useEffect(() => {
    if (aiStream && (aiStream.stream || aiStream.text)) {
      resetAiStreaming();
      startAiStreaming();
    }
  }, [aiStream?.messageId, aiStream?.stream, aiStream?.text, resetAiStreaming, startAiStreaming]);
  // Removed legacy suggestion state (DiceUI Mention handles suggestions)
  const [copied, setCopied] = useState(false);

  // Replace @Name occurrences handled in Mention pipeline
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const messagesEndRef = useRef<HTMLDivElement>(null!);
  // Using PromptInputTextarea internal ref; no local textarea ref needed
  const typingTimeoutRef = useRef<number | null>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const prevMessagesLengthRef = useRef<number>(messages.length);
  const prevContactIdRef = useRef<string | undefined>(contact?.id);
  const lastSubmitRef = useRef<{ sig: string; at: number } | null>(null);
  const theme = useTheme()

  useEffect(() => {
    setLiveContact(contact);

    if (!contact || contact.isAi) return;

    async function pollPresence() {
      const updated = await DatabaseService.getUserById(contact!.id);
      if (updated) {
        setLiveContact(
          (prev) => ({ ...(prev as Contact), ...updated } as Contact)
        );
      }
    }

    pollPresence();
    const interval = setInterval(pollPresence, PRESENCE_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [contact]);

  // Clear message cache when contact changes to ensure fresh data with updated AI detection
  useEffect(() => {
    if (contact) {
      MessageService.clearCaches();
    }
  }, [contact?.id]);

  // Show one-time onboarding dialog on welcome screen
  useEffect(() => {
    if (!contact) {
      const dismissed = cookies.get('relay_onboarding_dismissed_v1');
      if (!dismissed) setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [contact]);

  // Debug logging for contact and message analysis (development only)
  useEffect(() => {
    if (import.meta.env?.MODE === 'development' && contact && messages.length > 0) {
      console.log('ChatView Debug:', {
        contactId: contact.id,
        contactName: contact.name,
        contactIsAi: contact.isAi,
        contactIsGroup: contact.isGroup,
        messagesCount: messages.length,
        lastMessage: messages[messages.length - 1],
        aiPersonas: aiPersonas.map(ai => ({ id: ai.id, name: ai.name, isAi: ai.isAi }))
      });
    }
  }, [contact, messages, aiPersonas]);

  const allKnownContacts = useMemo(
    () => [
      ...contacts,
      ...aiPersonas,
      {
        id: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl || undefined,
        status: currentUser.status || 'online',
        isGroup: false,
        isAi: false,
        memberIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    [contacts, aiPersonas, currentUser]
  );

  // Debug logging for allKnownContacts (development only)
  useEffect(() => {
    if (import.meta.env?.MODE === 'development' && contact && contact.isAi) {
      console.log('AI Contact Debug:', {
        contactId: contact.id,
        contactName: contact.name,
        contactIsAi: contact.isAi,
        allKnownContacts: allKnownContacts.map(c => ({ id: c.id, name: c.name, isAi: c.isAi })),
        aiPersonas: aiPersonas.map(ai => ({ id: ai.id, name: ai.name, isAi: ai.isAi }))
      });
    }
  }, [contact, allKnownContacts, aiPersonas]);

  // Mentions are transformed in the rendering layer; no local transformation

  const messagesWithDates = useMemo(() => {
    const grouped: (
      | Message
      | { type: "date_marker"; id: string; dateLabel: string; dateIso: string }
    )[] = [];
    let lastIso: string | null = null;

    messages.forEach((message) => {
      const m = DateUtils.getMoment(message.timestamp);
      const dateIso = m.format('YYYY-MM-DD');
      const dateLabel = DateUtils.formatDateSeparator(m.toDate());

      if (dateIso !== lastIso) {
        grouped.push({
          type: "date_marker",
          id: `date-${dateIso}-${message.id}`,
          dateLabel,
          dateIso,
        });
        lastIso = dateIso;
      }

      grouped.push(message);
    });

    return grouped;
  }, [messages]);

  const sendReadReceipt = useCallback(() => {
    if (!contact || contact.isAi || !messages.length || !currentUser) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.senderId === currentUser.id) return;

    const topic = contact.isGroup
      ? `chat/${contact.id}`
      : `chat/${[currentUser.id, contact.id].sort().join("-")}`;

    const payload: ReadReceipt = {
      type: "read_receipt",
      contactId: contact.id,
      readerId: currentUser.id,
    };

    mqttService.publish(topic, payload);
  }, [contact, currentUser, messages]);

  useLayoutEffect(() => {
    // Check if contact changed (new conversation)
    const contactChanged = contact?.id !== prevContactIdRef.current;
    
    // Update previous values for next comparison
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    prevContactIdRef.current = contact?.id;
    
    // Reset scroll state when switching contacts
    if (contactChanged) {
      isUserScrolledUpRef.current = false;
    }
    
    // Scroll to bottom before paint to avoid visible jump
    if (firstUnreadMessageId && separatorRef.current) {
      separatorRef.current?.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    } else if (
        messagesEndRef.current &&
        // Only auto-scroll if:
        // 1. Contact changed (fresh conversation) - always scroll
        // 2. New messages were added and user hasn't manually scrolled up
        (contactChanged || (hasNewMessages && !isUserScrolledUpRef.current))
      ) {
        // Auto-scroll will be handled by the ChatContainer StickToBottom component
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [
    messages,
    isLoading,
    typingIndicators,
    firstUnreadMessageId,
    contact?.id,
  ]);

  // Preserve input between re-renders and contact prop re-instantiations.
  // Do not clear text here; message fetching is handled elsewhere.
  useEffect(() => {
    // no-op: keep text stable across re-renders
  }, [contact?.id]);

  useEffect(() => {
    if (!contact || contact.isAi || !messages.length || !currentUser) return;

    // Identify unread incoming messages (from others) that are not yet read
    const unreadIncoming = messages.filter((m) =>
      m.senderId !== currentUser.id && (m.status === 'sent' || m.status === 'delivered')
    );

    if (unreadIncoming.length === 0) return;

    const topic = contact.isGroup
      ? `chat/${contact.id}`
      : `chat/${[currentUser.id, contact.id].sort().join("-")}`;

    const payload: ReadReceipt = {
      type: "read_receipt",
      contactId: contact.id,
      readerId: currentUser.id,
      messageIds: unreadIncoming.map((m) => m.id),
    };

    mqttService.publish(topic, payload);
  }, [messages, contact, currentUser]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current && contact && !contact.isAi && currentUser) {
        clearTimeout(typingTimeoutRef.current);
        const topic = contact.isGroup
          ? `chat/${contact.id}`
          : `chat/${[currentUser.id, contact.id].sort().join("-")}`;
        const payload: TypingIndicatorPayload = {
          type: "typing",
          contactId: contact.id,
          userId: currentUser.id,
          userName: currentUser.name,
          state: "stop",
        };
        mqttService.publish(topic, payload);
        typingTimeoutRef.current = null;
      }
    };
  }, [contact, currentUser]);

  useEffect(() => {
    sendReadReceipt();
  }, [sendReadReceipt]);

  const handleFilesChange = useCallback((files: File[]) => {
    setAttachedFiles(files);
    
    // Clean up old preview URLs and create new ones
    setFilePreviewUrls(prevUrls => {
      // Clean up old URLs that are no longer needed
      prevUrls.forEach((url, file) => {
        if (!files.includes(file)) {
          URL.revokeObjectURL(url);
        }
      });
      
      // Create preview URLs for all files
      const newPreviewUrls = new Map<File, string>();
      files.forEach(file => {
        // Reuse existing URL if file hasn't changed
        if (prevUrls.has(file)) {
          newPreviewUrls.set(file, prevUrls.get(file)!);
        } else {
          const url = URL.createObjectURL(file);
          newPreviewUrls.set(file, url);
        }
      });
      
      return newPreviewUrls;
    });
    
    // Set the first file as the primary attachment for backward compatibility
    if (files.length > 0 && !attachment) {
      const firstFile = files[0];
      let type: 'image' | 'document' | 'audio' | 'video';
      
      if (firstFile.type.startsWith('image/')) {
        type = 'image';
      } else if (firstFile.type.startsWith('video/')) {
        type = 'video';
      } else if (firstFile.type.startsWith('audio/')) {
        type = 'audio';
      } else {
        type = 'document';
      }
      
      // Create URL for the first file if needed
      const url = URL.createObjectURL(firstFile);
      
      setAttachment({ 
        type, 
        file: firstFile, 
        url,
        fileName: firstFile.name,
        fileSize: firstFile.size,
        mimeType: firstFile.type
      });
    } else if (files.length === 0) {
      setAttachment(null);
      // Clean up all preview URLs
      setFilePreviewUrls(prevUrls => {
        prevUrls.forEach(url => URL.revokeObjectURL(url));
        return new Map();
      });
    }
  }, [attachment]);

  const removeAttachedFile = useCallback((fileToRemove: File) => {
    // Clean up preview URL for the removed file and update state
    setFilePreviewUrls(prev => {
      const previewUrl = prev.get(fileToRemove);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      const next = new Map(prev);
      next.delete(fileToRemove);
      return next;
    });

    setAttachedFiles(prev => {
      const newFiles = prev.filter(f => f !== fileToRemove);
      
      // If the removed file was the attachment, clear it or set a new one
      if (attachment?.file === fileToRemove) {
        if (newFiles.length > 0) {
          const nextFile = newFiles[0];
          let type: 'image' | 'document' | 'audio' | 'video';
          
          if (nextFile.type.startsWith('image/')) {
            type = 'image';
          } else if (nextFile.type.startsWith('video/')) {
            type = 'video';
          } else if (nextFile.type.startsWith('audio/')) {
            type = 'audio';
          } else {
            type = 'document';
          }
          
          // Create new URL for the next file
          const url = URL.createObjectURL(nextFile);
          setAttachment({ 
            type, 
            file: nextFile, 
            url,
            fileName: nextFile.name,
            fileSize: nextFile.size,
            mimeType: nextFile.type
          });
        } else {
          setAttachment(null);
        }
      }
      
      return newFiles;
    });
    
    // Clean up upload progress
    setUploadProgress(prev => {
      const next = new Map(prev);
      next.delete(fileToRemove);
      return next;
    });
    
    // Remove from uploading files
    setUploadingFiles(prev => {
      const next = new Set(prev);
      next.delete(fileToRemove);
      return next;
    });
  }, [attachment]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Emit typing events when input changes via PromptInput
  useEffect(() => {
    if (!contact || contact.isAi || !currentUser) return;
    const hasText = !!inputText && inputText.trim().length > 0;
    const topic = contact.isGroup
      ? `chat/${contact.id}`
      : contact.topicId || `chat/${[currentUser.id, contact.id].sort().join("-")}`;

    if (hasText) {
      // Only send 'start' once per typing session
      if (!typingTimeoutRef.current) {
        const startPayload: TypingIndicatorPayload = {
        type: "typing",
        contactId: contact.id,
        userId: currentUser.id,
        userName: currentUser.name,
        state: "start",
      };
        mqttService.publish(topic, startPayload);
      }

      // Reset debounce timer for 'stop'
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => {
        const stopPayload: TypingIndicatorPayload = {
          type: "typing",
          contactId: contact.id,
          userId: currentUser.id,
          userName: currentUser.name,
          state: "stop",
        };
        mqttService.publish(topic, stopPayload);
        typingTimeoutRef.current = null;
      }, 1000);
    } else {
      // If text cleared, ensure a single 'stop'
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      const stopPayload: TypingIndicatorPayload = {
        type: "typing",
        contactId: contact.id,
        userId: currentUser.id,
        userName: currentUser.name,
        state: "stop",
      };
      mqttService.publish(topic, stopPayload);
    }
  }, [inputText, contact?.id, currentUser?.id]);

  // Legacy manual mention selection removed (DiceUI Mention inserts on Enter)

  // Removed mention highlighting backdrop in favor of PromptInput simplicity

  // legacy helpers removed



  // Enhanced handleSubmit to work with attachedFiles
  const handleSubmitWithAttachedFiles = async () => {
    if (typingTimeoutRef.current && contact && !contact.isAi && currentUser) {
      clearTimeout(typingTimeoutRef.current);
      const topic = contact.isGroup
        ? `chat/${contact.id}`
        : contact.topicId ||
        `chat/${[currentUser.id, contact.id].sort().join("-")}`;
      const payload: TypingIndicatorPayload = {
        type: "typing",
        contactId: contact.id,
        userId: currentUser.id,
        userName: currentUser.name,
        state: "stop",
      };
      mqttService.publish(topic, payload);
      typingTimeoutRef.current = null;
    }

    const trimmed = inputText.trim();
    // Prevent sending if only '@' or empty and no files
    if (((trimmed && trimmed !== "@") || attachedFiles.length || attachment) && !isLoading) {
      // De-dup guard
      const sig = `${trimmed}|${attachedFiles.map(f => f.name).join(',') || attachment?.file?.name || ""}`;
      const now = Date.now();
      if (
        lastSubmitRef.current &&
        lastSubmitRef.current.sig === sig &&
        now - lastSubmitRef.current.at < 800
      ) {
        return;
      }
      lastSubmitRef.current = { sig, at: now };

      // Add reply information if replying to a message
      const replyInfo = replyingTo
        ? {
          replyTo: {
            id: replyingTo.id,
            text: replyingTo.text,
            senderId: replyingTo.senderId,
            senderName: replyingTo.senderName,
          },
        }
        : undefined;

      // Handle file attachments - upload to Supabase storage and create attachments
      let fileAttachment = attachment;
      let additionalAttachments: Attachment[] = [];

      if (attachedFiles.length > 0 && currentUser && contact) {
        try {
          // Set uploading state for all files
          setUploadingFiles(new Set(attachedFiles));
          
          // Upload files to Supabase storage
          const uploadResults = await StorageService.uploadMultipleFiles(
            attachedFiles,
            currentUser.id,
            contact.id, // Pass contact.id as chatId for bucket naming
            (file, progress) => {
              setUploadProgress(prev => new Map(prev.set(file, progress)));
            }
          );

          // Convert upload results to attachments - put ALL files in additionalAttachments to avoid duplicates
          for (let i = 0; i < uploadResults.length; i++) {
            const result = uploadResults[i];
            const file = attachedFiles[i];
            
            let type: 'image' | 'document' | 'audio' | 'video';
            if (file.type.startsWith('image/')) {
              type = 'image';
            } else if (file.type.startsWith('video/')) {
              type = 'video';
            } else if (file.type.startsWith('audio/')) {
              type = 'audio';
            } else {
              type = 'document';
            }
            
            const newAttachment = {
              type,
              file,
              url: result.url, // Use the Supabase storage URL
              fileName: result.fileName,
              fileSize: result.fileSize,
              mimeType: result.mimeType
            };

            // Add ALL uploaded files to additionalAttachments (no primary attachment for uploaded files)
            additionalAttachments.push(newAttachment);
          }
          
          // Clear fileAttachment if we uploaded files to prevent duplicates
          if (attachedFiles.length > 0) {
            fileAttachment = null;
          }
          
          // Clear uploading state
          setUploadingFiles(new Set());
          setUploadProgress(new Map());
          
// Files uploaded successfully
        } catch (error) {
          console.error('Failed to upload files:', error);
          // Clear uploading state on error
          setUploadingFiles(new Set());
          setUploadProgress(new Map());
          // TODO: Show error message to user
          return; // Don't send message if upload fails
        }
      }

      // Call onSendMessage with multiple attachments support
      onSendMessage(trimmed, fileAttachment || undefined, replyInfo, additionalAttachments.length > 0 ? additionalAttachments : undefined);
      
      // Reset scroll state when sending a message (user expects to see their new message)
      isUserScrolledUpRef.current = false;
      
      setInputText("");
      setAttachment(null);
      setAttachedFiles([]);
      // Clean up all preview URLs after sending
      setFilePreviewUrls(prevUrls => {
        prevUrls.forEach(url => URL.revokeObjectURL(url));
        return new Map();
      });
      setReplyingTo(null);
      // Force DiceUI Mention to reset any previous tags
      setMentionResetKey((k) => k + 1);
    }
  };

  // Removed local keydown handling to allow DiceUI Mention to manage Enter/Arrows

  if (!contact) {
    return (
      <div className="relative flex-1 flex items-center justify-center h-screen p-6 md:p-10 overflow-hidden bg-[radial-gradient(ellipse_at_bottom,color-mix(in_oklch,var(--primary)_25%,transparent),transparent_65%),radial-gradient(ellipse_at_bottom_right,transparent_65%)]">
         <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="text-center max-w-4xl w-full 
          bg-card/70 backdrop-blur-xl border border-border/40 rounded-3xl shadow-lg shadow-black/30 p-8"
      >
        <motion.div
          className="flex mb-4 justify-center gap-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <a
            href="#"
            className="flex items-center gap-3 font-semibold text-xl group transition-all duration-300 hover:scale-105"
          >
            <motion.div
              className="bg-primary text-white flex size-8 items-center justify-center rounded-md shadow-lg shadow-[#3B37FE]/25"
              whileHover={{ rotate: 5, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <MessagesSquare className="size-5" />
            </motion.div>
            <span className="text-foreground font-bold tracking-tight">
              Relay
            </span>
          </a>
        </motion.div>

        {/* Welcome Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Welcome, {currentUser.name}! 👋
        </h1>
        
        <p className="text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
          Start a conversation, create a group, or chat with one of our AI assistants. 
          Fast, modern, and real-time messaging.
        </p>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
          <motion.div whileHover={{ scale: 1.04 }}>
            <HeroButton 
              onClick={onInviteUser} 
              size="lg" 
              color="primary"
              className="min-w-[180px]"
            >
              Invite a Friend
            </HeroButton>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }}>
            <HeroButton 
              onClick={onNewGroup} 
              size="lg"
              variant="bordered"
              className="min-w-[180px]"
            >
              Create a Group
            </HeroButton>
          </motion.div>
        </div>

        {/* AI Personas */}
        <div className="text-left">
          <h2 className="text-xl font-bold text-foreground mb-5">Or, chat with an AI assistant</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {aiPersonas.map((persona, i) => {
              const isAdded = contacts.some((c) => c.id === persona.id);
              return (
                <motion.div
                  key={persona.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut", delay: i * 0.03 }}
                  whileHover={{ y: -3, scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                  className="bg-card/90 shadow-sm p-4 rounded-xl flex items-center gap-4 border border-border/50 transition-all"
                >
                  <motion.div whileHover={{ scale: 1.05 }} className="relative">
                    <GeneratedAvatar name={persona.name} allContacts={[...aiPersonas, ...contacts]} currentUser={currentUser} />
                  </motion.div>
                  <div className="flex-1 text-left overflow-hidden">
                    <h3 className="font-semibold text-foreground">{persona.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {persona.systemInstruction?.split(".")[0]}.
                    </p>
                  </div>
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={() => onAddAiContact(persona)}
                      disabled={isAdded}
                      variant={isAdded ? "outline" : "ghost"}
                      size="icon"
                    >
                      {isAdded ? <CheckIcon className="w-5 h-5 text-green-500" /> : <PlusIcon className="w-5 h-5" />}
                    </Button>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
        {/* Onboarding dialog */}
        <Dialog open={showOnboarding} onOpenChange={(o) => {
          setShowOnboarding(o);
          if (!o) cookies.set('relay_onboarding_dismissed_v1', '1', { expires: 365 });
        }}>
          <DialogContent className="max-w-lg rounded-3xl">
            <DialogHeader>
              <DialogTitle>Hi{currentUser?.name ? `, ${currentUser.name}` : ''} 👋</DialogTitle>
              <DialogDescription>Pick a theme to get started. You can change this anytime in Settings.</DialogDescription>
            </DialogHeader>
            {/* Minimal, elegant greeting + theme selection */}
            <div className="grid gap-6">
            <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="ghost"
                  onClick={() => { setSelectedTheme('light'); theme.setTheme('light'); cookies.set('vite-ui-theme', 'light', { expires: 365 }); }}
                  className={`relative h-28 rounded-xl border overflow-hidden transition-colors ${selectedTheme === 'light' ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-card/50'}`}
                  aria-pressed={selectedTheme === 'light'}
                >
                  <img src="/images/light.svg" alt="Light preview" loading="eager" fetchPriority="high" decoding="sync" className="hover:scale-105 transition-all duration-300 absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none"></div>
                  {selectedTheme === 'light' && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0, y: 6 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="absolute bottom-2 right-2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-sm"
                    >
                      <motion.svg
                        viewBox="0 0 24 24"
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.path
                          d="M20 6L9 17l-5-5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ strokeDasharray: "32 32", strokeDashoffset: 32 }}
                          animate={{ strokeDashoffset: 0 }}
                          transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
                        />
                      </motion.svg>
                    </motion.span>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => { setSelectedTheme('dark'); theme.setTheme('dark'); cookies.set('vite-ui-theme', 'dark', { expires: 365 }); }}
                  className={`relative h-28 rounded-xl border overflow-hidden transition-colors ${selectedTheme === 'dark' ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-card/50'}`}
                  aria-pressed={selectedTheme === 'dark'}
                >
                  <img src="/images/dark.svg" alt="Dark preview" loading="eager" fetchPriority="high" decoding="sync" className="hover:scale-105 transition-all duration-300 absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none"></div>
                  {selectedTheme === 'dark' && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0, y: 6 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="absolute bottom-2 right-2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-sm"
                    >
                      <motion.svg
                        viewBox="0 0 24 24"
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.path
                          d="M20 6L9 17l-5-5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ strokeDasharray: "32 32", strokeDashoffset: 32 }}
                          animate={{ strokeDashoffset: 0 }}
                          transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
                        />
                      </motion.svg>
                    </motion.span>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => { setSelectedTheme('system'); theme.setTheme('system'); cookies.set('vite-ui-theme', 'system', { expires: 365 }); }}
                  className={`relative h-28 rounded-xl border overflow-hidden transition-colors ${selectedTheme === 'system' ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-card/50'}`}
                  aria-pressed={selectedTheme === 'system'}
                >
                  <img src="/images/system.svg" alt="System preview" loading="eager" fetchPriority="high" decoding="sync" className="hover:scale-105 transition-all duration-300 absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none"></div>
                  {selectedTheme === 'system' && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0, y: 6 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="absolute bottom-2 right-2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-sm"
                    >
                      <motion.svg
                        viewBox="0 0 24 24"
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.path
                          d="M20 6L9 17l-5-5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ strokeDasharray: "32 32", strokeDashoffset: 32 }}
                          animate={{ strokeDashoffset: 0 }}
                          transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
                        />
                      </motion.svg>
                    </motion.span>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-3 text-start font-bold text-md text-muted-foreground">
                <span>Light</span>
                <span>Dark</span>
                <span>System</span>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => { theme.setTheme(selectedTheme); cookies.set('vite-ui-theme', selectedTheme, { expires: 365 }); cookies.set('relay_onboarding_dismissed_v1', '1', { expires: 365 }); setShowOnboarding(false); }}>Done</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

    );
  }

  // Only show separate AI typing indicator if no message placeholder exists yet
  const isAiTyping =
    !!contact?.isAi &&
    aiThinking &&
    (!aiStream?.messageId || !messages.some((m) => m.id === aiStream?.messageId));
  const typingUserNames = Object.values(typingIndicators);
  const isUserTyping = contact && !contact.isAi && typingUserNames.length > 0;

  const getMemberNames = () => {
    if (!contact.isGroup) return null;
    return (contact.memberIds || [])
      .map((id) => {
        if (id === currentUser.id) return "You";
        return allKnownContacts.find((c) => c.id === id)?.name || id;
      })
      .filter((name): name is string => !!name)
      .join(", ");
  };

  const renderPresence = () => {
    if (liveContact?.isGroup) {
      return (
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
          {getMemberNames()}
        </p>
      );
    }

    const presenceText = liveContact ? formatPresence(liveContact) : "";
    const statusColor =
      liveContact?.status === "online"
        ? "bg-green-500"
        : liveContact?.status === "away"
          ? "bg-amber-500"
          : "hidden";

    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {presenceText}
        </p>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="p-3 md:p-4 border-b flex items-center gap-3 bg-background/80 backdrop-blur-sm z-10">
        {onBack &&
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="md:hidden"
            aria-label="Back to messages"
          >
            <ArrowLeft />
          </Button>
        }
{contact.isGroup ? (
          <div className="flex-shrink-0">
            <AvatarGroup max={4} size="sm" isBordered className="flex-shrink-0">
              {(contact.memberIds || []).map((memberId) => {
                const member = allKnownContacts.find(c => c.id === memberId);
                console.log(`Avatar for member ${memberId}:`, member);
                if (!member) return null;
                return (
                  <Avatar
                    key={memberId}
                    src={member.avatarUrl || undefined}
                    name={member.name}
                  />
                );
              })}
            </AvatarGroup>
          </div>
        ) : (
        <GeneratedAvatar
          name={liveContact?.name || contact.name}
            isGroup={false}
          allContacts={allKnownContacts}
          currentUser={currentUser}
        />
        )}
        <div className="flex-1 overflow-hidden">
          <h2 className="text-lg font-bold truncate">
            {liveContact?.name || contact.name}
          </h2>
          {renderPresence()}
        </div>
        {contact.isGroup && (
          <Button
            onClick={() => onEditGroup(contact)}
            variant={"ghost"}
            size={"icon"}
            aria-label="Edit group"
          >
            <Edit className="w-5 h-5" />
          </Button>
        )}
      </header>
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                <ChatContainerRoot 
          className="flex-1"
          onScroll={(e) => {
          const el = e.currentTarget as HTMLElement;
            
            // Track if user has scrolled up from bottom
            const isAtBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 50; // 50px threshold
            isUserScrolledUpRef.current = !isAtBottom;
            
          // Load older messages when reaching the very top
          if (el.scrollTop <= 0 && !isLoadingOlder) {
            const oldest = messages[0];
            if (oldest) {
              setIsLoadingOlder(true);
              void MessageService.getMessagesBeforeDate(contact.id, !!contact.isGroup, oldest.timestamp, 50)
                .then((older) => {
                  if (older && older.length > 0) {
                    const map = new Map<string, Message>();
                    for (const m of [...older, ...messages]) map.set(m.id, m);
                    const merged = Array.from(map.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    if (typeof onLoadOlder === 'function') {
                      onLoadOlder(contact.id, merged);
                    }
                  }
                })
                .catch(() => {})
                .finally(() => setIsLoadingOlder(false));
            }
          }
          // Update sticky current date based on date markers
          const containerRect = el.getBoundingClientRect();
          const nodes = Array.from(el.querySelectorAll('[data-date-marker="true"]')) as HTMLElement[];
          const threshold = 48; // px from top within container
          let activeIso: string | null = null;
          let lastTop = -Infinity;
          for (const node of nodes) {
            const top = node.getBoundingClientRect().top - containerRect.top;
            if (top <= threshold && top >= lastTop) {
              activeIso = node.getAttribute('data-date-iso');
              lastTop = top;
            }
          }
          if (!activeIso && nodes.length > 0) {
            activeIso = nodes[0].getAttribute('data-date-iso');
          }
          setCurrentDate(activeIso ? DateUtils.formatDateSeparator(activeIso) : null);
          }}
        >
          <ChatContainerContent className="space-y-4 px-8 py-6 bg-transparent">
{/* Single sticky date header */}
            <div className="sticky top-0 pt-2 z-[6] flex justify-center pointer-events-none">
              {currentDate && (
                <div className="px-3 py-0.5 rounded-full text-xs font-medium text-foreground/80 bg-muted/90 ring-1 ring-border/60 shadow-sm">
                  {currentDate}
                </div>
              )}
            </div>
            {/* Subtle top loader for fetching older messages */}
            {isLoadingOlder && (
              <div className="sticky top-8 z-[7] flex justify-center">
                <div className="mt-2 flex items-center gap-2 px-2 py-1 rounded-full bg-muted/70 text-xs text-muted-foreground ring-1 ring-border/60 shadow-sm">
                  <Loader variant="loading-dots" text="Loading older" size="sm" />
                </div>
              </div>
            )}
            {messagesWithDates.map((item) => {
              if ("type" in item && item.type === "date_marker") {
                return (
                  <div key={item.id} data-date-marker="true" data-date-iso={item.dateIso} className="flex justify-center my-2">
                    <DateSeparator date={item.dateLabel} />
                  </div>
                );
              }
              const msg = item as Message;

              const isSelf = msg.senderId === currentUser.id || (msg as any).senderId === currentUser.id;
              
              // Improved sender identification for AI messages
              let sender = allKnownContacts.find(
                (c) =>
                  c.id ===
                  (msg.isGroup ? msg.senderId : msg.senderId || msg.contactId)
              );
              
              // Handle AI messages with aiSenderId
              if (!sender && (msg as any).aiSenderId) {
                const aiPersona = aiPersonas.find(ai => ai.id === (msg as any).aiSenderId);
                if (aiPersona) {
                  sender = aiPersona;
                }
              }
              
              // Handle old AI messages by sender name
              if (!sender && !isSelf) {
                const senderName = msg.senderName || '';
                if (senderName === 'Code Assistant' || senderName === 'AI Assistant' || senderName.includes('Assistant')) {
                  const aiPersona = aiPersonas.find(ai => ai.name === senderName || ai.id === 'code-assistant');
                  if (aiPersona) {
                    sender = aiPersona;
                  }
                }
              }
              
              // If no sender found and this is an AI contact, use the contact itself
              if (!sender && contact.isAi && !isSelf) {
                sender = contact;
              }
              
              // If no sender found and the message sender is an AI persona, find it
              if (!sender && !isSelf) {
                const aiPersona = aiPersonas.find(ai => ai.id === msg.senderId);
                if (aiPersona) {
                  sender = aiPersona;
                }
              }
              
              // Fallback to contact if still no sender
              if (!sender && !isSelf) {
                sender = contact;
              }

              // Debug logging for message sender identification (only in development for code messages)
              if (import.meta.env?.MODE === 'development' && msg.text && msg.text.includes('```')) {
                console.log('Message sender identification:', {
                  messageId: msg.id,
                  senderId: msg.senderId,
                  senderName: sender?.name,
                  contactIsAi: contact.isAi,
                  isSelf
                });
              }

              return (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  isSelf={isSelf}
                  sender={sender}
                  contact={contact}
                  aiPersonas={aiPersonas}
                  aiStream={aiStream}
                  allKnownContacts={allKnownContacts}
                  theme={theme}
                  copied={copied}
                  setCopied={setCopied}
                  handleCopy={handleCopy}
                  onReact={onReact}
                  onForward={onForward}
                  setReplyingTo={setReplyingTo}
                  openEmojiForMessageId={openEmojiForMessageId}
                  setOpenEmojiForMessageId={setOpenEmojiForMessageId}
                  currentUser={currentUser}
                  handleImagePreview={handleImagePreview}
                />
              );
            })}
            
            {/* Show loading indicator when no messages yet */}
            {messages.length === 0 && !isAiTyping && !isUserTyping && !isLoadingOlder && (
              <div className="flex justify-center items-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <Loader variant="circular" className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading conversation...</p>
                </div>
              </div>
            )}
            
            {isAiTyping && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-2.5 py-1">
                  <GeneratedAvatar
                    name={contact.name}
                    isGroup={contact.isGroup}
                    memberIds={contact.memberIds}
                    allContacts={allKnownContacts}
                    currentUser={currentUser}
                  />
                  <div className="px-3 py-2 bg-muted rounded-2xl ">
                    <Loader variant="text-shimmer" text="AI is thinking" />
                  </div>
                </div>
              </motion.div>
            )}
            {isUserTyping && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                key="typing-indicator"
                className="flex justify-start"
              >
                <div className="flex items-end gap-2.5">
                  <div className="flex p-2 bg-muted rounded-2xl ">
                    <Loader variant="typing" />
                  </div>

                  <div className="text-xs text-muted-foreground pb-1">{typingUserNames[0]} is typing</div>
                </div>
              </motion.div>
            )}
                        <ChatContainerScrollAnchor ref={messagesEndRef} />
          </ChatContainerContent>
          <div className="absolute right-7 bottom-20 -translate-y-1/2 z-10">
            <ScrollButton />
          </div>
        </ChatContainerRoot>
      </div>
      {/* Hidden cache warmer to avoid repeated network fetches on first open */}
      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0">
        <EmojiPickerReact
          lazyLoadEmojis={true}
          autoFocusSearch={false}
          suggestedEmojisMode={SuggestionMode.FREQUENT}
          theme={
            document.documentElement.classList.contains("dark")
              ? ("dark" as EmojiTheme)
              : ("light" as EmojiTheme)
          }
        />
      </div>
      <div className="m-4 mt-0 z-10 bottom-0 ">
        {replyingTo && (
          <div className="mb-2 flex items-start gap-2 bg-slate-200 dark:bg-slate-800 p-2 rounded-lg relative">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <ReplyIcon className="w-4 h-4 mr-1 text-primary" />
                <span className="font-medium text-sm text-primary">
                  Replying to {replyingTo.senderName}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                {replyingTo.text}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label="Cancel reply"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* File Upload Component */}
        <FileUpload
          value={attachedFiles}
          onValueChange={handleFilesChange}
          maxFiles={10}
          maxSize={10 * 1024 * 1024} // 10MB
          multiple={true}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
        >
          {attachedFiles.length > 0 && (
            <FileUploadList orientation="horizontal" className="mb-3 p-3 bg-muted/30 rounded-lg border">
              {attachedFiles.map((file, index) => {
                const fileType = file.type.startsWith('image/') ? 'image' : 
                               file.type.startsWith('video/') ? 'video' :
                               file.type.startsWith('audio/') ? 'audio' : 'document';
                
                const iconColor = fileType === 'image' ? 'text-blue-600' :
                                 fileType === 'video' ? 'text-purple-600' :
                                 fileType === 'audio' ? 'text-green-600' : 'text-gray-600';
                
                const bgColor = fileType === 'image' ? 'bg-blue-100 dark:bg-blue-900/20' :
                               fileType === 'video' ? 'bg-purple-100 dark:bg-purple-900/20' :
                               fileType === 'audio' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-800';

                const progress = uploadProgress.get(file) || 0;
                const isUploading = uploadingFiles.has(file);

                // Get the preview URL for this file
                const previewUrl = filePreviewUrls.get(file);

                return (
                  <FileUploadItem key={index} value={file} className="relative">
                    {/* Progress bar using FileUploadItemProgress */}
                    {isUploading && progress < 100 && (
                      <FileUploadItemProgress 
                        style={{ width: `${progress}%` }}
                        className="absolute inset-0 bg-primary/20 rounded transition-all z-10"
                      />
                    )}
                    
                    <FileUploadItemPreview className={`${bgColor} relative overflow-hidden`}>
                      {/* Show image preview if available */}
                      {fileType === 'image' && previewUrl ? (
                        <img 
                          src={previewUrl} 
                          alt={file.name}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : fileType === 'image' ? (
                        <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ) : fileType === 'video' ? (
                        <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      ) : fileType === 'audio' ? (
                        <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      ) : (
                        <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </FileUploadItemPreview>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                        {isUploading && progress < 100 && (
                          <span className="ml-1">({progress}%)</span>
                        )}
                      </div>
                    </div>
                    
                    <FileUploadItemDelete asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                        onClick={() => removeAttachedFile(file)}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </FileUploadItemDelete>
                  </FileUploadItem>
                );
              })}
            </FileUploadList>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSubmitWithAttachedFiles(); }} className="flex w-full items-start gap-3">

  <PromptInput
    value={inputText}
    onValueChange={setInputText}
    isLoading={isLoading}
    onSubmit={() => handleSubmitWithAttachedFiles()}
    className="flex items-center border-input bg-card relative z-10 w-full border rounded-2xl pt-1 shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
  >
    {/* Emoji picker overlay */}
    <div className="relative">
      {isComposerEmojiOpen && (
        <div className="absolute bottom-[100%] left-0 mb-2 z-50 emoji-picker-container">
          <EmojiPickerReact
            onEmojiClick={(emojiData: any) => {
              setComposerEmojiOpen(false);
              setInputText((prev) => prev + emojiData.emoji);
            }}
            lazyLoadEmojis={true}
            autoFocusSearch={false}
            suggestedEmojisMode={SuggestionMode.FREQUENT}
            theme={
              document.documentElement.classList.contains("dark")
                ? ("dark" as EmojiTheme)
                : ("light" as EmojiTheme)
            }
          />
        </div>
      )}
    </div>

    {/* Actions before textarea */}
    <div className="flex items-center gap-2 px-3 py-3 w-full">
      <PromptInputActions>
        <PromptInputAction 
          tooltip="Attach files" 
          icon={Paperclip}
          variant="ghost"
          size="md"
          onClick={() => {
            // Create a temporary file input
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar';
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files && files.length > 0) {
                handleFilesChange(Array.from(files));
              }
            };
            input.click();
          }}
        />
        <PromptInputAction 
          tooltip="Emoji" 
          icon={Smile}
          variant="ghost"
          size="md"
            data-emoji-trigger
            onMouseDown={(e) => {
              e.preventDefault();
              setComposerEmojiOpen(true);
            }}
            onClick={() => setComposerEmojiOpen(true)}
        />
      </PromptInputActions>

      {/* Textarea / Mention input */}
      <div className="flex-1 min-w-0">
        {contact?.isGroup ? (
          <Mention 
            key={mentionKey}
            className="w-full [--dice-transform-origin:10px] **:data-tag:rounded-full  **:data-tag:bg-primary **:data-tag:text-primary-foreground dark:**:data-tag:bg-primary dark:**:data-tag:text-primary-foreground"
            inputValue={inputText}
            onInputValueChange={setInputText}
          >
            <MentionInput
              placeholder="Type a message..."
              className="flex w-full text-base leading-[1.3] px-3 py-2 self-center border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
              asChild
            >
              <PromptInputTextarea />
            </MentionInput>
            <MentionContent className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 min-w-[var(--dice-anchor-width)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in">
              {(contact.memberIds || [])
                .filter((id) => id !== currentUser.id)
                .map((id) => {
                  const member = allKnownContacts.find((c) => c.id === id);
                  if (!member) return null;
                  return (
                    <MentionItem
                      key={member.id}
                      value={member.name}
                      className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50"
                    >
                      <GeneratedAvatar
                        key={member.id + "-avatar"}
                        name={member.name}
                        allContacts={allKnownContacts}
                        currentUser={currentUser}
                      />
                      <span className="font-medium">{member.name}</span>
                    </MentionItem>
                  );
                })}
            </MentionContent>
          </Mention>
        ) : (
          <PromptInputTextarea
            placeholder="Type a message..."
            className="flex w-full text-base leading-[1.3] px-3 py-2 self-center"
          />
        )}
      </div>

      {/* Send button */}
      <Button
        disabled={!inputText.trim() && !attachment && !attachedFiles.length}
        onClick={handleSubmitWithAttachedFiles}
        className="h-10 px-6 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        type="button"
      >
        <Send className="size-4" />
      </Button>
    </div>
  </PromptInput>
</form>
        </FileUpload>

        {/* Mobile Message Actions Popover */}
        {mobileMessageActions && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
            onClick={() => setMobileMessageActions(null)}
          >
            <div
              className="mobile-message-actions bg-popover border rounded-lg shadow-lg p-2 max-w-[320px] w-auto"
              style={{
                position: 'absolute',
                left: `${mobileMessageActions.x}px`,
                top: `${mobileMessageActions.y}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Show reaction picker directly in mobile popover */}
              <div className="flex flex-col gap-1">
                <div className="mb-2">
                  <EmojiPickerReact
                    reactionsDefaultOpen={true}
                    onEmojiClick={(emojiData: any) => {
                      const message = messages.find(m => m.id === mobileMessageActions.messageId);
                      if (message) {
                        onReact(message.id, emojiData.emoji);
                      }
                      setMobileMessageActions(null);
                    }}
                    lazyLoadEmojis={true}
                    autoFocusSearch={false}
                    suggestedEmojisMode={SuggestionMode.FREQUENT}
                    theme={
                      document.documentElement.classList.contains("dark")
                        ? ("dark" as EmojiTheme)
                        : ("light" as EmojiTheme)
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    const message = messages.find(m => m.id === mobileMessageActions.messageId);
                    if (message) {
                      setReplyingTo(message);
                    }
                    setMobileMessageActions(null);
                  }}
                >
                  <Reply className="w-4 h-4 mr-2" />
                  Reply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    // Forward logic
                    const message = messages.find(m => m.id === mobileMessageActions.messageId);
                    if (message) {
                      onForward(message);
                    }
                    setMobileMessageActions(null);
                  }}
                >
                  <Forward className="w-4 h-4 mr-2" />
                  Forward
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    // Copy logic
                    const message = messages.find(m => m.id === mobileMessageActions.messageId);
                    if (message) {
                      navigator.clipboard.writeText(message.text || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                    setMobileMessageActions(null);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Image Preview Overlay */}
        {imagePreview && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setImagePreview(null)}
          >
            {/* Close and Download buttons */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-black/50 hover:bg-black/70 text-white border-white/20 backdrop-blur-sm"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    // Fetch the image as blob to force download
                    const response = await fetch(imagePreview.url);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = imagePreview.fileName || 'image.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error('Download failed:', error);
                    // Fallback to simple download
                    const link = document.createElement('a');
                    link.href = imagePreview.url;
                    link.download = imagePreview.fileName || 'image.png';
                    link.click();
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-black/50 hover:bg-black/70 text-white border-white/20 backdrop-blur-sm"
                onClick={() => setImagePreview(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* File info overlay */}
            <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-3 py-2 rounded-lg text-sm backdrop-blur-sm">
              <div className="font-medium">{imagePreview.fileName || 'Image'}</div>
              {imagePreview.fileSize && (
                <div className="text-xs opacity-75">
                  {(imagePreview.fileSize / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>

            {/* Fullscreen Image */}
            <motion.img
              src={imagePreview.url}
              alt={imagePreview.fileName || 'Image preview'}
              className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* ESC to close hint */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm backdrop-blur-sm bg-black/30 px-3 py-1 rounded-full">
              Press ESC or click outside to close
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
})

ChatView.displayName = 'ChatView';

export default ChatView;
