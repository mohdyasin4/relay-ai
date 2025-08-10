import React, { useState } from 'react';
import Modal from './Modal';
import GeneratedAvatar from './GeneratedAvatar';
import type { Contact, User } from '../types';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  aiPersonas: Contact[];
  onCreateGroup: (name: string, memberIds: string[]) => void;
  embedded?: boolean; // Render content without Dialog wrapper
}

const NewGroupModal: React.FC<NewGroupModalProps> = ({ isOpen, onClose, contacts, aiPersonas, onCreateGroup, embedded = false }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const handleToggleMember = (contactId: string) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleCreate = async () => {
    if (groupName.trim() && selectedMembers.size > 0) {
      setIsCreating(true);
      try {
        await Promise.resolve(onCreateGroup(groupName.trim(), Array.from(selectedMembers)));
        // Reset state for next time
        setGroupName('');
        setSelectedMembers(new Set());
        onClose();
      } finally {
        setIsCreating(false);
      }
    }
  };
  
  const canCreate = groupName.trim() && selectedMembers.size > 0 && !isCreating;

  const dummyUser: User = { id: '', name: '' }; // Dummy user for avatar rendering context

  const content = (
    <div className="space-y-4">
        <div>
          <label htmlFor="groupName" className="block mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Group Name</label>
          <input
            type="text"
            id="groupName"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
            placeholder="e.g., Project Team"
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Select Members</h3>
          <ul className="max-h-40 overflow-y-auto space-y-1 pr-2 -mr-2">
            {contacts.map(contact => {
              const isSelected = selectedMembers.has(contact.id);
              return (
                <li key={contact.id}>
                  <button
                    onClick={() => handleToggleMember(contact.id)}
                    className={`w-full text-left p-2 flex items-center gap-3 rounded-lg transition-colors ${
                      isSelected ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-600 focus:ring-indigo-500 pointer-events-none"
                    />
                    <GeneratedAvatar name={contact.name} allContacts={contacts} currentUser={dummyUser} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{contact.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Add Assistants (Optional)</h3>
           <ul className="max-h-40 overflow-y-auto space-y-1 pr-2 -mr-2">
            {aiPersonas.map(persona => {
              const isSelected = selectedMembers.has(persona.id);
              return (
                <li key={persona.id}>
                  <button
                    onClick={() => handleToggleMember(persona.id)}
                    className={`w-full text-left p-2 flex items-center gap-3 rounded-lg transition-colors ${
                      isSelected ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-600 focus:ring-indigo-500 pointer-events-none"
                    />
                    <GeneratedAvatar name={persona.name} allContacts={aiPersonas} currentUser={dummyUser} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{persona.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {/* Create Group button inside modal content */}
        <div className="flex justify-end pt-2">
          <button onClick={handleCreate} disabled={!canCreate} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center gap-2">
            {isCreating && (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            )}
            Create Group
          </button>
        </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Group"
      footer={
        <div className="flex justify-end">
          <button onClick={handleCreate} disabled={!canCreate} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center gap-2">
            {isCreating && (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            )}
            Create Group
          </button>
        </div>
      }
    >
      {content}
    </Modal>
  );
};

export default NewGroupModal;