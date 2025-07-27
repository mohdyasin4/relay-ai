import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import GeneratedAvatar from './GeneratedAvatar';
import type { Contact, User } from '../types';

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Contact | null;
  contacts: Contact[];
  aiPersonas: Contact[];
  onUpdateGroup: (groupId: string, name: string, memberIds: string[]) => void;
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({ isOpen, onClose, group, contacts, aiPersonas, onUpdateGroup }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && group) {
      setGroupName(group.name);
      // Exclude the user's own ID from the initial set for selection purposes,
      // as it's implicitly included on update.
      const nonUserMembers = group.memberIds?.filter(id => id !== group.creatorId) || [];
      setSelectedMembers(new Set(nonUserMembers));
    }
  }, [isOpen, group]);
  
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

  const handleUpdate = () => {
    if (group && groupName.trim()) { // Allow empty member list to remove all others
      onUpdateGroup(group.id, groupName.trim(), Array.from(selectedMembers));
      onClose();
    }
  };
  
  const canUpdate = groupName.trim();
  const dummyUser: User = { id: '', name: '' };
  
  const humanMembers = contacts.filter(c => c.id !== group?.creatorId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Group"
      footer={
        <div className="flex justify-end">
          <button onClick={handleUpdate} disabled={!canUpdate} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed">
            Save Changes
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="editGroupName" className="block mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Group Name</label>
          <input
            type="text"
            id="editGroupName"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
            placeholder="e.g., Project Team"
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Select Members</h3>
          <ul className="max-h-40 overflow-y-auto space-y-1 pr-2 -mr-2">
            {humanMembers.map(contact => {
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
          <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Manage Assistants</h3>
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

export default EditGroupModal;