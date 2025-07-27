import React from 'react';
import Modal from './Modal';
import GeneratedAvatar from './GeneratedAvatar';
import type { Contact, User } from '../types';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onForward: (contactId: string) => void;
  currentUser: User;
}

const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({ isOpen, onClose, contacts, onForward, currentUser }) => {
  
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
      <div className="space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Select a conversation to forward this message to.</p>
        <ul className="max-h-80 overflow-y-auto space-y-1 pr-2">
          {contacts.map(contact => (
            <li key={contact.id}>
              <button
                onClick={() => handleSelectContact(contact.id)}
                className="w-full text-left p-2 flex items-center gap-3 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
              >
                <GeneratedAvatar name={contact.name} isGroup={contact.isGroup} memberIds={contact.memberIds} allContacts={contacts} currentUser={currentUser} />
                <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
};

export default ForwardMessageModal;