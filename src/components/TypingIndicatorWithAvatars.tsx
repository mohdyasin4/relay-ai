import React from 'react';
import { Avatar, AvatarGroup } from '@heroui/react';
import { cn } from '../lib/utils';
import TypingIndicator from './icons/TypingIndicator';
import { Loader } from './ui/loader';

interface TypingUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface TypingIndicatorWithAvatarsProps {
  typingUsers: TypingUser[];
  className?: string;
  showAvatars?: boolean;
  maxAvatars?: number;
}

const TypingIndicatorWithAvatars: React.FC<TypingIndicatorWithAvatarsProps> = ({
  typingUsers,
  className,
  showAvatars = true,
  maxAvatars = 3
}) => {
  if (typingUsers.length === 0) return null;

  const displayUsers = typingUsers.slice(0, maxAvatars);
  const remainingCount = typingUsers.length - maxAvatars;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing`;
    } else if (typingUsers.length === 3) {
      return `${typingUsers[0].name}, ${typingUsers[1].name}, and ${typingUsers[2].name} are typing`;
    } else {
      return `${typingUsers[0].name}, ${typingUsers[1].name}, and ${typingUsers.length - 2} others are typing`;
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showAvatars && (
        <AvatarGroup 
          size="sm" 
          max={maxAvatars}
          className="flex-shrink-0"
        >
          {displayUsers.map((user) => (
            <Avatar
              key={user.id}
              size="sm"
              src={user.avatarUrl}
              name={user.name}
              className="w-6 h-6 text-xs"
              fallback={
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              }
            />
          ))}
        </AvatarGroup>
      )}
      <div className="flex items-center gap-2 min-w-0">
        <Loader className='text-sm text-slate-600 dark:text-slate-400 italic truncate' variant="loading-dots" text={getTypingText()} />      
      </div>
    </div>
  );
};

export default TypingIndicatorWithAvatars;
