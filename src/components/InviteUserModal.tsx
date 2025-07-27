import React, { useState } from 'react';
import Modal from './Modal';
import type { Contact } from '../types';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (newUser: Contact) => void;
  existingContacts: Contact[];
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onInvite, existingContacts }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleInvite = () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Please enter a username.');
      return;
    }
    
    if (existingContacts.some(c => c.id.toLowerCase() === trimmedUsername.toLowerCase())) {
        setError('You are already connected with this user.');
        return;
    }

    const newUser: Contact = {
      id: trimmedUsername,
      name: trimmedUsername,
      isAi: false,
      status: 'offline', // Status will be updated when they come online
    };

    onInvite(newUser);
    setUsername('');
    setError('');
    onClose();
  };

  const handleClose = () => {
      setUsername('');
      setError('');
      onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Invite User"
      footer={
        <div className="flex justify-end gap-2">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button onClick={handleInvite} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors">Invite</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="username" className="block mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Enter Username</label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Enter the exact username of the person you want to chat with.</p>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
            }}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
            placeholder="e.g., Ben"
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
           {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    </Modal>
  );
};

export default InviteUserModal;