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
}

const NewGroupModal: React.FC<NewGroupModalProps> = ({ isOpen, onClose, contacts, aiPersonas, onCreateGroup }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

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

  const handleCreate = () => {
    if (groupName.trim() && selectedMembers.size > 0) {
      onCreateGroup(groupName.trim(), Array.from(selectedMembers));
      // Reset state for next time
      setGroupName('');
      setSelectedMembers(new Set());
    }
  };
  
  const canCreate = groupName.trim() && selectedMembers.size > 0;

  const dummyUser: User = { id: '', name: '' }; // Dummy user for avatar rendering context

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Group"
      footer={
        <div className="flex justify-end">
          <button onClick={handleCreate} disabled={!canCreate} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed">
            Create Group
          </button>
        </div>
      }
    >
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
      </div>
    </Modal>
  );
};

export default NewGroupModal;