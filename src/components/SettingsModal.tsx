import React, { useState, useEffect, useRef } from 'react';
import GeneratedAvatar from './GeneratedAvatar';
import type { User, Contact } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createClient } from '@/lib/supabase/client';
import { uploadAttachment } from '@/utils/storageUtils';
import { cn } from '@/lib/utils';
import { useTheme } from "@/components/theme-provider"
import { motion } from "motion/react";
import { cookies } from "@/lib/cookies";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdate: (user: User) => void;
  aiPersonas: Contact[];
  contacts: Contact[];
  onToggleAiContact: (contactId: string, enable: boolean) => void;
}

const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();
  
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    cookies.set('vite-ui-theme', newTheme, { expires: 365 });
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Appearance</Label>
      <div className="grid grid-cols-3 gap-3">
        <Button
          variant="ghost"
          onClick={() => handleThemeChange('light')}
          className={`relative h-28 rounded-xl border overflow-hidden transition-colors ${theme === 'light' ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-card/50'}`}
          aria-pressed={theme === 'light'}
        >
          <img src="/images/light.svg" alt="Light preview" loading="eager" fetchPriority="high" decoding="sync" className="hover:scale-105 transition-all duration-300 absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none"></div>
          {theme === 'light' && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-2 right-2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-sm"
            >
              <motion.svg
                viewBox="0 0 24 24"
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <motion.path
                  d="M20 6L9 17l-5-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ strokeDasharray: "32 32", strokeDashoffset: 32 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
                />
              </motion.svg>
            </motion.span>
          )}
        </Button>

        <Button
          variant="ghost"
          onClick={() => handleThemeChange('dark')}
          className={`relative h-28 rounded-xl border overflow-hidden transition-colors ${theme === 'dark' ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-card/50'}`}
          aria-pressed={theme === 'dark'}
        >
          <img src="/images/dark.svg" alt="Dark preview" loading="eager" fetchPriority="high" decoding="sync" className="hover:scale-105 transition-all duration-300 absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none"></div>
          {theme === 'dark' && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-2 right-2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-sm"
            >
              <motion.svg
                viewBox="0 0 24 24"
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <motion.path
                  d="M20 6L9 17l-5-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ strokeDasharray: "32 32", strokeDashoffset: 32 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
                />
              </motion.svg>
            </motion.span>
          )}
        </Button>

        <Button
          variant="ghost"
          onClick={() => handleThemeChange('system')}
          className={`relative h-28 rounded-xl border overflow-hidden transition-colors ${theme === 'system' ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-card/50'}`}
          aria-pressed={theme === 'system'}
        >
          <img src="/images/system.svg" alt="System preview" loading="eager" fetchPriority="high" decoding="sync" className="hover:scale-105 transition-all duration-300 absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none"></div>
          {theme === 'system' && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-2 right-2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-sm"
            >
              <motion.svg
                viewBox="0 0 24 24"
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <motion.path
                  d="M20 6L9 17l-5-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ strokeDasharray: "32 32", strokeDashoffset: 32 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
                />
              </motion.svg>
            </motion.span>
          )}
        </Button>
      </div>
      {/* Theme labels below the buttons */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <span className="text-sm font-medium text-muted-foreground">Light</span>
        <span className="text-sm font-medium text-muted-foreground">Dark</span>
        <span className="text-sm font-medium text-muted-foreground">System</span>
      </div>
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdate,
  aiPersonas,
  contacts,
  onToggleAiContact,
}) => {
  const [name, setName] = useState(user.name);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user.avatarUrl);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setAvatarPreview(user.avatarUrl);
    }
  }, [isOpen, user.name, user.avatarUrl]);

  const handleSave = async () => {
    if (!name.trim()) return;

    const supabase = createClient();
    let newAvatarUrl = user.avatarUrl;
    const file = avatarFileRef.current?.files?.[0];

    try {
      if (file) {
        newAvatarUrl = await uploadAttachment({ userId: user.id, file });
      }
      await supabase
        .from('User')
        .update({ name: name.trim(), avatarUrl: newAvatarUrl })
        .eq('id', user.id);
    } catch (e) {
      console.error('Failed to update profile', e);
    }

    onUserUpdate({ ...user, name: name.trim(), avatarUrl: newAvatarUrl });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl w-full p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold">Settings</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 py-6 max-h-[70vh] overflow-y-auto">
          {/* Profile Section */}
          <div className="space-y-8">
            <div className="p-5 bg-muted/30 rounded-xl space-y-5">
              <Label className="text-base font-semibold">Profile</Label>
              <div className="flex items-center gap-4">
                <img
                  src={avatarPreview || '/placeholder-avatar.png'}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border"
                />
                <div>
                  <Input
                    type="file"
                    ref={avatarFileRef}
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setAvatarPreview(URL.createObjectURL(file));
                    }}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG up to 2MB
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileName">Display Name</Label>
                <Input
                  id="profileName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your display name"
                />
              </div>
            </div>

            <div className="p-5 bg-muted/30 rounded-xl">
              <ThemeSelector />
            </div>
          </div>

          {/* AI Assistants Section */}
          <div className="p-5 bg-muted/30 rounded-xl flex flex-col">
            <Label className="text-base font-semibold mb-3">Manage AI Assistants</Label>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {aiPersonas.map((persona) => {
                  const isEnabled = contacts.some((c) => c.id === persona.id);
                  return (
                    <div
                      key={persona.id}
                      className="flex items-center justify-between rounded-lg p-3 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <GeneratedAvatar
                          aiPersonas={[persona]}
                          name={persona.name}
                          allContacts={contacts}
                          currentUser={user}
                        />
                        <span className="font-medium">{persona.name}</span>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          onToggleAiContact(persona.id, checked)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="px-6">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
