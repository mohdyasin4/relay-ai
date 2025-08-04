import React, { useState, useEffect } from 'react';
import { UserCheck, UserX, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { FriendsService, type FriendRequest } from '../services/friendsService';
import { mqttService } from '../services/mqttService';
import { DateUtils } from '../utils/dateUtils';
import type { User } from '../types';

interface FriendRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onRequestAccepted?: (friendId: string) => void;
}

const FriendRequestsModal: React.FC<FriendRequestsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  onRequestAccepted 
}) => {
  const [friendRequests, setFriendRequests] = useState<{
    sent: FriendRequest[];
    received: FriendRequest[];
  }>({ sent: [], received: [] });
  const [loading, setLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFriendRequests();
    }
  }, [isOpen, currentUser.id]);

  const loadFriendRequests = async () => {
    setLoading(true);
    try {
      const requests = await FriendsService.getFriendRequests(currentUser.id);
      setFriendRequests(requests);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    setProcessingRequest(request.id);
    try {
      console.log('Accepting friend request:', request);
      const success = await FriendsService.acceptFriendRequest(
        request.id,
        currentUser.id,
        request.senderId
      );

      if (success) {
        console.log('Friend request accepted successfully, adding to contacts');
        
        // Send MQTT notification to the friend requester so they reload their contacts
        const friendAcceptedNotification = {
          type: 'friend_request_accepted',
          accepterId: currentUser.id,
          accepterName: currentUser.name,
          requesterId: request.senderId
        };
        
        try {
          mqttService.publish(`user/${request.senderId}`, friendAcceptedNotification);
          console.log('Sent friend acceptance notification to:', request.senderId);
        } catch (error) {
          console.error('Failed to send friend acceptance notification:', error);
        }
        
        // Remove from received requests
        setFriendRequests(prev => ({
          ...prev,
          received: prev.received.filter(req => req.id !== request.id)
        }));

        // Notify parent component to reload contacts
        onRequestAccepted?.(request.senderId);
      } else {
        console.error('Failed to accept friend request');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (request: FriendRequest) => {
    setProcessingRequest(request.id);
    try {
      const success = await FriendsService.rejectFriendRequest(request.id);

      if (success) {
        // Remove from received requests
        setFriendRequests(prev => ({
          ...prev,
          received: prev.received.filter(req => req.id !== request.id)
        }));
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const formatDate = (dateString: string) => {
    return DateUtils.formatNotificationTime(dateString);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Friend Requests</DialogTitle>
          <DialogDescription>
            Manage your incoming and outgoing friend requests.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading friend requests...
            </div>
          ) : (
            <Tabs defaultValue="received" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="received" className="relative">
                  Received
                  {friendRequests.received.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {friendRequests.received.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sent" className="relative">
                  Sent
                  {friendRequests.sent.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {friendRequests.sent.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="received" className="space-y-2">
                <div className="max-h-80 overflow-y-auto">
                  {friendRequests.received.length > 0 ? (
                    friendRequests.received.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={request.sender?.avatarUrl} />
                          <AvatarFallback>
                            {request.sender?.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {request.sender?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(request.createdAt)}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAcceptRequest(request)}
                            disabled={processingRequest === request.id}
                          >
                            {processingRequest === request.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserCheck className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectRequest(request)}
                            disabled={processingRequest === request.id}
                          >
                            <UserX className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="font-medium">No friend requests received</p>
                      <p className="text-sm">When someone sends you a friend request, it will appear here.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="sent" className="space-y-2">
                <div className="max-h-80 overflow-y-auto">
                  {friendRequests.sent.length > 0 ? (
                    friendRequests.sent.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={request.receiver?.avatarUrl} />
                          <AvatarFallback>
                            {request.receiver?.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {request.receiver?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Sent {formatDate(request.createdAt)}
                          </p>
                        </div>
                        
                        <Badge variant="outline">Pending</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserX className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="font-medium">No friend requests sent</p>
                      <p className="text-sm">Use the "Add Friends" button to send friend requests.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FriendRequestsModal;
