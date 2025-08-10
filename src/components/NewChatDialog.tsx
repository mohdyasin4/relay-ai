import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import InviteUserModal from './InviteUserModal';
import NewGroupModal from './NewGroupModal';
import type { Contact, User } from '../types';

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  contacts: Contact[];
  aiPersonas: Contact[];
  onCreateGroup: (name: string, memberIds: string[]) => void;
}

const NewChatDialog: React.FC<NewChatDialogProps> = ({ isOpen, onClose, currentUser, contacts, aiPersonas, onCreateGroup }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start New Chat</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="friends" className="mt-2">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="friends">Add Friends</TabsTrigger>
            <TabsTrigger value="groups">Create Group</TabsTrigger>
          </TabsList>
          <TabsContent value="friends">
            <InviteUserModal isOpen={true} onClose={() => {}} currentUser={currentUser} embedded />
          </TabsContent>
          <TabsContent value="groups">
            <NewGroupModal
              isOpen={true}
              onClose={() => {}}
              contacts={contacts.filter(c => !c.isGroup && !c.isAi)}
              aiPersonas={aiPersonas}
              onCreateGroup={onCreateGroup}
              embedded
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;


