import React, { useState, useEffect, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';
import { uploadAttachment } from '@/utils/storageUtils';
import { useTheme } from "@/components/theme-provider"
import { motion } from "motion/react";
import { cookies } from "@/lib/cookies";
import { 
  Camera, 
  Upload, 
  User as UserIcon, 
  Palette, 
  Bot, 
  Trash2, 
  X, 
  Settings,
  Shield,
  Bell,
  HelpCircle,
  LogOut,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Avatar } from '@heroui/react';

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
  // aiPersonas, contacts, onToggleAiContact - not used in modernized design
}) => {
  const [name, setName] = useState(user.name);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user.avatarUrl);
  const [hasAvatarChange, setHasAvatarChange] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      // Preserve existing avatarUrl, don't set to null/undefined
      setAvatarPreview(user.avatarUrl || avatarPreview);
      setHasAvatarChange(false);
      setIsUploading(false);
    }
  }, [isOpen, user.name, user.avatarUrl, avatarPreview]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
      setHasAvatarChange(true);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(undefined);
    setHasAvatarChange(true);
    if (avatarFileRef.current) {
      avatarFileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsUploading(true);
    const supabase = createClient();
    // Preserve existing avatar if no changes made
    let newAvatarUrl = user.avatarUrl;
    const file = avatarFileRef.current?.files?.[0];

    try {
      if (hasAvatarChange) {
      if (file) {
        newAvatarUrl = await uploadAttachment({ userId: user.id, file });
        } else if (!avatarPreview) {
          // Only set to undefined if user explicitly removed avatar
          newAvatarUrl = undefined;
        }
      }
      
      await supabase
        .from('User')
        .update({ name: name.trim(), avatarUrl: newAvatarUrl })
        .eq('id', user.id);
    } catch (e) {
      console.error('Failed to update profile', e);
    } finally {
      setIsUploading(false);
    }

    onUserUpdate({ ...user, name: name.trim(), avatarUrl: newAvatarUrl });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl w-full h-[85vh] p-0 overflow-hidden bg-gradient-to-br from-background via-background to-muted/10">
        <DialogHeader className="px-8 pt-8 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                <Settings className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  Settings
                </DialogTitle>
                <p className="text-sm text-muted-foreground">Manage your preferences and account</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 px-8 pb-8">
          <Tabs defaultValue="profile" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl mb-6">
              <TabsTrigger 
                value="profile" 
                className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <UserIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger 
                value="appearance" 
                className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Appearance</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ai" 
                className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">AI</span>
              </TabsTrigger>
              <TabsTrigger 
                value="preferences" 
                className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Privacy</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <TabsContent value="profile" className="mt-0 space-y-6">
          {/* Profile Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50 shadow-lg"
                  >
                    <div className="text-center space-y-6">
                      {/* Avatar Section */}
                      <div className="flex flex-col items-center space-y-6">
                        <div className="relative group">
                          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/60 rounded-full opacity-75 group-hover:opacity-100 transition-opacity blur-sm"></div>
                          <Avatar
                            src={avatarPreview}
                            name={name}
                            size="lg"
                            className="relative w-32 h-32 border-4 border-background shadow-2xl transition-all group-hover:scale-105"
                          />
                          <div 
                            className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex items-center justify-center backdrop-blur-sm"
                            onClick={() => avatarFileRef.current?.click()}
                          >
                            <Camera className="h-8 w-8 text-white" />
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-3 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => avatarFileRef.current?.click()}
                            className="gap-2 bg-background/80 hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                          >
                            <Upload className="h-4 w-4" />
                            Upload Photo
                          </Button>
                          {avatarPreview && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRemoveAvatar}
                              className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          )}
                        </div>
                        
                        <input
                    type="file"
                    ref={avatarFileRef}
                    accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                        />
                        
                        <p className="text-xs text-muted-foreground">
                          Recommended: Square image, at least 400x400px • JPG, PNG up to 2MB
                        </p>
              </div>

                      {/* Name Section */}
                      <div className="space-y-4 max-w-md mx-auto">
                        <Label htmlFor="profileName" className="text-lg font-semibold text-left">Display Name</Label>
                <Input
                  id="profileName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your display name"
                          className="text-center text-lg font-medium h-12 rounded-xl border-2 focus:border-primary/50 transition-colors"
                />
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          This is how others will see you in conversations
                        </div>
              </div>
            </div>
                  </motion.div>
                </TabsContent>

                <TabsContent value="appearance" className="mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50 shadow-lg"
                  >
                    <div className="space-y-6">
                      <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold">Choose Your Theme</h3>
                        <p className="text-muted-foreground">Select the appearance that works best for you</p>
                      </div>
              <ThemeSelector />
            </div>
                  </motion.div>
                </TabsContent>

                <TabsContent value="ai" className="mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50 shadow-lg"
                  >
                    <div className="space-y-8">
                      <div className="text-center space-y-3">
                        <div className="flex items-center justify-center gap-3">
                          <h3 className="text-2xl font-bold">AI Assistants</h3>
                          <div className="px-3 py-1 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 text-amber-800 dark:text-amber-200 text-sm font-medium rounded-full border border-amber-200 dark:border-amber-800 shadow-sm">
                            Experimental
                          </div>
                        </div>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                          Connect with AI assistants to enhance your conversations. Currently available by invitation only.
                        </p>
          </div>

                      {/* Access Restricted Section */}
                      <div className="relative">
                        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border-2 border-dashed border-primary/30 p-12 text-center">
                          <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mb-8 mx-auto shadow-lg">
                            <Bot className="h-12 w-12 text-primary-foreground" />
                          </div>
                          <h4 className="text-2xl font-bold mb-4">Premium Feature</h4>
                          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
                            Get access to powerful AI assistants that can help with various tasks and conversations.
                          </p>
                          <Button 
                            size="lg"
                            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground gap-3 px-8 py-3 rounded-xl font-semibold transition-all hover:shadow-lg transform hover:scale-105"
                            onClick={() => {
                              console.log("Request access clicked");
                            }}
                          >
                            <Bot className="h-5 w-5" />
                            Request Early Access
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                <TabsContent value="preferences" className="mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50 shadow-lg">
                      <div className="space-y-6">
                        <div className="text-center space-y-2">
                          <h3 className="text-2xl font-bold">Privacy & Notifications</h3>
                          <p className="text-muted-foreground">Control how you interact with the app</p>
                        </div>
                        
                        <div className="space-y-4 max-w-2xl mx-auto">
                          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                            <div className="flex items-center gap-3">
                              <Bell className="h-5 w-5 text-primary" />
                              <div>
                                <div className="font-medium">Push Notifications</div>
                                <div className="text-sm text-muted-foreground">Get notified about new messages</div>
                              </div>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          
                          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                            <div className="flex items-center gap-3">
                              <Shield className="h-5 w-5 text-primary" />
                              <div>
                                <div className="font-medium">Online Status</div>
                                <div className="text-sm text-muted-foreground">Show when you're active</div>
                              </div>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          
                          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                      <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                              <div>
                                <div className="font-medium">Read Receipts</div>
                                <div className="text-sm text-muted-foreground">Let others know you've read their messages</div>
                              </div>
                            </div>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50 shadow-lg">
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-center">Need Help?</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Button 
                            variant="outline" 
                            className="gap-2 h-12 rounded-xl bg-background/50"
                          >
                            <HelpCircle className="h-4 w-4" />
                            Help Center
                          </Button>
                          <Button 
                            variant="outline" 
                            className="gap-2 h-12 rounded-xl bg-background/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </Button>
                        </div>
                      </div>
              </div>
                  </motion.div>
                </TabsContent>
            </ScrollArea>
          </div>
          </Tabs>
        </div>

        <DialogFooter className="px-8 py-6 border-t border-border/50 bg-muted/10 backdrop-blur-sm">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Changes are saved automatically
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={isUploading} className="rounded-xl">
                Close
          </Button>
              <Button 
                onClick={handleSave} 
                disabled={isUploading || !name.trim()} 
                className="px-6 gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg"
              >
                {isUploading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {isUploading ? 'Saving...' : 'Save Changes'}
          </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
