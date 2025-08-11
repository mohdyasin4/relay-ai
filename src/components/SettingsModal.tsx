import React, { useState, useEffect, useRef } from 'react';
import GeneratedAvatar from './GeneratedAvatar';
import type { User, Theme, Contact } from '../types';
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

const ThemeSelector: React.FC<{
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}> = ({ theme, onThemeChange }) => {
  const themes = [
    { id: 'light' as Theme, name: 'Light', preview: 'bg-gradient-to-b from-slate-100 to-white' },
    { id: 'dark' as Theme, name: 'Dark', preview: 'bg-gradient-to-b from-slate-900 to-slate-800' },
  ];

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Appearance</Label>
      <div className="flex gap-4">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => onThemeChange(t.id)}
            className={cn(
              'flex flex-col items-center p-3 rounded-xl border-2 w-32 transition-all',
              theme === t.id
                ? 'border-primary shadow-lg scale-[1.03]'
                : 'border-muted hover:border-primary/50'
            )}
          >
            <div className={cn('w-full h-20 rounded-lg border', t.preview)}></div>
            <span className="mt-2 text-sm font-medium">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdate,
  theme,
  onThemeChange,
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
              <ThemeSelector theme={theme} onThemeChange={onThemeChange} />
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
