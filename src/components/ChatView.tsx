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
import { fileToBase64 } from "../utils/imageUtils";
import { formatPresence, DateUtils } from "../utils/dateUtils";

import GeneratedAvatar from "./GeneratedAvatar";
import TypingIndicatorWithAvatars from "./TypingIndicatorWithAvatars";
import DateSeparator from "./DateSeparator";
// import NewMessagesSeparator from "./NewMessagesSeparator";
// import MentionSuggestions from "./MentionSuggestions";

import CloseIcon from "./icons/CloseIcon";
import PlusIcon from "./icons/PlusIcon";
import CheckIcon from "./icons/CheckIcon";

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
  Share2,
} from "lucide-react";
import { Paperclip } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import EmojiPickerReact, { SuggestionMode } from "emoji-picker-react";
import { useTheme } from "./theme-provider";
import { ScrollButton } from "./ui/scroll-button";
import { Badge } from "./ui/badge";

import { Mention, MentionContent, MentionInput, MentionItem } from "@/components/ui/mention";
import { Theme as EmojiTheme } from "emoji-picker-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { cookies } from "@/lib/cookies";
import { MentionText } from "@/components/ui/mention-text";
import { getSenderColorClass } from "@/utils/colorUtils";
import { MessageService } from "@/services/messageService";
import { Avatar, AvatarGroup, Popover as HeroPopover, PopoverTrigger as HeroPopoverTrigger, PopoverContent as HeroPopoverContent, Button as HeroButton } from "@heroui/react";
//

// Memoized components for better performance
const MemoizedGeneratedAvatar = memo(GeneratedAvatar);
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
    replyInfo?: { replyTo: Message["replyTo"] }
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
  currentUser
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

  const isStreamingThis = useMemo(() => {
    const isAiContact = contact.isAi;
    const isGroupWithAi = contact.isGroup && aiPersonas.some(ai => ai.id === msg.senderId);
    const hasAiStream = !!aiStream;
    const messageMatches = aiStream?.messageId === msg.id;
    
    console.log('isStreamingThis check:', {
      msgId: msg.id,
      isAiContact,
      isGroupWithAi, 
      hasAiStream,
      aiStreamMessageId: aiStream?.messageId,
      messageMatches,
      aiStreamText: aiStream?.text?.length || 0,
      result: (isAiContact || isGroupWithAi) && hasAiStream && messageMatches
    });
    
    return (isAiContact || isGroupWithAi) && hasAiStream && messageMatches;
  }, [contact.isAi, contact.isGroup, aiPersonas, aiStream?.messageId, msg.senderId, msg.id]);

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
      
      // Debug logging for AI detection
      if (hasAiFields || isAiByName) {
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
      
      // Debug logging for AI detection
      if (hasAiFields || isAiByName) {
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

  // Custom streaming implementation
  const [hasReceivedResponse, setHasReceivedResponse] = useState(false);
  const [displayedCharCount, setDisplayedCharCount] = useState(0);
  const [fullResponse, setFullResponse] = useState("");
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug the overall streaming state
  useEffect(() => {
    console.log('Streaming state update:', {
      isStreamingThis,
      messageId: aiStream?.messageId,
      hasText: !!aiStream?.text,
      textLength: aiStream?.text?.length || 0
    });
  }, [isStreamingThis, aiStream]);

  // Reset when streaming starts/stops
  useEffect(() => {
    if (isStreamingThis && aiStream?.messageId) {
      console.log('🔄 Resetting for new stream:', aiStream.messageId);
      setHasReceivedResponse(false);
      setDisplayedCharCount(0);
      setFullResponse("");
      setIsStreamingActive(false);
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    }
  }, [isStreamingThis, aiStream?.messageId]);

  // Track when we receive the response
  useEffect(() => {
    console.log('Response check:', {
      isStreamingThis,
      hasText: !!aiStream?.text,
      hasReceivedResponse,
      textPreview: aiStream?.text?.substring(0, 50) + '...'
    });
    
    if (isStreamingThis && aiStream?.text && !hasReceivedResponse) {
      console.log('📝 AI response received, will start streaming:', aiStream.text.length, 'characters');
      console.log('Response preview:', aiStream.text.substring(0, 100) + '...');
      setFullResponse(aiStream.text);
      // Small delay to show thinking state
      setTimeout(() => {
        console.log('🚀 Starting streaming...');
        setHasReceivedResponse(true);
        setIsStreamingActive(true);
        setDisplayedCharCount(0);
      }, 1000);
    }
  }, [isStreamingThis, aiStream?.text, hasReceivedResponse]);

  // Custom character-by-character streaming
  useEffect(() => {
    if (isStreamingActive && fullResponse && displayedCharCount < fullResponse.length) {
      streamingIntervalRef.current = setInterval(() => {
        setDisplayedCharCount(prev => {
          const next = prev + 1;
          console.log('Streaming char:', next, '/', fullResponse.length);
          if (next >= fullResponse.length) {
            console.log('Streaming complete!');
            setIsStreamingActive(false);
            if (streamingIntervalRef.current) {
              clearInterval(streamingIntervalRef.current);
              streamingIntervalRef.current = null;
            }
          }
          return next;
        });
                   }, 15); // 15ms per character - faster typing
    }

    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
    };
  }, [isStreamingActive, fullResponse, displayedCharCount]);

          const aiDisplayedText = useMemo(() => {
          if (!isStreamingThis) return "";
          if (!hasReceivedResponse) {
            console.log('Still thinking...');
            return ""; // Show thinking state
          }
          const text = fullResponse.slice(0, displayedCharCount);
          console.log('Displaying:', text.length, '/', fullResponse.length, 'chars');
          // Ensure we return a valid string and handle incomplete markdown
          const safeText = typeof text === 'string' ? text : String(text || '');
          // Additional safety: ensure we don't have any object-like content
          return safeText.toString();
        }, [isStreamingThis, hasReceivedResponse, fullResponse, displayedCharCount]);

  const textToRender = useMemo(() =>
    (msg.text || "").toString(),
    [msg.text]
  );

  const isEmojiOnly = useMemo(() => {
    if (!textToRender.trim()) return false;
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji})+(?:\s(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji})+)?$/u;
    return emojiRegex.test(textToRender.trim());
  }, [textToRender]);

  // Memoized message content rendering
  const messageContent = useMemo(() => {
    // AI response rendering with typewriter effect
    if (isStreamingThis) {
      // Show thinking indicator until we have response
      if (!hasReceivedResponse) {
        return (
          <div className={`bg-muted/70 text-foreground px-4 py-3 rounded-2xl rounded-tl-none max-w-2xl min-w-[120px] pb-7 backdrop-blur-sm border border-border/60 shadow-sm`}>
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
          className={`bg-muted/70 text-foreground rounded-2xl rounded-tl-none prose-h2:mt-0! prose-h2:scroll-m-0! px-4 py-3 break-words max-w-2xl min-w-[80px] pb-7 backdrop-blur-sm border border-border/60 shadow-sm`}
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
          {aiDisplayedText || ""}
        </MemoizedMessageContent>
      );
    }

    // Post-stream or regular rendering
    if (!textToRender.trim()) {
      if (isAiSender) {
        return (
          <div className={`bg-muted/70 text-foreground px-4 py-3 rounded-2xl rounded-tl-none max-w-2xl min-w-[120px] pb-7 backdrop-blur-sm border border-border/60 shadow-sm`}>
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
          className={`${isSelf ? "bg-transparent text-foreground" : "bg-transparent text-foreground"} prose-h2:mt-0! prose-h2:scroll-m-0! break-words whitespace-pre-wrap min-w-[120px] text-6xl leading-none pb-10 text-center`}
          copied={copied}
          setCopied={setCopied}
          handleCopy={handleCopy}
        >
          {textToRender}
        </MemoizedMessageContent>
      );
    }

    // Helper function to detect if text contains markdown patterns
    const hasMarkdownContent = (text: string): boolean => {
      const markdownPatterns = [
        /```[\s\S]*?```/,     // Code blocks
        /`[^`]+`/,            // Inline code
        /\*\*[^*]+\*\*/,      // Bold
        /\*[^*]+\*/,          // Italic
        /#{1,6}\s+/,          // Headers
        /^\s*[-*+]\s/m,       // List items
        /^\s*\d+\.\s/m,       // Numbered lists
        /\[([^\]]+)\]\(([^)]+)\)/, // Links
        /!\[([^\]]*)\]\(([^)]+)\)/, // Images
      ];
      return markdownPatterns.some(pattern => pattern.test(text));
    };

    // Use markdown for AI messages, forwarded messages, or user messages with markdown content
    if (isAiSender || msg.isForwarded || hasMarkdownContent(textToRender)) {
      // Reduced noisy debug logging; keep lightweight flag only in dev
      // if (import.meta.env?.MODE === 'development' && textToRender.includes('```')) {
      //   console.debug('AI markdown render', { len: textToRender.length, contact: contact.name });
      // }
      

      
      // Different styling for AI, forwarded, and user markdown messages
      let messageClass;
      if (msg.isForwarded) {
        messageClass = `bg-blue-50/60 dark:bg-blue-950/30 text-foreground rounded-2xl ${isSelf ? "rounded-tr-none" : "rounded-tl-none"} prose-h2:mt-0! prose-h2:scroll-m-0! px-4 py-3 break-words max-w-2xl min-w-[110px] pb-7 backdrop-blur-sm border border-blue-200/40 dark:border-blue-800/40 shadow-sm inter-double-storey`;
      } else if (isAiSender) {
        messageClass = `bg-amber-700/10 text-foreground rounded-2xl rounded-tl-none prose-h2:mt-0! prose-h2:scroll-m-0! px-4 py-3 break-words max-w-2xl min-w-[110px] pb-7 backdrop-blur-sm border border-amber-500/60 shadow-sm inter-double-storey`;
      } else {
        // User message with markdown content
        const baseClass = isSelf
          ? "bg-primary/20 text-foreground border border-primary/40 ring-1 ring-primary/20"
          : "bg-card/70 text-foreground border-2 border-border/60";
        messageClass = `${baseClass} rounded-2xl ${isSelf ? "rounded-tr-none" : "rounded-tl-none"} prose-h2:mt-0! prose-h2:scroll-m-0! px-4 py-3 break-words max-w-2xl min-w-[110px] pb-7 backdrop-blur-sm shadow-sm inter-double-storey`;
      }
      
      return (
        <div className={messageClass}>
          {/* Nested Reply - Exactly Like Screenshot */}
          {msg.replyTo && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="mb-3 pb-3 border-l-4 border-muted-foreground/30 pl-3 ml-1 relative"
            >
              <div 
                className="p-2 -ml-2"

              >
                {/* Original sender name */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-muted-foreground/90">
                    {msg.replyTo.senderName}
                  </span>
                </div>
                
                {/* Original message content */}
                <div className="text-xs text-muted-foreground/70 leading-tight line-clamp-2">
        <MemoizedMessageContent
          markdown={true}
                    className="chatgpt-markdown max-w-none text-muted-foreground/70 [&>*]:text-xs [&>*]:m-0 [&>p]:leading-tight [&>*]:text-inherit"
                    theme={theme.theme}
                    copied={false}
                    setCopied={() => {}}
                    handleCopy={() => {}}
                  >
                    {msg.replyTo.text || "Click to see attachment"}
                  </MemoizedMessageContent>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Main message content */}
          <MemoizedMessageContent
            markdown={true}
            className="chatgpt-markdown max-w-none"
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
        </div>
      );
    } else {
      // Non-AI senders: user or other humans
      const baseClass = isSelf
        ? "bg-primary/20 text-foreground border border-primary/40 ring-1 ring-primary/20"
        : "bg-card/70 text-foreground border-2 border-border/60";
      return (
        <div className={`${baseClass} rounded-2xl ${isSelf ? "rounded-tr-none" : "rounded-tl-none"} px-4 py-3 break-words max-w-2xl min-w-[110px] pb-7 backdrop-blur-sm shadow-sm`}>
          {/* Nested Reply for non-markdown messages */}
          {msg.replyTo && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="mb-3 pb-3 border-l-4 border-muted-foreground/30 pl-3 ml-1 relative"
            >
              <div 
                className="p-2 -ml-2"

              >
                {/* Original sender name */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-muted-foreground/90">
                    {msg.replyTo.senderName}
                  </span>
                </div>
                
                {/* Original message content */}
                <div className="text-xs text-muted-foreground/70 leading-tight line-clamp-2">
                  <MemoizedMentionText
                    text={msg.replyTo.text || "Click to see attachment"}
                    contacts={allKnownContacts}
                    className="text-muted-foreground/70"
                  />
                </div>
              </div>
            </motion.div>
          )}
          
          <MemoizedMentionText
            text={textToRender}
            contacts={allKnownContacts}
            className={"text-foreground inter-double-storey"}
          />
        </div>
      );
    }
  }, [
    isStreamingThis,
    hasReceivedResponse,
    isStreamingActive,
    aiDisplayedText,
    textToRender,
    isEmojiOnly,
    isAiSender,
    isSelf,
    theme.theme,
    copied,
    setCopied,
    handleCopy,
    allKnownContacts,
    msg.id,
    contact.name,
    sender?.name
  ]);

  return (
    <div 
      className={`group flex gap-3 ${isSelf ? "flex-row-reverse" : "flex-row"}`}
      data-message-id={msg.id}
    >
      {/* Avatar */}
      {!isSelf && (
        <div className="flex-shrink-0">
        <MemoizedGeneratedAvatar
          name={sender?.name || "Unknown"}
          allContacts={allKnownContacts}
          currentUser={currentUser}
        />
        </div>
      )}

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

        {/* Forwarded Message Header - Compact Design */}
        {msg.isForwarded && (
          <div className="mb-2 max-w-full">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 mb-1">
              <Share2 className="w-3 h-3" />
              <span className="font-medium">
                Forwarded
                {msg.forwardedFromContactId && (() => {
                  const fromContact = allKnownContacts.find(c => c.id === msg.forwardedFromContactId);
                  return fromContact ? ` from ${fromContact.name}` : '';
                })()}
              </span>
            </div>
          </div>
        )}



        {/* Message Bubble */}
        <div className="relative">
          {messageContent}

          {/* Timestamp and read receipt inside bubble */}
          <div
            className={`absolute bottom-2 ${isSelf ? "right-4" : "left-4"} flex items-center gap-2 text-[11px] text-muted-foreground/70`}
          >
            <span
              title={DateUtils.formatFullDateTime(msg.timestamp)}
            >
              {DateUtils.formatMessageTime(msg.timestamp, true)}
            </span>
            {renderStatusIcon()}
          </div>

          {/* Message actions - vertically centered beside the bubble */}
         
        </div> 
        

        {/* Reactions: show only when present, positioned below bubble */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className={`mt-1 flex ${isSelf ? "justify-end" : "justify-start"}`}>
            <div className="flex flex-wrap items-center gap-1 ml-2">
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
          </div>
        )}
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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  // Deprecated local per-message popover state
  // const [openEmojiForMessageId, setOpenEmojiForMessageId] = useState<string | null>(null);
  const [isComposerEmojiOpen, setComposerEmojiOpen] = useState<boolean>(false);
  // Clear mentions by remounting the mention input
  const [mentionResetKey, setMentionResetKey] = useState(0);
  const [openEmojiForMessageId, setOpenEmojiForMessageId] = useState<string | null>(null);
  
  // Reset input and mention state when contact changes
  useEffect(() => {
    // When switching contacts, reset state but preserve text if returning quickly
    setAttachment(null);
    setReplyingTo(null);
    setComposerEmojiOpen(false);
    // Only clear text when the contact actually changes to a different id
    setMentionResetKey(prev => prev + 1);
  }, [contact?.id]);
  

  
  // Generate a unique key for the mention input to force remount when contact changes
  const mentionKey = `${contact?.id}-${mentionResetKey}`;
  
  const [mobileMessageActions, setMobileMessageActions] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'system'>(
    () => (cookies.get('vite-ui-theme') as 'light' | 'dark' | 'system') || 'system'
  );
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);

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

  // Track whether an AI response is pending streaming to avoid empty bubbles and false typing
  const isStreamingActive = !!aiStream && !!aiStream.messageId;
  const aiThinking = isStreamingActive;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Using PromptInputTextarea internal ref; no local textarea ref needed
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
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

  // Debug logging for contact and message analysis
  useEffect(() => {
    if (contact && messages.length > 0) {
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

  // Debug logging for allKnownContacts
  useEffect(() => {
    if (contact && contact.isAi) {
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
    // Scroll to bottom before paint to avoid visible jump
    if (firstUnreadMessageId && separatorRef.current) {
      separatorRef.current?.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const url = await fileToBase64(file);
      setAttachment({ type: "image", file, url });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Emit typing events when input changes via PromptInput (optimized for performance)
  useEffect(() => {
    if (!contact || contact.isAi || !currentUser) return;
    
    const hasText = !!inputText && inputText.trim().length > 0;
    const topic = contact.isGroup
      ? `chat/${contact.id}`
      : contact.topicId || `chat/${[currentUser.id, contact.id].sort().join("-")}`;

    // Clear any existing debounce timer
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }

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

      // Debounce the stop typing event to reduce MQTT messages
      typingDebounceRef.current = setTimeout(() => {
      if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
      }
        typingTimeoutRef.current = setTimeout(() => {
        const stopPayload: TypingIndicatorPayload = {
          type: "typing",
          contactId: contact.id,
          userId: currentUser.id,
          userName: currentUser.name,
          state: "stop",
        };
        mqttService.publish(topic, stopPayload);
        typingTimeoutRef.current = null;
        }, 2000); // Increased from 1000ms to 2000ms for better performance
      }, 300); // Debounce typing events by 300ms
    } else {
      // If text cleared, ensure a single 'stop' after a short delay
      typingDebounceRef.current = setTimeout(() => {
      if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
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
      }, 500); // Reduced delay for clearing text
    }

    // Cleanup function
    return () => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
    };
  }, [inputText, contact?.id, currentUser?.id, mqttService]);

  // Legacy manual mention selection removed (DiceUI Mention inserts on Enter)

  // Removed mention highlighting backdrop in favor of PromptInput simplicity

  // legacy helpers removed

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

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
    // Prevent sending if only '@' or empty
    if (((trimmed && trimmed !== "@") || attachment) && !isLoading) {
      // De-dup guard
      const sig = `${trimmed}|${attachment?.url || attachment?.file?.name || ""
        }`;
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

      onSendMessage(trimmed, attachment || undefined, replyInfo);
      setInputText("");
      setAttachment(null);
      setReplyingTo(null);
      // Force DiceUI Mention to reset any previous tags
      setMentionResetKey((k) => k + 1);
    }
  };

  // Removed local keydown handling to allow DiceUI Mention to manage Enter/Arrows

  // Transform typing indicators to typing users with avatars (must be before early return)
  const typingUsers = useMemo(() => {
    if (!contact || contact.isAi || !typingIndicators || Object.keys(typingIndicators).length === 0) {
      return [];
    }

    return Object.entries(typingIndicators).map(([userId, userName]) => {
      const user = contacts.find(c => c.id === userId);
      return {
        id: userId,
        name: userName,
        avatarUrl: user?.avatarUrl
      };
    });
  }, [typingIndicators, contact, contacts]);

  if (!contact) {
    return (
      <div className="relative flex-1 flex items-center justify-center h-full p-6 md:p-10 overflow-hidden bg-[radial-gradient(ellipse_at_bottom,color-mix(in_oklch,var(--primary)_25%,transparent),transparent_65%),radial-gradient(ellipse_at_bottom_right,transparent_65%)]">
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
        
        <p className="text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
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
          <DialogContent className="max-w-2xl rounded-3xl">
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
    <div className="flex h-full flex-col bg-background overflow-hidden">
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
        <ChatContainerRoot className="flex-1 overflow-y-auto space-y-0 px-4 pb-4 min-h-0" onScroll={(e) => {
          const el = e.currentTarget as HTMLElement;
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
        }}>
<ChatContainerContent className="space-y-4 px-6 py-32 bg-transparent">
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
                  <div className="px-3 py-2 bg-muted rounded-2xl rounded-tl-none">
                    <Loader variant="text-shimmer" text="AI is thinking" />
                  </div>
                </div>
              </motion.div>
            )}
            {isUserTyping && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                key="typing-indicator"
                className="flex justify-start"
              >
                <div className="flex items-end gap-2.5">
                  <div className="flex p-3">
                    <TypingIndicatorWithAvatars 
                      typingUsers={typingUsers}
                      showAvatars={true}
                      maxAvatars={3}
                      className="items-center"
                    />
                  </div>
                </div>
              </motion.div>
            )}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>
          <div className="absolute right-7 bottom-20 -translate-y-1/2 z-10">
            <ScrollButton variant="default" className="shadow-sm" />
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
      <div className="px-4 pb-4 pt-2 z-10">
        {attachment && (
          <div className="relative w-24 h-24 mb-2 p-1 border border-slate-300 dark:border-slate-700 rounded-lg">
            <img
              src={attachment.url}
              alt="Attachment preview"
              className="w-full h-full object-cover rounded"
            />
            <button
              onClick={() => setAttachment(null)}
              className="absolute -top-2 -right-2 bg-slate-700 text-white rounded-full p-0.5 hover:bg-slate-600"
              aria-label="Remove attachment"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        {replyingTo && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mb-2 mx-1"
          >
            <div className="relative bg-muted/10 dark:bg-muted/8 border border-border/50 rounded-xl px-4 py-3 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200">
              {/* Header with "Replying to" and close button */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-primary/10">
                    <Reply className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-primary">
                  Replying to {replyingTo.senderName}
                </span>
              </div>
                <Button
                  variant="ghost"
                  size="icon"
              onClick={() => setReplyingTo(null)}
                  className="h-6 w-6 text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 rounded-full transition-colors"
              aria-label="Cancel reply"
            >
                  <CloseIcon className="w-3 h-3" />
                </Button>
          </div>
              
              {/* Reply content with exact Discord styling */}
              <div className="flex items-start gap-2">
                {/* Left gray bar - same as inline replies */}
                <div className="w-1 h-12 bg-muted-foreground/40 rounded-sm mt-0.5 flex-shrink-0"></div>
                
                {/* Message content - clickable to scroll to original message */}
                <div 
                  className="flex-1 min-w-0 p-1 -m-1"

                >
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-xs font-medium text-muted-foreground/90">
                      {replyingTo.senderName}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground/80 leading-relaxed max-h-20 overflow-y-auto scrollbar-hide">
                    <MemoizedMessageContent
                      markdown={true}
                      className="chatgpt-markdown max-w-none text-muted-foreground/80"
                      theme={theme.theme}
                      copied={false}
                      setCopied={() => {}}
                      handleCopy={() => {}}
                    >
                      {replyingTo.text || "Click to see attachment"}
                    </MemoizedMessageContent>
                  </div>
                </div>
              </div>
              
              {/* Subtle gradient overlay for premium feel */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/1 to-transparent rounded-xl pointer-events-none" />
            </div>
          </motion.div>
        )}
        <form onSubmit={handleSubmit} className="flex w-full items-start gap-3">
  <input
    type="file"
    ref={fileInputRef}
    onChange={handleFileChange}
    accept="image/*"
    className="hidden"
  />

  <PromptInput
    value={inputText}
    onValueChange={setInputText}
    isLoading={isLoading}
    onSubmit={() => handleSubmit()}
    className="flex items-center border-input bg-card relative z-10 w-full border rounded-2xl pt-1 shadow-xs"
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
        <PromptInputAction tooltip="Attach files">
          <Button variant="outline" size="icon" className="size-9 rounded-full" asChild>
            <label htmlFor="file-upload" className="cursor-pointer">
              <>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <Paperclip className="size-4" />
              </>
            </label>
          </Button>
        </PromptInputAction>
        <PromptInputAction tooltip="Emoji">
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full"
            type="button"
            data-emoji-trigger
            onMouseDown={(e) => {
              e.preventDefault();
              setComposerEmojiOpen(true);
            }}
            onClick={() => setComposerEmojiOpen(true)}
          >
            <Smile className="size-4" />
          </Button>
        </PromptInputAction>
      </PromptInputActions>

      {/* Textarea / Mention input */}
      <div className="flex-1 min-w-0">
          <Mention 
            key={mentionKey}
            className="w-full [--dice-transform-origin:10px] **:data-tag:rounded-full **:data-tag:text-[12px] **:data-tag:bg-primary **:data-tag:text-primary-foreground dark:**:data-tag:bg-primary dark:**:data-tag:text-primary-foreground"
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
            {contact?.isGroup ? (
              // Group chat: show group members
              (contact.memberIds || [])
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
                })
            ) : (
              // Direct chat: show the other person and all contacts
              allKnownContacts
                .filter((c) => c.id !== currentUser.id && !c.isAi)
                .map((member) => (
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
                ))
            )}
          </MentionContent>
        </Mention>
      </div>

      {/* Send button */}
      <Button
        size="icon"
        disabled={!inputText.trim() && !attachment}
        onClick={handleSubmit}
        className="size-9 rounded-full"
        type="button"
      >
        <Send className="size-4" />
      </Button>
    </div>
  </PromptInput>
</form>


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
      </div>
    </div>
  );
})

ChatView.displayName = 'ChatView';

export default ChatView;
