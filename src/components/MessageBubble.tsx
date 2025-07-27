
import React, { useState } from 'react';
import type { Message, User, Contact } from '../types';
import CheckIcon from './icons/CheckIcon';
import CheckDoubleIcon from './icons/CheckDoubleIcon';
import ReactionIcon from './icons/ReactionIcon';
import ForwardIcon from './icons/ForwardIcon';
import EmojiPicker from './EmojiPicker';
import GeneratedAvatar from './GeneratedAvatar';

interface MessageBubbleProps {
  message: Message;
  currentUser: User;
  allContacts: Contact[];
  isGroup?: boolean;
  onImageClick?: (url: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward: (message: Message) => void;
}

const ReadReceipt: React.FC<{ status: Message['status'] }> = ({ status }) => {
  if (!status) return null;
  const iconClass = "w-4 h-4"; // A bit smaller to match text size
  switch (status) {
    case 'sent':
      return <CheckIcon className={iconClass} />;
    case 'delivered':
       return <CheckDoubleIcon className={iconClass} />;
    case 'read':
      return <CheckDoubleIcon className={`${iconClass} text-emerald-400`} />;
    default:
      return null;
  }
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, currentUser, isGroup, allContacts, onImageClick, onReact, onForward }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isUser = message.senderId === currentUser.id;

  // Don't render empty placeholder bubbles for AI responses
  if (message.senderId !== currentUser.id && !message.text.trim() && !message.attachment) {
    return null;
  }
  
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hasText = message.text && message.text.trim().length > 0;
  
  const showSenderName = isGroup && !isUser;
  const showAvatar = isGroup && !isUser;
  const senderContact = showAvatar ? allContacts.find(c => c.id === message.senderId) : undefined;


  const handleEmojiSelect = (emoji: string) => {
    onReact(message.id, emoji);
    setShowEmojiPicker(false);
  };

  const HoverToolbar = () => (
    <div className={`
      absolute z-10 flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 
      rounded-full shadow-md transition-all duration-200 ease-in-out
      ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}
      ${isUser ? 'right-full mr-2' : 'left-full ml-2'}
      top-1/2 -translate-y-1/2
    `}>
      <div className="relative">
        <button 
            onClick={() => setShowEmojiPicker(p => !p)} 
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" 
            aria-label="React to message"
        >
          <ReactionIcon className="w-5 h-5 text-slate-600 dark:text-slate-400"/>
        </button>
        {showEmojiPicker && <EmojiPicker onEmojiSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
      </div>
      <button onClick={() => onForward(message)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Forward message">
        <ForwardIcon className="w-5 h-5 text-slate-600 dark:text-slate-400"/>
      </button>
    </div>
  );

  return (
    <div
      className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowEmojiPicker(false);
      }}
    >
        <div className="flex items-start gap-2.5 max-w-[calc(100%-4rem)]">
          {showAvatar && senderContact && (
              <GeneratedAvatar 
                  name={senderContact.name} 
                  allContacts={allContacts} 
                  currentUser={currentUser}
                  className="mt-5" // Align with sender name
              />
          )}

          <div 
            className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
            onMouseEnter={() => setIsHovered(true)}
          >
            {showSenderName && (
                <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">{message.senderName}</span>
            )}
            <div className="relative flex items-center">
              {!isUser && <HoverToolbar />}
              <div
                className={`max-w-full flex flex-col rounded-2xl ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-lg'
                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-lg'
                }`}
              >
                <div className={`${!hasText && message.attachment ? 'p-1' : 'px-3 pt-2.5 pb-2'}`}>
                    {message.isForwarded && (
                        <div className={`text-sm flex items-center gap-1.5 opacity-80 mb-1 ${isUser ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                            <ForwardIcon className="w-3.5 h-3.5" />
                            <span>Forwarded</span>
                        </div>
                    )}
                    {message.attachment?.type === 'image' && (
                    <div 
                        className="relative cursor-pointer"
                        onClick={() => onImageClick?.(message.attachment.url)}
                    >
                        <img
                        src={message.attachment.url}
                        alt="User attachment"
                        className="w-full h-auto object-cover rounded-lg"
                        style={{ maxWidth: '320px' }}
                        />
                    </div>
                    )}
                    {hasText && (
                        <p className="whitespace-pre-wrap break-words text-base">{message.text}</p>
                    )}
                </div>
              </div>
              {isUser && <HoverToolbar />}
            </div>
            
            <div className={`flex items-center gap-1.5 px-1 text-xs text-slate-500 dark:text-slate-400`}>
                <span>{time}</span>
                {isUser && <ReadReceipt status={message.status} />}
            </div>
            
            {message.reactions && message.reactions.length > 0 && (
              <div className="relative flex">
                <div className="flex gap-0.5 items-center bg-slate-100 dark:bg-slate-800/80 rounded-full px-1 py-0.5 shadow-sm border border-slate-200 dark:border-slate-700">
                  {message.reactions.map((emoji, i) => (
                    <button
                      key={`${emoji}-${i}`}
                      onClick={() => onReact(message.id, emoji)}
                      className="text-lg p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-label={`Remove ${emoji} reaction`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};

export default MessageBubble;
