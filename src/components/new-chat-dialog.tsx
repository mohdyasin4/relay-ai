"use client"

import * as React from "react"
import { IconPlus, IconRobot, IconUserPlus, IconUsers } from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
  
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

import { createClient } from '@/lib/supabase/client';
import { FriendsService } from '../services/friendsService';
import { AI_PERSONAS } from '../constants';
import type { User, Invitation } from '../types';
import { mqttService } from '@/services/mqttService';
import GoogleContactsService, { type ProcessedContact } from '../services/googleContactsService';

export function NewChatDialog({ currentUser }: { currentUser: User }) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<(User | ProcessedContact)[]>([]);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const [googleContacts, setGoogleContacts] = React.useState<ProcessedContact[]>([]);
  // const [isSearching, setIsSearching] = React.useState(false);
  const [sendingRequest, setSendingRequest] = React.useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);
  const [selectedAI, setSelectedAI] = React.useState<string[]>([]);
  const [groupName, setGroupName] = React.useState('');

  // Load all users and Google contacts on open
  React.useEffect(() => {
    if (open) {
      loadAllUsersAndContacts();
    }
  }, [open]);

  const loadAllUsersAndContacts = async () => {
    const supabase = createClient();
    const { data: users } = await supabase
      .from('User')
      .select('id, name, email, avatarUrl')
      .neq('id', currentUser.id)
      .limit(50);
    setAllUsers(users || []);
    // Google contacts
    try {
      const accessToken = await GoogleContactsService.getGoogleAccessToken();
      let gContacts: ProcessedContact[] = [];
      if (accessToken) {
        gContacts = await GoogleContactsService.getGoogleContacts(accessToken);
      }
      setGoogleContacts(gContacts);
      // Combine users and Google contacts, avoiding duplicates by email
      const combined: any[] = [...(users || [])];
      gContacts.forEach(gc => {
        if (!gc.email || !combined.some(u => u.email === gc.email)) {
          combined.push({
            id: gc.id,
            name: gc.name,
            email: gc.email || '',
            avatarUrl: gc.avatarUrl || ''
          } as User);
        }
      });
      setSearchResults(combined);
    } catch (e) {
      setSearchResults(users || []);
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAISelect = (aiId: string) => {
    console.log('handleAISelect', aiId);
    setSelectedAI(prev =>
      prev.includes(aiId)
        ? prev.filter(id => id !== aiId)
        : [...prev, aiId]
    );
  };

  const sendFriendRequest = async (userId: string) => {
    setSendingRequest(userId);
    try {
      await FriendsService.sendFriendRequest(currentUser.id, userId);
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setSendingRequest(null);
    }
  };

  const startDirectChat = async (userId: string) => {
    await FriendsService.addGroupContact(currentUser.id, userId, false);
    setOpen(false);
  };

  // const startAIChat = async (aiId: string) => {
  //   await FriendsService.addAiContact(currentUser.id, aiId);
  //   setOpen(false);
  // };

  const createGroup = async () => {
    try {
      // Use aiPersonaId for AI members
      const normalizedAI = selectedAI.filter(Boolean);
      const allMemberIds = [...selectedUsers, ...normalizedAI];
      if (!groupName.trim() || allMemberIds.length === 0) return;
      // Create the group using GroupService so it handles members, contacts, and invitations
      const { GroupService } = await import('../services/groupService');
      const groupContact = await GroupService.createGroup(groupName.trim(), currentUser.id, allMemberIds);
      // Optimistically publish invitation to self so the sidebar updates immediately
      const invitation: Invitation = { type: 'invitation', contact: groupContact, topic: `chat/${groupContact.id}` };
      mqttService.publish(`user/${currentUser.id}`, invitation);
    } catch (e) {
      console.error('Failed to create group from dialog:', e);
    } finally {
      setOpen(false);
      setGroupName('');
      setSelectedUsers([]);
      setSelectedAI([]);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      // Combine all users and Google contacts, avoiding duplicates by email
      const combined: any[] = [...allUsers];
      googleContacts.forEach(gc => {
        if (!gc.email || !combined.some(u => u.email === gc.email)) {
          combined.push(gc);
        }
      });
      setSearchResults(combined);
      return;
    }
    // setIsSearching(true);
    // Filter both app users and Google contacts
    const filtered: any[] = [
      ...allUsers.filter(user =>
        user.name.toLowerCase().includes(query.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(query.toLowerCase()))
      ),
      ...googleContacts.filter(gc =>
        gc.name.toLowerCase().includes(query.toLowerCase()) ||
        (gc.email && gc.email.toLowerCase().includes(query.toLowerCase()))
      ).filter(gc => !allUsers.some(u => u.email === gc.email))
    ];
    setSearchResults(filtered);
    // setIsSearching(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="default">
          <IconPlus className="h-4 w-4" />
          New Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
          <DialogDescription>
            Find people to chat with or create a new group
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="people" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="people">Find People</TabsTrigger>
            <TabsTrigger value="group">Create Group</TabsTrigger>
          </TabsList>
          <TabsContent value="people" className="space-y-4">
            <Command>
              <CommandInput
                placeholder="Search by name or email..."
                value={searchQuery}
                onValueChange={handleSearch}
              />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup heading="Users & Contacts">
                  {searchResults.map(user => (
                    <CommandItem key={user.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.name} />
                            <AvatarFallback>
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{user.name}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => startDirectChat(user.id)}>
                            Message
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => sendFriendRequest(user.id)} disabled={sendingRequest === user.id}>
                            <IconUserPlus className="h-4 w-4 mr-1" />
                            Add Friend
                          </Button>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>
          <TabsContent value="group" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="Enter group name..."
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
            </div>
            <Separator />
            <div className="space-y-3">
              <Label>Add Friends</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {[...allUsers, ...googleContacts.filter(gc => !allUsers.some(u => u.email === gc.email))].map(user => (
                  <div key={user.id} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{user.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedUsers.includes(user.id) ? "default" : "outline"}
                      onClick={() => handleUserSelect(user.id)}
                    >
                      {selectedUsers.includes(user.id) ? "Added" : "Add"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label>Add AI Assistants</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {AI_PERSONAS.map(ai => (
                  <div key={ai.aiPersonaId || ai.contactUserId || ai.name} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={ai.avatarUrl || "/placeholder.svg"} alt={ai.name} />
                        <AvatarFallback className="text-xs">
                          <IconRobot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{ai.name}</span>
                          <Badge variant="outline" className="text-xs">AI</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{ai.systemInstruction}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedAI.includes(ai.aiPersonaId || '') ? "default" : "outline"}
                      onClick={() => handleAISelect(ai.aiPersonaId || ai.contactUserId || '')}
                    >
                      {selectedAI.includes(ai.aiPersonaId || '') ? "Added" : "Add"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={createGroup}
              disabled={!groupName || (selectedUsers.length === 0 && selectedAI.length === 0)}
            >
              <IconUsers className="h-4 w-4 mr-2" />
              Create Group ({selectedUsers.length + selectedAI.length} members)
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
