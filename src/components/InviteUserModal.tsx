import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Loader2, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { createClient } from '@/lib/supabase/client';
import { FriendsService } from '../services/friendsService';
import GoogleContactsService, { type ProcessedContact } from '../services/googleContactsService';
import { InvitationService } from '../services/invitationService';
import type { User } from '../types';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

interface SearchResult extends User {
  friendRequestStatus?: 'none' | 'sent' | 'received' | 'friends';
  source?: 'app' | 'google';
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allContacts, setAllContacts] = useState<SearchResult[]>([]); // Combined app users and Google contacts
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [hasGoogleContacts, setHasGoogleContacts] = useState(false);
  const [needsGoogleReauth, setNeedsGoogleReauth] = useState(false);

  // Load all contacts (app users + Google contacts) on mount
  useEffect(() => {
    if (isOpen) {
      loadAllContacts();
    }
  }, [isOpen]);

  const loadAllContacts = async () => {
    setIsLoadingContacts(true);
    try {
      console.log('Loading Google contacts...');
      // Load Google contacts if available
      const accessToken = await GoogleContactsService.getGoogleAccessToken();
      let googleContacts: ProcessedContact[] = [];
      
      if (accessToken) {
        console.log('Google access token found, fetching contacts...');
        try {
          googleContacts = await GoogleContactsService.getGoogleContacts(accessToken);
          setHasGoogleContacts(true);
          console.log(`✓ Loaded ${googleContacts.length} Google contacts`);
        } catch (error) {
          console.error('Error loading Google contacts:', error);
          setHasGoogleContacts(false);
          
          // Check if it's a permission error
          if (error instanceof Error && error.message === 'INSUFFICIENT_PERMISSIONS') {
            console.log('🔄 Need to re-authenticate for Google Contacts permissions');
            setNeedsGoogleReauth(true);
          }
        }
      } else {
        console.log('❌ No Google access token available - user may need to re-authenticate');
        setHasGoogleContacts(false);
        setNeedsGoogleReauth(true);
      }

      // Load app users and combine with Google contacts
      let appUsers: SearchResult[] = [];
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
          appUsers = await Promise.all(
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
        }
      } catch (error) {
        console.error('Error loading app users:', error);
      }

      // Convert Google contacts to SearchResult format (for inviting to app)
      const googleContactsAsSearchResults: SearchResult[] = googleContacts.map(contact => ({
        id: contact.id || `google-${contact.email}`,
        name: contact.name,
        email: contact.email,
        avatarUrl: contact.avatarUrl,
        source: 'google' as const,
        friendRequestStatus: 'none' as const
      }));

      console.log('📋 Google contacts as search results:', googleContactsAsSearchResults);

      // Combine app users and Google contacts, avoiding duplicates by email
      const combined = [...appUsers];
      let duplicatesFound = 0;
      googleContactsAsSearchResults.forEach(googleContact => {
        // Only add Google contact if no app user with same email exists
        // If Google contact has no email, always add it (can't be a duplicate)
        if (!googleContact.email || !appUsers.some(appUser => appUser.email === googleContact.email)) {
          combined.push(googleContact);
        } else {
          duplicatesFound++;
          console.log(`📧 Duplicate email found: ${googleContact.email} (skipping Google contact)`);
        }
      });

      console.log(`✓ Total contacts loaded: ${combined.length} (${appUsers.length} app users + ${googleContactsAsSearchResults.length - duplicatesFound} Google contacts, ${duplicatesFound} duplicates removed)`);
      console.log('📊 Final combined contacts:', combined);
      setAllContacts(combined);
    } catch (error) {
      console.error('Error loading contacts:', error);
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

  const handleGoogleReauth = async () => {
    try {
      console.log('🔄 User clicked re-auth button');
      const supabase = createClient();
      
      // Sign out first to clear the session
      await supabase.auth.signOut();
      
      // Wait a moment then start new OAuth flow
      setTimeout(async () => {
        await GoogleContactsService.forceReauth();
      }, 1000);
    } catch (error) {
      console.error('Error during Google re-authentication:', error);
    }
  };

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
        <Avatar className="w-10 h-10">
          <AvatarImage src={user.avatarUrl} />
          <AvatarFallback>
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Friends</DialogTitle>
          <DialogDescription>
            Search for users or browse your contacts to send friend requests.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
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
                        {allContacts.length} contacts available{hasGoogleContacts && ' (including Google contacts)'}
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
                  {needsGoogleReauth && !isLoadingContacts && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">Connect Google Contacts</p>
                          <p className="text-sm text-blue-700 mt-1">
                            To see your Google contacts, please re-authenticate with Google to grant contacts access.
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={handleGoogleReauth}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Connect
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">Start searching</p>
                  <p className="text-sm">Type a name or email to find users</p>
                  {needsGoogleReauth && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex flex-col items-center space-y-2">
                        <p className="text-sm font-medium text-blue-900">Connect Google Contacts</p>
                        <p className="text-sm text-blue-700 text-center">
                          Connect your Google account to see and invite your contacts.
                        </p>
                        <Button 
                          size="sm" 
                          onClick={handleGoogleReauth}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Connect Google Contacts
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserModal;
