import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Loader2, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { FriendsService } from '../services/friendsService';
// Google Contacts removed to avoid test user management
import { InvitationService } from '../services/invitationService';
import type { User } from '../types';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  embedded?: boolean; // Render content without Dialog wrapper
}

interface SearchResult extends User {
  friendRequestStatus?: 'none' | 'sent' | 'received' | 'friends';
  source?: 'app' | 'google';
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, currentUser, embedded = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allContacts, setAllContacts] = useState<SearchResult[]>([]); // Combined app users and Google contacts
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  // Google Contacts functionality removed

  // Load all contacts (app users + Google contacts)
  useEffect(() => {
    if (embedded || isOpen) {
      loadAllContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, embedded]);

  const loadAllContacts = async () => {
    setIsLoadingContacts(true);
    try {
      console.log('Loading app users...');
      const supabase = createClient();
      const { data: users, error } = await supabase
        .from('User')
        .select('id, name, email, avatarUrl')
        .neq('id', currentUser.id)
        .limit(50);

      if (!error && users) {
        console.log(`Found ${users.length} app users`);
        // Get friend request statuses for all users
        const appUsers = await Promise.all(
          users.map(async (user) => {
            const status = await checkFriendRequestStatus(user.id);
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
              source: 'app' as const,
              friendRequestStatus: status
            };
          })
        );
        
        console.log(`✓ Total contacts loaded: ${appUsers.length} app users`);
        setAllContacts(appUsers);
      } else {
        console.error('Error loading app users:', error);
        setAllContacts([]);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      setAllContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const checkFriendRequestStatus = async (userId: string): Promise<'none' | 'sent' | 'received' | 'friends'> => {
    try {
      const supabase = createClient();
      
      // Check if already friends
      const { data: existingContact } = await supabase
        .from('Contact')
        .select('id')
        .eq('userId', currentUser.id)
        .eq('contactUserId', userId)
        .limit(1);

      if (existingContact && existingContact.length > 0) {
        return 'friends';
      }

      // Check friend requests
      const { data: friendRequests } = await supabase
        .from('FriendRequest')
        .select('senderId, receiverId, status')
        .or(`and(senderId.eq.${currentUser.id},receiverId.eq.${userId}),and(receiverId.eq.${currentUser.id},senderId.eq.${userId})`)
        .eq('status', 'pending');

      if (friendRequests && friendRequests.length > 0) {
        const request = friendRequests[0];
        return request.senderId === currentUser.id ? 'sent' : 'received';
      }

      return 'none';
    } catch (error) {
      console.error('Error checking friend request status:', error);
      return 'none';
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      // Show all contacts when no search query
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    console.log(`Searching for: "${query}" in ${allContacts.length} loaded contacts`);
    
    try {
      // Search in loaded contacts first (includes both app users and Google contacts)
      const filteredContacts = allContacts.filter(contact => {
        const nameMatch = contact.name.toLowerCase().includes(query.toLowerCase());
        const emailMatch = contact.email && contact.email.toLowerCase().includes(query.toLowerCase());
        return nameMatch || emailMatch;
      });

      console.log(`Found ${filteredContacts.length} matches in loaded contacts (${allContacts.length} total)`);
      console.log('Sample filtered contacts:', filteredContacts.slice(0, 3));

      // Also search for additional users in database that might not be in allContacts
      const supabase = createClient();
      const { data: users, error } = await supabase
        .from('User')
        .select('id, name, email, avatarUrl')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .neq('id', currentUser.id)
        .limit(10);

      if (error) {
        console.error('Error searching database users:', error);
        setSearchResults(filteredContacts);
        return;
      }

      console.log(`Found ${users?.length || 0} additional users in database`);

      // Process additional database users
      const additionalUsers: SearchResult[] = [];
      if (users && users.length > 0) {
        for (const user of users) {
          // Skip if already in filtered contacts
          if (filteredContacts.some(c => c.id === user.id)) continue;

          const status = await checkFriendRequestStatus(user.id);
          additionalUsers.push({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            source: 'app' as const,
            friendRequestStatus: status
          });
        }
      }

      // Combine filtered contacts with additional users
      const combinedResults = [...filteredContacts, ...additionalUsers];
      console.log(`Total search results: ${combinedResults.length}`);
      setSearchResults(combinedResults);
      
    } catch (error) {
      console.error('Error in search:', error);
      // Fallback to just filtered contacts
      const filteredContacts = allContacts.filter(contact =>
        contact.name.toLowerCase().includes(query.toLowerCase()) ||
        (contact.email && contact.email.toLowerCase().includes(query.toLowerCase()))
      );
      setSearchResults(filteredContacts);
    } finally {
      setIsSearching(false);
    }
  };

  // Google reauth functionality removed

  const sendFriendRequest = async (targetUserId: string) => {
    setSendingRequest(targetUserId);
    try {
      // Find the contact/user being invited
      const contact = [...allContacts, ...searchResults].find(c => c.id === targetUserId);
      
      if (!contact) {
        console.error('Contact not found');
        return;
      }

      // Check if this is a Google contact that's actually a registered user
      if (contact.source === 'google' && contact.email) {
        const supabase = createClient();
        const { data: existingUsers } = await supabase
          .from('User')
          .select('id')
          .eq('email', contact.email)
          .limit(1);
        
        // If user exists in database, send friend request to their actual user ID
        if (existingUsers && existingUsers.length > 0) {
          const registeredUserId = existingUsers[0].id;
          console.log(`Google contact ${contact.email} is registered as user ${registeredUserId}`);
          
          const success = await FriendsService.sendFriendRequest(currentUser.id, registeredUserId);
          
          if (!success) {
            console.error('Failed to send friend request to registered user');
            return;
          }
          
          // Update the UI
          setSearchResults(prev => prev.map(user => 
            user.id === targetUserId 
              ? { ...user, friendRequestStatus: 'sent' }
              : user
          ));
          
          setAllContacts(prev => prev.map(user => 
            user.id === targetUserId 
              ? { ...user, friendRequestStatus: 'sent' }
              : user
          ));
          
          alert(`Friend request sent to ${contact.name}`);
          return;
        }
        
        // If user doesn't exist, send email invitation
        if (!contact.email || contact.email.trim() === '') {
          console.error('Contact email is missing or empty');
          alert('Cannot send invitation: Contact has no email address');
          return;
        }
        
        const result = await InvitationService.inviteUserByEmail(
          contact.email,
          currentUser.name
        );
        
        if (result.success) {
          // Update UI to show invitation sent
          setSearchResults(prev => prev.map(user => 
            user.id === targetUserId 
              ? { ...user, friendRequestStatus: 'sent' }
              : user
          ));
          setAllContacts(prev => prev.map(user => 
            user.id === targetUserId 
              ? { ...user, friendRequestStatus: 'sent' }
              : user
          ));
          alert(`Invitation sent to ${contact.email}`);
        } else {
          console.error('Failed to send invitation:', result.message);
          alert(`Failed to send invitation: ${result.message}`);
        }
        
        return;
      }

      // For app users, send friend request directly
      const success = await FriendsService.sendFriendRequest(currentUser.id, targetUserId);
      
      if (!success) {
        console.error('Failed to send friend request');
        return;
      }

      // Update the search results to reflect the sent request
      setSearchResults(prev => prev.map(user => 
        user.id === targetUserId 
          ? { ...user, friendRequestStatus: 'sent' }
          : user
      ));
      
      setAllContacts(prev => prev.map(user => 
        user.id === targetUserId 
          ? { ...user, friendRequestStatus: 'sent' }
          : user
      ));

      // TODO: Send real-time notification to the target user via MQTT
      
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setSendingRequest(null);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setAllContacts([]);
    onClose();
  };

  const getStatusBadge = (status: SearchResult['friendRequestStatus']) => {
    switch (status) {
      case 'friends':
        return <Badge variant="secondary">Friends</Badge>;
      case 'sent':
        return <Badge variant="outline">Request Sent</Badge>;
      case 'received':
        return <Badge variant="default">Pending Request</Badge>;
      default:
        return null;
    }
  };

  // Component for rendering user/contact cards
  const UserCard: React.FC<{
    user: SearchResult | ProcessedContact;
    onSendRequest: (id: string) => void;
    sendingRequest: string | null;
    getStatusBadge: (status: any) => React.ReactNode;
  }> = ({ user, onSendRequest, sendingRequest, getStatusBadge }) => {
    const [isGoogleContactNotRegistered, setIsGoogleContactNotRegistered] = useState<boolean | null>(null);
    const hasEmail = user.email && user.email.trim() !== '';
    const canInvite = hasEmail && isGoogleContactNotRegistered; // Can only invite if contact has email and is not registered
    
    // Check if Google contact is registered in Supabase
    useEffect(() => {
      const checkIfUserExists = async () => {
        if (user.source === 'google' && hasEmail) {
          try {
            const supabase = createClient();
            const { data: existingUsers } = await supabase
              .from('User')
              .select('id')
              .eq('email', user.email)
              .limit(1);
            
            const isNotRegistered = !existingUsers || existingUsers.length === 0;
            setIsGoogleContactNotRegistered(isNotRegistered);
          } catch (error) {
            console.error('Error checking if user exists:', error);
            setIsGoogleContactNotRegistered(true); // Default to not registered on error
          }
        } else if (user.source === 'app') {
          setIsGoogleContactNotRegistered(false); // App users are always registered
        } else {
          setIsGoogleContactNotRegistered(true); // Google contact without email, treat as not registered
        }
      };
      
      checkIfUserExists();
    }, [user.source, user.email, hasEmail]);
    
    return (
      <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
        <Avatar className="rounded-md w-10 h-10">
          <AvatarImage src={user.avatarUrl} />
          <AvatarFallback className='rounded-none font-extrabold'>
            {user.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{user.name}</p>
            {user.source === 'google' && (
              <Badge variant="outline" className="text-xs">
                {isGoogleContactNotRegistered === null ? 'Checking...' : 
                 isGoogleContactNotRegistered ? 'Google Contact' : 'Registered User'}
              </Badge>
            )}
          </div>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        
        <div className="flex items-center space-x-2">
          {getStatusBadge(user.friendRequestStatus)}
          
          {user.friendRequestStatus === 'none' && canInvite && (
            <Button
              size="sm"
              onClick={() => onSendRequest(user.id)}
              disabled={sendingRequest === user.id}
              variant="outline"
            >
              {sendingRequest === user.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-3 h-3 mr-1" />
                  Invite
                </>
              )}
            </Button>
          )}
          
          {user.friendRequestStatus === 'none' && !isGoogleContactNotRegistered && user.source === 'google' && (
            <Button
              size="sm"
              onClick={() => onSendRequest(user.id)}
              disabled={sendingRequest === user.id}
              variant="default"
            >
              {sendingRequest === user.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-3 h-3 mr-1" />
                  Add Friend
                </>
              )}
            </Button>
          )}
          
          {user.friendRequestStatus === 'none' && user.source === 'app' && (
            <Button
              size="sm"
              onClick={() => onSendRequest(user.id)}
              disabled={sendingRequest === user.id}
              variant="default"
            >
              {sendingRequest === user.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-3 h-3 mr-1" />
                  Add Friend
                </>
              )}
            </Button>
          )}
          
          {user.friendRequestStatus === 'none' && !canInvite && isGoogleContactNotRegistered && !hasEmail && (
            <Badge variant="secondary" className="text-xs">
              No Email
            </Badge>
          )}
          
          {isGoogleContactNotRegistered === null && (
            <Badge variant="outline" className="text-xs">
              Checking...
            </Badge>
          )}
        </div>
      </div>
    );
  };

  const content = (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Search for users or browse your contacts to send friend requests.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            searchUsers(e.target.value);
          }}
          className="pl-10"
        />
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Searching...
          </div>
        ) : searchQuery.trim() ? (
          searchResults.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                {searchResults.length} results found
              </p>
              {searchResults.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onSendRequest={sendFriendRequest}
                  sendingRequest={sendingRequest}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="font-medium">No users found</p>
              <p className="text-sm">No users found matching "{searchQuery}"</p>
            </div>
          )
        ) : (
          allContacts.length > 0 || isLoadingContacts ? (
            <>
              {isLoadingContacts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading contacts...
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    {allContacts.length} contacts available
                  </p>
                  {allContacts.map((contact, index) => (
                    <UserCard
                      key={`${contact.id}-${index}`}
                      user={contact}
                      onSendRequest={sendFriendRequest}
                      sendingRequest={sendingRequest}
                      getStatusBadge={getStatusBadge}
                    />
                  ))}
                </>
              )}
              {/* Google Contacts functionality removed */}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="font-medium">Start searching</p>
              <p className="text-sm">Type a name or email to find users</p>
              {/* Google Contacts functionality removed */}
            </div>
          )
        )}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Friends"
    >
      {content}
    </Modal>
  );
};

export default InviteUserModal;
