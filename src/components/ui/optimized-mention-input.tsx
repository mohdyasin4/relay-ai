import React, { useState, useCallback, useMemo, memo } from 'react';
import { Mention, MentionContent, MentionInput, MentionItem } from './mention';
import { Button } from './button';
import { Send, Paperclip } from 'lucide-react';
import { motion } from 'motion/react';
import type { Contact, User } from '@/types';

interface OptimizedMentionInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  className?: string;
  contacts: Contact[];
  currentUser: User;
  onFileChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  attachment?: any;
  isComposerEmojiOpen?: boolean;
  onEmojiClick?: (emojiData: any) => void;
  setComposerEmojiOpen?: (open: boolean) => void;
}

// Memoized mention item component to prevent unnecessary re-renders
const MemoizedMentionItem = memo(({ 
  member, 
  onSelect 
}: { 
  member: Contact; 
  onSelect: (member: Contact) => void;
}) => (
  <MentionItem
    value={member.name}
    className="px-2 py-1 rounded hover:bg-accent cursor-pointer flex items-center gap-2"
    onSelect={() => onSelect(member)}
  >
    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
      {member.name.charAt(0).toUpperCase()}
    </div>
    <span className="font-medium">{member.name}</span>
  </MentionItem>
));

MemoizedMentionItem.displayName = 'MemoizedMentionItem';

// Memoized emoji picker to prevent re-renders
const MemoizedEmojiPicker = memo(({ 
  isOpen, 
  onEmojiClick, 
  onClose 
}: { 
  isOpen: boolean; 
  onEmojiClick: (emojiData: any) => void; 
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute bottom-[100%] left-0 mb-2 z-50 emoji-picker-container"
    >
      <div className="bg-popover border border-border rounded-lg shadow-lg p-2">
        <div className="grid grid-cols-8 gap-1">
          {['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '💯', '✨', '🎉', '🚀', '💪', '👏', '🙏'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onEmojiClick({ emoji });
                onClose();
              }}
              className="w-8 h-8 text-lg hover:bg-accent rounded transition-colors duration-150"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
});

MemoizedEmojiPicker.displayName = 'MemoizedEmojiPicker';

export const OptimizedMentionInput = memo(({
  value,
  onValueChange,
  onSubmit,
  isLoading = false,
  className = "",
  contacts,
  currentUser,
  onFileChange,
  attachment,
  isComposerEmojiOpen = false,
  onEmojiClick,
  setComposerEmojiOpen,
}: OptimizedMentionInputProps) => {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  // Filter out current user from mentions to prevent self-mentions
  const mentionableContacts = useMemo(() => {
    return contacts.filter(contact => contact.id !== currentUser.id);
  }, [contacts, currentUser.id]);

  // Memoized submit handler
  const handleSubmit = useCallback(() => {
    if (value.trim() || attachment) {
      onSubmit();
    }
  }, [value, attachment, onSubmit]);

  // Memoized emoji click handler
  const handleEmojiClick = useCallback((emojiData: any) => {
    onValueChange(value + emojiData.emoji);
    setIsEmojiOpen(false);
    if (setComposerEmojiOpen) {
      setComposerEmojiOpen(false);
    }
  }, [value, onValueChange, setComposerEmojiOpen]);

  // Memoized mention selection handler
  const handleMentionSelect = useCallback((member: Contact) => {
    const mentionText = `@${member.name} `;
    onValueChange(value + mentionText);
  }, [value, onValueChange]);

  // Memoized file change handler
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (onFileChange) {
      onFileChange(event);
    }
  }, [onFileChange]);

  // Check if submit button should be disabled
  const isSubmitDisabled = useMemo(() => {
    return !value.trim() && !attachment;
  }, [value, attachment]);

  return (
    <div className={`flex items-center border-input bg-popover relative z-10 w-full border-t pt-1 shadow-xs ${className}`}>
      {/* Emoji picker overlay */}
      <div className="relative">
        <MemoizedEmojiPicker
          isOpen={isEmojiOpen || isComposerEmojiOpen}
          onEmojiClick={handleEmojiClick}
          onClose={() => {
            setIsEmojiOpen(false);
            if (setComposerEmojiOpen) {
              setComposerEmojiOpen(false);
            }
          }}
        />
      </div>
      
      {/* Actions, textarea, and send button in one line */}
      <div className="flex items-center gap-2 px-3 py-2 w-full">
        {/* Actions before textarea */}
        <div className="flex items-center gap-2 shrink-0">
          {onFileChange && (
            <Button 
              variant="outline" 
              size="icon" 
              className="size-9 rounded-full" 
              asChild
            >
              <label htmlFor="file-upload" className="cursor-pointer">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <Paperclip className="size-4" />
              </label>
            </Button>
          )}
          
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full"
            onClick={() => setIsEmojiOpen(!isEmojiOpen)}
          >
            😀
          </Button>
        </div>
        
        {/* Mention input */}
        <Mention
          value={value}
          onValueChange={onValueChange}
          className="flex-1 **:data-tag:rounded-full **:data-tag:px-2.5 **:data-tag:py-1 **:data-tag:text-[12px] **:data-tag:bg-primary **:data-tag:text-primary-foreground"
        >
          <MentionInput
            className="w-full border-none transition-all duration-200 ease-in-out focus-visible:ring-0 focus-visible:ring-offset-0"
            asChild
          >
            <textarea
              placeholder="Type a message..."
              className="w-full text-base leading-[1.3] sm:text-base md:text-base px-3 py-2 resize-none border-none outline-none bg-transparent"
              rows={1}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </MentionInput>
        </Mention>
        
        {/* Send button on the right */}
        <Button
          size="icon"
          disabled={isSubmitDisabled}
          onClick={handleSubmit}
          className="size-9 rounded-full transition-all duration-200"
          type="button"
        >
          <Send className="size-4" />
        </Button>
      </div>
      
      {/* Mention suggestions */}
      <MentionContent
        className="absolute left-0 w-[calc(100%-0px)] max-w-[520px] z-50 rounded-md border bg-popover p-1 shadow-md"
        style={{ minWidth: '220px' }}
      >
        {mentionableContacts.map((member) => (
          <MemoizedMentionItem
            key={member.id}
            member={member}
            onSelect={handleMentionSelect}
          />
        ))}
      </MentionContent>
    </div>
  );
});

OptimizedMentionInput.displayName = 'OptimizedMentionInput';





