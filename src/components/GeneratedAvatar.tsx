import React from 'react';
import type { Contact, User } from '../types';

interface GeneratedAvatarProps {
  name: string;
  isGroup?: boolean;
  memberIds?: string[];
  creatorId?: string;
  allContacts: Contact[];
  currentUser: User;
  className?: string;
}

// Simple hash function to get a color from a string
const getHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const COLORS = [
  'bg-indigo-500', 'bg-teal-500', 'bg-rose-500', 
  'bg-amber-500', 'bg-slate-500', 'bg-violet-500', 
  'bg-emerald-500', 'bg-purple-500', 'bg-cyan-500',
  'bg-pink-500', 'bg-blue-500', 'bg-red-500',
];

const getColor = (id: string) => COLORS[getHash(id) % COLORS.length];

const MemberInitial: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
    const initial = name.charAt(0).toUpperCase();
    const color = getColor(name);
    return (
        <div className={`flex items-center justify-center w-full h-full text-white/90 font-bold ${color} ${className}`}>
            {initial}
        </div>
    );
};

const GeneratedAvatar: React.FC<GeneratedAvatarProps> = ({ name, isGroup, memberIds, creatorId, allContacts, currentUser, className }) => {
  const containerClasses = `w-10 h-10 overflow-hidden flex-shrink-0 ${isGroup ? 'rounded-lg' : 'rounded-full'} ${className}`;
  
  if (isGroup) {
    let displayMembers: {id: string, name: string}[] = [];

    // Prioritize the creator
    if (creatorId) {
        if (creatorId === currentUser.id) {
            displayMembers.push({ id: currentUser.id, name: 'You' });
        } else {
            const creatorContact = allContacts.find(c => c.id === creatorId);
            if (creatorContact) {
                displayMembers.push(creatorContact);
            }
        }
    }
    
    // Add other members (human or AI), ensuring no duplicates
    if (memberIds) {
        const otherMemberIds = memberIds.filter(id => id !== creatorId);

        for (const memberId of otherMemberIds) {
            // Find in contacts or AI personas
            const memberContact = allContacts.find(c => c.id === memberId);
            if (memberContact) {
                 displayMembers.push(memberContact);
            }
        }
    }
    
    // Slice to a max of 4 for the grid
    const finalMembers = displayMembers.slice(0, 4);
    
    return (
      <div className={`${containerClasses} grid grid-cols-2 grid-rows-2 gap-px bg-slate-200 dark:bg-slate-700`}>
        {finalMembers.map(member => (
          <MemberInitial key={member.id} name={member.name} />
        ))}
        {Array.from({ length: 4 - finalMembers.length }).map((_, i) => (
             <div key={`placeholder-${i}`} className="bg-slate-100 dark:bg-slate-800"></div>
        ))}
      </div>
    );
  }

  const initial = name.charAt(0).toUpperCase();
  const color = getColor(name);

  return (
    <div className={`${containerClasses} ${color} flex items-center justify-center`}>
      <span className="text-xl font-bold text-white/90">{initial}</span>
    </div>
  );
};

export default GeneratedAvatar;