// Polling interval for presence updates (in ms)
const PRESENCE_POLL_INTERVAL = 10000;

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";

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
import ChatBubbleLeftRightIcon from "./icons/ChatBubbleLeftRightIcon";

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
} from "lucide-react";
import { Paperclip } from "lucide-react";
import EmojiPicker from "./EmojiPicker";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import EmojiPickerReact from "emoji-picker-react";
import { useTheme } from "./theme-provider";
import { ScrollButton } from "./ui/scroll-button";
import { Mention, MentionContent, MentionInput, MentionItem } from "@/components/ui/mention";
import { Theme as EmojiTheme } from "emoji-picker-react";
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
}

// Legacy SuggestionState retained only for reference; DiceUI Mention manages state internally

// legacy typing indicator removed in favor of Loader typing

const ChatView: React.FC<ChatViewProps> = ({
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
}) => {
  const [liveContact, setLiveContact] = useState<Contact | undefined>(contact);
  const [inputText, setInputText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [openEmojiForMessageId, setOpenEmojiForMessageId] = useState<
    string | null
  >(null);
  const [isComposerEmojiOpen, setComposerEmojiOpen] = useState<boolean>(false);
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
    setTimeout(() => setCopied(false), 2000);
  };
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
      <MessagesSquare className="w-14 h-14 text-primary" />
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
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="p-3 md:p-4 border-b flex items-center gap-3 bg-background/80 backdrop-blur-sm z-10">
        <div className="md:">
          <SidebarTrigger />
        </div>
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
          <ChatContainerContent className="space-y-4 px-6 py-28">
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
                      <CheckCheck className="w-3.5 h-3.5 text-green-500" />
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
                         <div className="relative">
                           {contact.isGroup && !isSelf && sender?.name && (
                             <div className="mb-0.5 ">
                               <span className={`inline-block text-[11px] font-semibold ${getMentionClassesForKey(sender.id || sender.name)}`}>
                                 {sender.name}
                               </span>
                             </div>
                           )}
                         {msg.text && (
                            (() => {
                              // Use regex to detect emoji-only messages (1-2 emojis)
                              const emojiRegex = /^([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}]+\s?){1,2}$/u;
                              return emojiRegex.test(msg.text.trim());
                            })() ? (
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
                                {renderMessageWithMentions(msg.text as string)}
                              </MessageContent>
                             ) : (
                              <MessageContent
                                markdown
                                className={`${
                                  isSelf
                                    ? "bg-primary rounded-2xl rounded-tr-none  text-white"
                                    : "bg-muted rounded-2xl rounded-tl-none text-foreground"
                                } px-3 py-2.5 break-words whitespace-pre-wrap max-w-2xl min-w-[80px] pb-7`}
                                theme={theme.theme}
                                copied={copied}
                                setCopied={setCopied}
                                handleCopy={handleCopy}
                                resolveMentionContact={(id) => {
                                  const c = allKnownContacts.find((x) => x.id === id || x.name === id)
                                  return c ? { name: c.name, avatarUrl: (c as any).avatarUrl } : undefined
                                }}
                              >
                                {isAiTyping && isSelf === false ? "" : renderMessageWithMentions(msg.text as string)}
                              </MessageContent>
                            )
                          )}
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
                        </div>
                       {/* Reactions + MessageActions on the same row */}
<div className="relative flex flex-row items-center justify-between w-full mt-0.5 gap-2">
  {/* Reactions bubble (always reserves space) */}
  <div className="flex flex-wrap items-center gap-1 ml-2 min-h-[24px]">
    {msg.reactions && msg.reactions.length > 0 &&
      Object.entries(
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
            .map(
              (id) => allKnownContacts.find((c) => c.id === id)?.name || "You"
            )
            .join(", ")}
        >
          {emoji} {userIds.length}
        </Button>
      ))}
  </div>

  {/* Message actions */}
  <MessageActions className="flex items-center gap-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
    <MessageAction tooltip="Add Reaction" side="top">
      <Popover
        open={openEmojiForMessageId === msg.id}
        onOpenChange={(open) =>
          setOpenEmojiForMessageId(open ? msg.id : null)
        }
      >
        <PopoverTrigger asChild>
          <div
            onMouseEnter={() => setOpenEmojiForMessageId(msg.id)}
            style={{ display: "inline-block" }}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reaction"
              className="rounded-full hover:text-foreground"
            >
              <Smile className="w-4 h-4" />
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-1 w-auto min-w-[180px] flex items-center gap-1"
          side="top"
          align={isSelf ? "end" : "start"}
          onMouseEnter={() => setOpenEmojiForMessageId(msg.id)}
          onMouseLeave={() => setOpenEmojiForMessageId(null)}
        >
          <EmojiPickerReact
            reactionsDefaultOpen={true}
            onReactionClick={(emojiData: any) => {
              onReact(msg.id, emojiData.emoji);
              setOpenEmojiForMessageId(null);
            }}
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
                   <div className="bg-muted rounded-2xl rounded-bl-lg px-2 py-1 flex items-center gap-2 relative z-10">
                     <Loader variant="text-blink" text="Thinking" size="sm" />
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
        <div className="absolute right-7 bottom-1/7 -translate-y-1/2 z-10">
            <ScrollButton variant="default" className="shadow-sm" />
        </div>
      </ChatContainerRoot>
      </div>
      <div className="absolute z-10 bottom-2 w-full px-4 ">
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
          <Mention className="w-full" inputValue={inputText} onInputValueChange={setInputText}>
            <PromptInput
              value={inputText}
              onValueChange={setInputText}
              isLoading={isLoading}
              onSubmit={() => handleSubmit()}
              className="border-input bg-popover relative z-10 w-full rounded-3xl border pt-1 shadow-xs"
            >
              {/* Emoji picker overlay */}
              <div className="relative">
                {isComposerEmojiOpen && (
                  <div className="absolute bottom-[100%] left-0 mb-2 z-50">
                    <EmojiPicker
                      onEmojiSelect={(emoji) => {
                        setComposerEmojiOpen(false);
                        setInputText((prev) => prev + emoji);
                      }}
                      onClose={() => setComposerEmojiOpen(false)}
                    />
                  </div>
                )}
              </div>
              <MentionInput className="border-none transition-all duration-200 ease-in-out focus-visible:ring-0 focus-visible:ring-offset-0" asChild>
                <PromptInputTextarea
                  placeholder="Type a message..."
                  className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
                />
              </MentionInput>
              <MentionContent className="z-50 rounded-md border bg-popover p-1 shadow-md">
                {(contact?.isGroup ? (contact.memberIds || []).map((id) => {
                  const member = allKnownContacts.find((c) => c.id === id);
                  if (!member) return null;
                  return (
                    <MentionItem
                      key={member.id}
                      value={member.name}
                      className="px-2 py-1 rounded hover:bg-accent cursor-pointer flex items-center gap-2"
                    >
                      <GeneratedAvatar
                        name={member.name}
                        allContacts={allKnownContacts}
                        currentUser={currentUser}
                      />
                      <span className="font-medium">{member.name}</span>
                    </MentionItem>
                  );
                }) : null)}
              </MentionContent>
              <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
                <div className="flex items-center gap-2">
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setComposerEmojiOpen(true);
                      }}
                      onClick={() => setComposerEmojiOpen(true)}
                    >
                      <Smile className="size-4" />
                    </Button>
                  </PromptInputAction>
                </div>
                <div className="flex items-center gap-2">
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
              </PromptInputActions>
            </PromptInput>
          </Mention>
        {/* Removed duplicate closing form tag */}
        </form>
      </div>
    </div>
  );
};

export default ChatView;
