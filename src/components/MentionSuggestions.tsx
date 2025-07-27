import React, { useEffect, useRef } from 'react';
import type { Contact, User } from '../types';
import GeneratedAvatar from './GeneratedAvatar';

interface MentionSuggestionsProps {
    suggestions: Contact[];
    onSelect: (contact: Contact) => void;
    activeIndex: number;
    currentUser: User;
    allContacts: Contact[];
}

const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({ suggestions, onSelect, activeIndex, currentUser, allContacts }) => {
    const activeItemRef = useRef<HTMLLIElement>(null);

    useEffect(() => {
        activeItemRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    }, [activeIndex]);

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className="absolute bottom-full mb-2 w-full max-w-sm bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-20 animate-[slide-up_0.1s_ease-out]">
            <ul className="max-h-60 overflow-y-auto">
                {suggestions.map((contact, index) => (
                    <li key={contact.id} ref={index === activeIndex ? activeItemRef : null}>
                        <button
                            onClick={() => onSelect(contact)}
                            className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${
                                index === activeIndex ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                            aria-current={index === activeIndex}
                        >
                            <GeneratedAvatar name={contact.name} allContacts={allContacts} currentUser={currentUser} />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.name}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default MentionSuggestions;