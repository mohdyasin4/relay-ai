import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import GeneratedAvatar from './GeneratedAvatar';
import type { User, Theme, Contact } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdate: (user: User) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  aiPersonas: Contact[];
  contacts: Contact[];
  onToggleAiContact: (contactId: string, enable: boolean) => void;
}

const ThemeSelector: React.FC<{ theme: Theme, onThemeChange: (theme: Theme) => void }> = ({ theme, onThemeChange }) => {
    const themes: { id: Theme; name: string; }[] = [
        { id: 'light', name: 'Light' },
        { id: 'dark', name: 'Dark' },
        { id: 'midnight', name: 'Midnight' }
    ];

    return (
        <div>
            <label className="block mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Appearance</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {themes.map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => onThemeChange(t.id)} 
                        className={`text-center p-2 rounded-lg border-2 transition-colors ${theme === t.id ? 'border-indigo-500' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600'}`}
                        aria-pressed={theme === t.id}
                    >
                        <div className="w-full h-20 rounded-md border border-slate-300 dark:border-slate-600 flex overflow-hidden bg-white dark:bg-slate-900">
                            {t.id === 'light' && (
                                <>
                                    <div className="w-1/3 bg-slate-200 border-r border-slate-300"></div>
                                    <div className="w-2/3 bg-slate-50"></div>
                                </>
                            )}
                            {t.id === 'dark' && (
                                <>
                                    <div className="w-1/3 bg-slate-800 border-r border-slate-700"></div>
                                    <div className="w-2/3 bg-slate-900"></div>
                                </>
                            )}
                            {t.id === 'midnight' && (
                                <>
                                    <div className="w-1/3 bg-black border-r border-slate-800"></div>
                                    <div className="w-2/3 bg-slate-900"></div>
                                </>
                            )}
                        </div>
                        <span className="block font-medium text-sm mt-2">{t.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};


const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, user, onUserUpdate, theme, onThemeChange,
    aiPersonas, contacts, onToggleAiContact
}) => {
  const [name, setName] = useState(user.name);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
    }
  }, [isOpen, user.name]);

  const handleSave = () => {
    if (name.trim()) {
      onUserUpdate({ ...user, name: name.trim() });
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors">Save</button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label htmlFor="profileName" className="block mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Your Name</label>
          <input
            type="text"
            id="profileName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
            placeholder="Your name"
          />
        </div>
        <ThemeSelector theme={theme} onThemeChange={onThemeChange} />

        <div>
          <label className="block mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">Manage AI Assistants</label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 -mr-2">
            {aiPersonas.map(persona => {
              const isEnabled = contacts.some(c => c.id === persona.id);
              return (
                <div key={persona.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <GeneratedAvatar name={persona.name} allContacts={contacts} currentUser={user} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{persona.name}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    onClick={() => onToggleAiContact(persona.id, !isEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                      isEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Modal>
  );
};

export default SettingsModal;