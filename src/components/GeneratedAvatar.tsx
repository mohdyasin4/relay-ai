import React from 'react';
import type { Contact, User } from '../types';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface GeneratedAvatarProps {
  name: string;
  isGroup?: boolean;
  memberIds?: string[];
  creatorId?: string;
  allContacts: Contact[];
  aiPersonas?: Contact[];
  currentUser: User;
  className?: string;
}




const GeneratedAvatar: React.FC<GeneratedAvatarProps> = ({ name, isGroup, memberIds, creatorId, allContacts, aiPersonas = [], currentUser, className }) => {
  // For group avatars, show a grid of member avatars (up to 4)
  if (isGroup) {
    let displayMembers: Contact[] = [];
    const allSources = [...allContacts, ...aiPersonas];
    // Add creator
    if (creatorId) {
      if (currentUser && currentUser.id === creatorId) {
        displayMembers.push({ ...currentUser });
      } else {
        const creatorContact = allSources.find(c => c.id === creatorId);
        if (creatorContact) displayMembers.push(creatorContact);
      }
    }
    // Add other members
    if (memberIds) {
      const otherMemberIds = memberIds.filter(id => id !== creatorId);
      for (const memberId of otherMemberIds) {
        if (currentUser && currentUser.id === memberId) {
          // Avoid duplicate if already added as creator
          if (!displayMembers.some(m => m.id === currentUser.id)) {
            displayMembers.push({ ...currentUser });
          }
        } else {
          const memberContact = allSources.find(c => c.id === memberId);
          if (memberContact) displayMembers.push(memberContact);
        }
      }
    }
    // Show all members, adapt grid size
    const memberCount = displayMembers.length;
    let gridClass = "";
    if (memberCount <= 1) gridClass = "grid-cols-1 grid-rows-1";
    else if (memberCount <= 4) gridClass = "grid-cols-2 grid-rows-2";
    else if (memberCount <= 9) gridClass = "grid-cols-3 grid-rows-3";
    else gridClass = "grid-cols-4 grid-rows-4";
    return (
      <div className={`w-12 h-12 grid ${gridClass} gap-px bg-slate-200 dark:bg-slate-700 rounded-md overflow-hidden flex-shrink-0 ${className}`}>
        {displayMembers.map((member) => (
          <Avatar key={member.id} className="rounded-none w-full h-full">
            {member.avatarUrl ? (
              <AvatarImage src={member.avatarUrl} alt={member.name} />
            ) : (
              <AvatarFallback className='rounded-none font-extrabold'>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
        ))}
        {/* Fill empty grid spots if needed */}
        {Array.from({ length: Math.max(0, Math.ceil(Math.sqrt(memberCount)) ** 2 - memberCount) }).map((_, i) => (
          <div key={`placeholder-${i}`} className="rounded-none bg-slate-100 dark:bg-slate-800"></div>
        ))}
      </div>
    );
  }

  // Single avatar (contact or user)
  let avatarUrl = "";
  const allSources = [...allContacts, ...aiPersonas];
  if (allSources.length > 0) {
    const contact = allSources.find(c => c.name === name);
    if (contact && contact.avatarUrl) avatarUrl = contact.avatarUrl;
  }
  if (!avatarUrl && currentUser && currentUser.name === name && currentUser.avatarUrl) {
    avatarUrl = currentUser.avatarUrl;
  }
  return (
    <Avatar className={`rounded-md w-12 h-12 ${className}`}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={name} />
      ) : (
        <AvatarFallback className='rounded-md w-12 h-12 text-lg font-extrabold'>{name.charAt(0).toUpperCase()}</AvatarFallback>
      )}
    </Avatar>
  );
};

export default GeneratedAvatar;