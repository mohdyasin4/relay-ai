import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import GeneratedAvatar from './GeneratedAvatar';
import SearchIcon from './icons/SearchIcon';
import CloseIcon from './icons/CloseIcon';
import type { Contact, User, Message } from '../types';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onForward: (contactId: string) => void;
  currentUser: User;
  message?: Message;
}

const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({ 
  isOpen, 
  onClose, 
  contacts, 
  onForward, 
  currentUser,
  message
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const searchLower = searchTerm.toLowerCase();
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(searchLower)
    );
  }, [contacts, searchTerm]);

  const handleSelectContact = (contactId: string) => {
    onForward(contactId);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Forward to..."
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">Select a conversation to forward this message to.</p>
        
        {message && (
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Forwarding:</div>
            <div className="text-sm">
              {message.text && <p className="mb-1 line-clamp-2">{message.text}</p>}
              {message.attachment && <p className="text-indigo-500 dark:text-indigo-400">📷 Image</p>}
            </div>
          </div>
        )}
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search contacts..."
            className="pl-10 pr-4 py-2 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <CloseIcon className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>
        
        <div className="max-h-80 overflow-y-auto pr-2">
          {filteredContacts.length > 0 ? (
            <ul className="space-y-1">
              {filteredContacts.map(contact => (
                <li key={contact.id}>
                  <button
                    onClick={() => handleSelectContact(contact.id)}
                    className="w-full text-left p-3 flex items-center gap-3 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <GeneratedAvatar 
                      name={contact.name} 
                      isGroup={contact.isGroup} 
                      memberIds={contact.memberIds} 
                      allContacts={contacts} 
                      currentUser={currentUser} 
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{contact.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {contact.isGroup ? 'Group' : 'Contact'}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              No contacts found matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ForwardMessageModal;