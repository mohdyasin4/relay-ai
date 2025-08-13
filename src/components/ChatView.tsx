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
import { useLongPress } from "use-long-press";

import { DatabaseService } from "../services/databaseService";
import { mqttService } from "../services/mqttService";
import { fileToBase64 } from "../utils/imageUtils";
import { getTimelineDate, formatPresence, DateUtils } from "../utils/dateUtils";

import GeneratedAvatar from "./GeneratedAvatar";
import DateSeparator from "./DateSeparator";
import NewMessagesSeparator from "./NewMessagesSeparator";
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
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { Loader } from "@/components/ui/loader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { motion } from "motion/react";
import {
  Message as PKMessage,
  MessageAvatar,
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
} from "lucide-react";
import { Paperclip } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import EmojiPickerReact, { EmojiStyle, SuggestionMode } from "emoji-picker-react";
import { useTheme } from "./theme-provider";
import { ScrollButton } from "./ui/scroll-button";
import { Mention, MentionContent, MentionInput, MentionItem } from "@/components/ui/mention";
import { Theme as EmojiTheme } from "emoji-picker-react";
import { useTextStream } from "@/components/ui/response-stream";
//

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
  aiStream?: { messageId: string; stream?: AsyncIterable<string>; text?: string } | null;
  onBack?: () => void;
}

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
  onImageClick,
  onEditGroup,
  onReact,
  onForward,
  onNewGroup,
  onInviteUser,
  onAddAiContact,
  aiPersonas,
  firstUnreadMessageId,
  aiStream,
  onBack,
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
  const [mobileMessageActions, setMobileMessageActions] = useState<{ messageId: string; x: number; y: number } | null>(null);

  // Viewport dimensions for mobile popover positioning
  const [viewportDimensions, setViewportDimensions] = useState<{ width: number; height: number }>(() => ({
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

  useEffect(() => {
    if (aiStream && (aiStream.stream || aiStream.text)) {
      resetAiStreaming();
      startAiStreaming();
    }
  }, [aiStream?.messageId, aiStream?.stream, aiStream?.text, resetAiStreaming, startAiStreaming]);
  // Removed legacy suggestion state (DiceUI Mention handles suggestions)
  const [copied, setCopied] = useState(false);
  
  // Mention coloring is now handled inside MessageContent
  // For showing colored sender names in group chats, reuse the same palette logic locally
  const hashColorIndex = useCallback((key: string, modulo = 8) => {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) hash = (hash * 33) ^ key.charCodeAt(i);
    return Math.abs(hash) % modulo;
  }, []);
  const mentionPalette = [
    { text: "text-blue-600 dark:text-blue-400" },
    { text: "text-green-600 dark:text-green-400" },
    { text: "text-amber-600 dark:text-amber-400" },
    { text: "text-purple-600 dark:text-purple-400" },
    { text: "text-rose-600 dark:text-rose-400" },
    { text: "text-cyan-600 dark:text-cyan-400" },
    { text: "text-teal-600 dark:text-teal-400" },
    { text: "text-indigo-600 dark:text-indigo-400" },
  ] as const;
  const getMentionClassesForKey = useCallback((key: string) => {
    const idx = hashColorIndex(key || "");
    const pal = mentionPalette[idx];
    // Sender name chips should only use text color, no background
    return `${pal.text}`;
  }, [hashColorIndex]);

  // Replace @Name occurrences with markdown links that encode the user id or name
  let renderMessageWithMentions = (text: string): string => text;
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const handleCopy = (code: string) => {
  navigator.clipboard.writeText(code);
  setCopied(true);
  console.log("Code copied to clipboard:", code);

  // The console.log below will still show old state
  // because setCopied(true) is async.
  };


useEffect(() => {
  if (copied) {
    console.log("Copied status changed to:", copied);
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }
}, [copied]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Using PromptInputTextarea internal ref; no local textarea ref needed
  const typingTimeoutRef = useRef<number | null>(null);
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

  const allKnownContacts = useMemo(
    () => [...contacts, ...aiPersonas],
    [contacts, aiPersonas]
  );

  // Now that allKnownContacts is defined, bind the renderer
  renderMessageWithMentions = useCallback(
    (text: string): string => {
      if (!text) return text;
      let result = text;
      // Sort names by length desc to avoid partial overlaps
      const contactsByName = [...allKnownContacts].sort(
        (a, b) => (b.name?.length || 0) - (a.name?.length || 0)
      );
      for (const contact of contactsByName) {
        if (!contact.name) continue;
        const pattern = new RegExp(`(^|\\s)@${escapeRegExp(contact.name)}(?!\\S)`, "g");
        result = result.replace(pattern, (_m, prefix) => {
          const idToken = encodeURIComponent(contact.id || contact.name);
          return `${prefix}[@${contact.name}](mention:${idToken})`;
        });
      }
      return result;
    },
    [allKnownContacts]
  );

  const messagesWithDates = useMemo(() => {
    const grouped: (
      | Message
      | { type: "date_marker"; id: string; date: string }
    )[] = [];
    let lastDate: string | null = null;

    messages.forEach((message) => {
      const messageDate = DateUtils.getMoment(message.timestamp).toDate();
      const timelineDate = getTimelineDate(messageDate);

      if (timelineDate !== lastDate) {
        grouped.push({
          type: "date_marker",
          id: `date-${timelineDate}-${message.id}`,
          date: timelineDate,
        });
        lastDate = timelineDate;
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

  useEffect(() => {
    setInputText("");
    setAttachment(null);
    setReplyingTo(null);
    // Fetch last 50 messages on chat open
    async function fetchInitialMessages() {
      if (contact && contact.id) {
        try {
          const msgs = await import("../services/messageService").then(mod => mod.MessageService.getMessages(contact.id, contact.isGroup, 50));
          if (Array.isArray(msgs)) {
            // If you have a setMessages or similar, update here
            // setMessages(msgs);
            // If messages is a prop, you may need to lift state up
          }
        } catch (err) {
          // Optionally handle error
        }
      }
    }
    fetchInitialMessages();
  }, [contact]);

  useEffect(() => {
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

  // Emit typing events when input changes via PromptInput
  useEffect(() => {
    if (!contact || contact.isAi || !currentUser) return;
    const text = inputText;
    const topic = contact.isGroup 
        ? `chat/${contact.id}` 
      : contact.topicId ||
        `chat/${[currentUser.id, contact.id].sort().join("-")}`;
    if (text && text.trim().length > 0) {
      // start typing
      const payload: TypingIndicatorPayload = {
        type: "typing",
        contactId: contact.id,
        userId: currentUser.id,
        userName: currentUser.name,
        state: "start",
      };
        mqttService.publish(topic, payload);
      // debounce stop
      if (typingTimeoutRef.current)
        window.clearTimeout(typingTimeoutRef.current);
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
      }, 1500);
    } else {
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
  }, [inputText, contact?.id]);
  
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
      const sig = `${trimmed}|${
        attachment?.url || attachment?.file?.name || ""
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

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 h-screen p-6 md:p-10 overflow-auto">
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="text-center max-w-3xl w-full"
  >
    {/* Icon Header */}
    <div className="inline-flex p-5 bg-primary/10 rounded-3xl mb-6 shadow-sm">
      <MessagesSquare className="w-14 h-14 text-white" />
    </div>

    {/* Welcome Title */}
    <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
      Welcome to Relay, {currentUser.name}!
    </h1>
    <p className="text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
      Select a conversation from the sidebar, start a new one, or explore chatting with an AI assistant.
    </p>

    {/* Quick Actions */}
    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
      <Button onClick={onInviteUser} size="lg" className="flex-1 min-w-[160px]">
        Invite a Friend
      </Button>
      <Button
        onClick={onNewGroup}
        variant="secondary"
        size="lg"
        className="flex-1 min-w-[160px]"
      >
        Create a Group
      </Button>
    </div>

    {/* AI Personas */}
    <div className="text-left">
      <h2 className="text-xl font-bold text-foreground mb-5">
        Or, chat with an AI assistant
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {aiPersonas.map((persona) => {
          const isAdded = contacts.some((c) => c.id === persona.id);
          return (
            <motion.div
              key={persona.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              whileHover={{ y: -3, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              className="bg-muted p-4 rounded-lg flex items-center gap-4 border border-border/50 transition-all"
            >
              <GeneratedAvatar
                name={persona.name}
                allContacts={[...aiPersonas, ...contacts]}
                currentUser={currentUser}
              />
              <div className="flex-1 text-left overflow-hidden">
                <h3 className="font-semibold text-foreground">
                  {persona.name}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {persona.systemInstruction?.split(".")[0]}.
                </p>
              </div>
              <Button
                onClick={() => onAddAiContact(persona)}
                disabled={isAdded}
                variant={isAdded ? "secondary" : "default"}
                size="icon"
                aria-label={
                  isAdded
                    ? `${persona.name} is already added`
                    : `Add ${persona.name}`
                }
              >
                {isAdded ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <PlusIcon className="w-5 h-5" />
                )}
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  </motion.div>
</div>

    );
  }

  const isAiTyping =
    contact?.isAi &&
    isLoading &&
    messages[messages.length - 1]?.senderId === contact.id;
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
        <GeneratedAvatar 
            name={liveContact?.name || contact.name} 
            isGroup={liveContact?.isGroup ?? contact.isGroup} 
            memberIds={liveContact?.memberIds ?? contact.memberIds} 
            creatorId={liveContact?.creatorId ?? contact.creatorId}
            allContacts={allKnownContacts}
            currentUser={currentUser}
        />
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
      <div className="flex h-screen flex-col overflow-hidden">
        <ChatContainerRoot className="flex-1 space-y-0">
           <ChatContainerContent className="space-y-4 px-6 py-32">
          {messagesWithDates.map((item) => {
              if ("type" in item && item.type === "date_marker") {
                return (
                  <div className="sticky bg-background top-0 z-0 flex justify-center">
                    <DateSeparator key={item.id} date={item.date} />
                  </div>
                );
            }
            const msg = item as Message;
            const showSeparator = msg.id === firstUnreadMessageId;

              const isSelf = msg.senderId === currentUser.id;
              const sender =
                allKnownContacts.find(
                  (c) =>
                    c.id ===
                    (msg.isGroup ? msg.senderId : msg.senderId || msg.contactId)
                ) || (isSelf ? currentUser : contact);
              const avatarSrc = (sender as any)?.avatarUrl || "";
              const fallback = (sender?.name || "U").slice(0, 1).toUpperCase();

              const renderStatusIcon = () => {
                const base = isSelf
                  ? "text-foreground"
                  : "text-muted-foreground";
                if (!isSelf) return null;
                switch (msg.status) {
                  case "queued":
                    return <Clock className={`w-3.5 h-3.5 ${base}`} />;
                  case "sent":
                    return <Check className={`w-3.5 h-3.5 ${base}`} />;
                  case "delivered":
                    return (
                      <CheckCheck
                        className={`w-3.5 h-3.5 ${
                          isSelf ? "text-white" : base
                        }`}
                      />
                    );
                  case "read":
                    return (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                    );
                  default:
                    return <Check className={`w-3.5 h-3.5 ${base}`} />;
                }
              };

            return (
                <React.Fragment key={msg.id}>
                  {showSeparator && (
                    <div ref={separatorRef} className="sticky top-12 z-20 flex justify-center">
                      <NewMessagesSeparator />
                    </div>
                  )}
                  <div
                    className={` ${
                      isSelf ? "justify-end" : "justify-start"
                    } mx-auto w-full `}
                  >
                    <PKMessage
                      className={`relative items-start ${
                        isSelf ? "flex-row-reverse" : ""
                      } group`}
                    >
                      {contact.isGroup && (
                        <MessageAvatar
                          src={avatarSrc}
                          alt={sender?.name || ""}
                          fallback={fallback}
                          className="mt-1"
                        />
                      )}
                      <div className="max-w-[85%] sm:max-w-[75%]">
                        {msg.attachment?.url && (
                          <img
                            src={msg.attachment.url}
                            alt="attachment"
                            className="border-2 border-accent max-h-64 rounded-2xl cursor-pointer max-w-full"
                            onClick={() => onImageClick(msg.attachment!.url)}
                          />
                        )}
                          <div
                            className="relative"
                            onPointerDown={(e) => {
                              // Long press for mobile: only on touch/pointer devices or small screens
                              if (window.innerWidth >= 768) return;
                              const target = e.currentTarget as HTMLElement;
                              const rect = target.getBoundingClientRect();
                              // Start a timer; if held for 500ms, open actions
                              if ((window as any).__lpTimer) {
                                clearTimeout((window as any).__lpTimer);
                              }
                              (window as any).__lpTimer = window.setTimeout(() => {
                                const popoverWidth = 320; // Approximate width of the popover
                                const popoverHeight = 400; // Approximate height of the popover
                                const padding = 16; // Safe padding from edges
                                
                                // Calculate optimal position
                                let x = rect.left + rect.width / 2;
                                let y = rect.top + rect.height / 2;
                                
                                // Adjust X position to prevent horizontal overflow
                                if (x + popoverWidth / 2 > viewportDimensions.width - padding) {
                                  x = viewportDimensions.width - popoverWidth / 2 - padding;
                                }
                                if (x - popoverWidth / 2 < padding) {
                                  x = popoverWidth / 2 + padding;
                                }
                                
                                // Adjust Y position to prevent vertical overflow
                                if (y + popoverHeight / 2 > viewportDimensions.height - padding) {
                                  y = viewportDimensions.height - popoverHeight / 2 - padding;
                                }
                                if (y - popoverHeight / 2 < padding) {
                                  y = popoverHeight / 2 + padding;
                                }
                                
                                setMobileMessageActions({
                                  messageId: msg.id,
                                  x,
                                  y,
                                });
                              }, 500);
                            }}
                            onPointerUp={() => {
                              if ((window as any).__lpTimer) {
                                clearTimeout((window as any).__lpTimer);
                                (window as any).__lpTimer = null;
                              }
                            }}
                            onPointerLeave={() => {
                              if ((window as any).__lpTimer) {
                                clearTimeout((window as any).__lpTimer);
                                (window as any).__lpTimer = null;
                              }
                            }}
                          >
                           {contact.isGroup && !isSelf && sender?.name && (
                             <div className="mb-0.5 ">
                               <span className={`inline-block text-[11px] font-semibold ${getMentionClassesForKey(sender.id || sender.name)}`}>
                                 {sender.name}
                               </span>
                             </div>
                           )}
                          {(() => {
                            const isStreamingThis =
                              (contact.isAi || (contact.isGroup && aiPersonas.some(ai => ai.id === msg.senderId))) &&
                              aiStream &&
                              aiStream.messageId === msg.id;
                            const displayedText = (isStreamingThis ? aiDisplayedText : (msg.text || ""));
                            // Don't show the message content until streaming starts to prevent flash
                            const shouldShowContent = !isStreamingThis || aiDisplayedText.length > 0;
                            

                            // Use regex to detect emoji-only messages (1-2 emojis). Use broad Unicode property.
                            const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji})+(?:\s(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji})+)?$/u;
                            const isEmojiOnly = displayedText.trim().length > 0 && emojiRegex.test(displayedText.trim());
                            return !shouldShowContent ? null : isEmojiOnly ? (
                              <MessageContent
                                markdown
                                className={`${
                                  isSelf
                                    ? "bg-transparent rounded-2xl rounded-tr-none text-foreground"
                                    : "bg-transparent rounded-2xl rounded-tl-none text-foreground"
                                } break-words whitespace-pre-wrap min-w-[120px] text-6xl leading-none pb-10 text-center`}
                                copied={copied}
                                setCopied={setCopied}
                                handleCopy={handleCopy}
                                resolveMentionContact={(id) => {
                                  const c = allKnownContacts.find((x) => x.id === id || x.name === id)
                                  return c ? { name: c.name, avatarUrl: (c as any).avatarUrl } : undefined
                                }}
                              >
                                {renderMessageWithMentions(displayedText)}
                              </MessageContent>
                            ) : (
                              <MessageContent
                                markdown
                                className={`${
                                  isSelf
                                    ? "bg-primary rounded-2xl rounded-tr-none text-white"
                                    : "bg-muted rounded-2xl rounded-tl-none text-foreground"
                                 } px-3 py-2.5 break-words max-w-lg min-w-[80px] pb-7 ${isStreamingThis ? "prose-h2:mt-0! prose-h2:scroll-m-0!" : ""}`}
                                theme={theme.theme}
                                copied={copied}
                                setCopied={setCopied}
                                handleCopy={handleCopy}
                                resolveMentionContact={(id) => {
                                  const c = allKnownContacts.find((x) => x.id === id || x.name === id)
                                  return c ? { name: c.name, avatarUrl: (c as any).avatarUrl } : undefined
                                }}
                              >
                                {renderMessageWithMentions(displayedText)}
                              </MessageContent>
                             )
                           })()}
                          {/* Timestamp and read receipt inside bubble */}
                          <div
                            className={`absolute bottom-1 ${isSelf ? "right-4" : "left-3"} flex items-center gap-2 text-[11px] text-muted-foreground opacity-80`}
                          >
                            <span
                              title={DateUtils.formatFullDateTime(msg.timestamp)}
                            >
                              {DateUtils.formatMessageTime(msg.timestamp, true)}
                            </span>
                            {renderStatusIcon()}
                          </div>
                          {/* Message actions beside bubble - hidden on mobile, shown on hover */}
                          <MessageActions
                            className={`absolute top-1/2 -translate-y-1/2 ${
                              isSelf ? "-left-32" : "-right-32"
                            } hidden md:flex items-center gap-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto`}
                          >
                            <MessageAction tooltip="Add Reaction" side="top">
                              <Popover
                                open={openEmojiForMessageId === msg.id}
                                onOpenChange={(open) =>
                                  setOpenEmojiForMessageId(open ? msg.id : null)
                                }
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Reaction"
                                    className="rounded-full hover:text-foreground"
                                    onClick={() =>
                                      setOpenEmojiForMessageId(
                                        openEmojiForMessageId === msg.id ? null : msg.id
                                      )
                                    }
                                  >
                                    <Smile className="w-4 h-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="p-1 w-auto min-w-[220px]"
                                  side={isSelf ? "left" : "right"}
                                  align="center"
                                  sideOffset={6}
                                >
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
                                    lazyLoadEmojis
                                    autoFocusSearch={false}
                                    suggestedEmojisMode={SuggestionMode.FREQUENT}
                                    emojiStyle={EmojiStyle.APPLE}
                                    theme={
                                      document.documentElement.classList.contains("dark")
                                        ? ("dark" as EmojiTheme)
                                        : ("light" as EmojiTheme)
                                    }
                                  />
                                </PopoverContent>
                              </Popover>
                            </MessageAction>

                            <MessageAction tooltip="Reply" side="top">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Reply"
                                onClick={() => setReplyingTo(msg)}
                                className="rounded-full hover:text-foreground"
                              >
                                <Reply className="w-4 h-4" />
                              </Button>
                            </MessageAction>

                            <MessageAction tooltip="Forward" side="top">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Forward"
                                onClick={() => onForward(msg)}
                                className="rounded-full hover:text-foreground"
                              >
                                <Forward className="w-4 h-4" />
                              </Button>
                            </MessageAction>
                          </MessageActions>
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
                              ).map(([emoji, userIds]) => (
                                <Button
                                  variant="ghost"
                                  key={`${msg.id}-${emoji}`}
                                  onClick={() => onReact(msg.id, emoji)}
                                  className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/80 hover:bg-muted/80 cursor-pointer"
                                  title={userIds
                                    .map((id) => allKnownContacts.find((c) => c.id === id)?.name || "You")
                                    .join(", ")}
                                  style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif' }}
                                >
                                  {emoji} {userIds.length}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    </PKMessage>
                  </div>
                </React.Fragment>
            );
          })}
           {isAiTyping && (
             <div className="flex justify-start">
               <div className="flex items-center gap-2.5 py-1">
                  <GeneratedAvatar
                    name={contact.name}
                    isGroup={contact.isGroup}
                    memberIds={contact.memberIds}
                    allContacts={allKnownContacts}
                    currentUser={currentUser}
                  />
                   <div className="rounded-bl-lg px-2 py-1 flex items-center gap-2 relative z-10">
                     <Loader variant="typing" />
                   </div>
               </div>
            </div>
          )}
          {isUserTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                key="typing-indicator"
                className="flex justify-start"
              >
                <div className="flex items-end gap-2.5">
                  <div className="flex p-2 bg-muted rounded-2xl rounded-bl-lg">
                    <Loader variant="typing" />
                </div>
                
                    <div className="text-xs text-muted-foreground pb-1">{typingUserNames[0]} is typing</div>
               </div>
            </motion.div>
          )}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
        <div className="absolute right-7 bottom-16 -translate-y-1/2 z-10">
            <ScrollButton variant="default" className="shadow-sm" />
        </div>
      </ChatContainerRoot>
      </div>
      {/* Hidden cache warmer to avoid repeated network fetches on first open */}
      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0">
        <EmojiPickerReact
          lazyLoadEmojis
          autoFocusSearch={false}
          suggestedEmojisMode={SuggestionMode.FREQUENT}
          emojiStyle={EmojiStyle.APPLE}
          theme={
            document.documentElement.classList.contains("dark")
              ? ("dark" as EmojiTheme)
              : ("light" as EmojiTheme)
          }
        />
      </div>
      <div className="absolute z-10 bottom-0 w-full ">
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
          <div className="mb-2 flex items-start gap-2 bg-slate-200 dark:bg-slate-800 p-2 rounded-lg relative">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <ReplyIcon className="w-4 h-4 mr-1 text-indigo-500" />
                <span className="font-medium text-sm text-indigo-600 dark:text-indigo-400">
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
        <form onSubmit={handleSubmit} className="flex w-full items-start gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          {contact?.isGroup ? (
            <Mention key={mentionResetKey} className="w-full" inputValue={inputText} onInputValueChange={setInputText}>
              <PromptInput
                value={inputText}
                onValueChange={setInputText}
                isLoading={isLoading}
                onSubmit={() => handleSubmit()}
                className="flex items-center border-input bg-popover relative z-10 w-full border-t pt-1 shadow-xs"
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
                        lazyLoadEmojis
                        autoFocusSearch={false}
                        suggestedEmojisMode={SuggestionMode.FREQUENT}
                        emojiStyle={EmojiStyle.APPLE}
                        theme={
                          document.documentElement.classList.contains("dark")
                            ? ("dark" as EmojiTheme)
                            : ("light" as EmojiTheme)
                        }
                      />
                    </div>
                  )}
                </div>
                
                {/* Actions, textarea, and send button in one line */}
                <div className="flex items-center gap-2 px-3  w-full">
                  {/* Actions before textarea */}
                  <div className="flex items-center gap-2">
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
                  </div>
                  {/* MentionInput should take full width */}
                  <div className="flex-1 min-w-0">
                    <MentionInput
                      className="w-full border-none transition-all duration-200 ease-in-out focus-visible:ring-0 focus-visible:ring-offset-0"
                      asChild
                    >
                      <PromptInputTextarea
                        placeholder="Type a message..."
                        className="w-full text-base leading-[1.3] sm:text-base md:text-base px-3 py-2"
                      />
                    </MentionInput>
                  </div>
                  {/* Send button on the right */}
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
                <MentionContent
                  className="absolute left-0 w-[calc(100%-0px)] max-w-[520px] z-50 rounded-md border bg-popover p-1 shadow-md"
                  style={{ minWidth: '220px' }}
                >
                  {contact?.isGroup ? (contact.memberIds || []).map((id) => {
                    const member = allKnownContacts.find((c) => c.id === id);
                    if (!member) return null;
                    return (
                      <MentionItem
                        key={member.id}
                        value={member.name}
                        className="px-2 py-1 rounded hover:bg-accent cursor-pointer flex items-center gap-2"
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
                  }) : null}
                </MentionContent>
            </PromptInput>
            </Mention>
          ) : (
            
            <PromptInput
              value={inputText}
              onValueChange={setInputText}
              isLoading={isLoading}
              onSubmit={() => handleSubmit()}
                className="flex items-center border-input bg-popover relative z-10 w-full border-t pt-1 shadow-xs"
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
                      lazyLoadEmojis
                      autoFocusSearch={false}
                      suggestedEmojisMode={SuggestionMode.FREQUENT}
                      emojiStyle={EmojiStyle.APPLE}
                      theme={
                        document.documentElement.classList.contains("dark")
                          ? ("dark" as EmojiTheme)
                          : ("light" as EmojiTheme)
                      }
                    />
                  </div>
                )}
              </div>
              
              {/* Actions, textarea, and send button in one line */}
              <div className="flex items-center gap-2 px-3 py-2 w-full">
                {/* Actions before textarea */}
                <div className="flex items-center gap-2 shrink-0">
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
                </div>
                
                {/* Textarea in the middle - takes full width */}
                <div className="flex-1 min-w-0">
                  <PromptInputTextarea
                    placeholder="Type a message..."
                    className="w-full text-base leading-[1.3] sm:text-base md:text-base resize-none"
                  />
                </div>
                
                {/* Send button on the right */}
                <div className="shrink-0">
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
              </div>
            </PromptInput>
          )}
        {/* Removed duplicate closing form tag */}
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
                    lazyLoadEmojis
                    autoFocusSearch={false}
                    suggestedEmojisMode={SuggestionMode.FREQUENT}
                    emojiStyle={EmojiStyle.APPLE}
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
