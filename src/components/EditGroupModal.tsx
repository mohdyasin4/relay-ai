import React, { useState, useEffect } from 'react';
import GeneratedAvatar from './GeneratedAvatar';
import type { Contact, User } from '../types';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from "motion/react";
import { 
  Users, 
  Bot, 
  UserCheck, 
  UserX, 
  Edit3,
  Save,
  Crown
} from 'lucide-react';

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
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen && group) {
      setGroupName(group.name);
      // Initialize with current group members
      const currentMembers = group.memberIds || [];
      setSelectedMembers(new Set(currentMembers));
    }
  }, [isOpen, group]);
  
  const handleToggleMember = (contactId: string) => {
    // Prevent removing the group creator
    if (contactId === group?.creatorId) return;
    
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

  const handleUpdate = async () => {
    if (group && groupName.trim()) {
      setIsUpdating(true);
      try {
        // Ensure creator is always included
        const finalMembers = new Set(selectedMembers);
        if (group.creatorId) {
          finalMembers.add(group.creatorId);
        }
        
        await onUpdateGroup(group.id, groupName.trim(), Array.from(finalMembers));
        onClose();
      } catch (error) {
        console.error('Error updating group:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };
  
  const canUpdate = groupName.trim() && !isUpdating;
  const dummyUser: User = { id: '', name: '' };
  
  // Separate human members and AI personas, include creator in available members
  const humanMembers = contacts.filter(c => !c.isAi);
  const currentMemberCount = selectedMembers.size;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Edit3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Edit Group</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Manage group settings and members
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6">
              {/* Group Name Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-card rounded-xl p-4 border border-border/50"
              >
                <Label htmlFor="groupName" className="text-base font-semibold mb-2 block">Group Name</Label>
                <Input
                  id="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="text-base"
                />
              </motion.div>

              {/* Current Members Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-primary/5 rounded-xl p-4 border border-primary/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Current Members: {currentMemberCount}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {currentMemberCount === 0 ? 'No members selected' : 
                     currentMemberCount === 1 ? '1 member' : 
                     `${currentMemberCount} members`}
                  </div>
                </div>
              </motion.div>

              {/* Human Members Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-card rounded-xl p-4 border border-border/50"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Team Members</h3>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {humanMembers.map(contact => {
                    const isSelected = selectedMembers.has(contact.id);
                    const isCreator = contact.id === group?.creatorId;
                    return (
                      <motion.div
                        key={contact.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <button
                          onClick={() => handleToggleMember(contact.id)}
                          disabled={isCreator}
                          className={`w-full text-left p-3 flex items-center gap-3 rounded-lg transition-all ${
                            isSelected 
                              ? 'bg-primary/10 border border-primary/30 shadow-sm' 
                              : 'hover:bg-muted/50 border border-transparent'
                          } ${isCreator ? 'opacity-90' : 'cursor-pointer'}`}
                        >
                          <div className="relative">
                            {isCreator ? (
                              <Crown className="w-5 h-5 text-amber-500" />
                            ) : isSelected ? (
                              <UserCheck className="w-5 h-5 text-primary" />
                            ) : (
                              <UserX className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <GeneratedAvatar 
                            name={contact.name} 
                            allContacts={contacts} 
                            currentUser={dummyUser}
                            className="w-8 h-8"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{contact.name}</span>
                            {isCreator && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 ml-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                                Creator
                              </span>
                            )}
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* AI Assistants Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-card rounded-xl p-4 border border-border/50"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">AI Assistants</h3>
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium rounded-full">
                    Optional
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {aiPersonas.map(persona => {
                    const isSelected = selectedMembers.has(persona.id);
                    return (
                      <motion.div
                        key={persona.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <button
                          onClick={() => handleToggleMember(persona.id)}
                          className={`w-full text-left p-3 flex items-center gap-3 rounded-lg transition-all ${
                            isSelected 
                              ? 'bg-primary/10 border border-primary/30 shadow-sm' 
                              : 'hover:bg-muted/50 border border-transparent'
                          }`}
                        >
                          <div className="relative">
                            {isSelected ? (
                              <UserCheck className="w-5 h-5 text-primary" />
                            ) : (
                              <UserX className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <GeneratedAvatar 
                            name={persona.name} 
                            allContacts={aiPersonas} 
                            currentUser={dummyUser}
                            className="w-8 h-8"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{persona.name}</span>
                            <div className="text-xs text-muted-foreground">AI Assistant</div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="pt-4">
          <div className="flex gap-3 w-full justify-end">
            <Button variant="outline" onClick={onClose} disabled={isUpdating}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={!canUpdate}
              className="gap-2"
            >
              {isUpdating && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              <Save className="w-4 h-4" />
              Update Group
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditGroupModal;