import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/lib/websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConversationListItem } from "@/components/ConversationListItem";
import { ChatMessage } from "@/components/ChatMessage";
import { MessageComposer } from "@/components/MessageComposer";
import { TypingIndicator } from "@/components/TypingIndicator";
import { OnlineStatus } from "@/components/OnlineStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ObjectUploader } from "@/components/ObjectUploader";
import { getUserDisplayName, formatLastSeen, formatDateSeparator } from "@/lib/formatters";
import type { ConversationWithDetails, MessageWithSender, User } from "@shared/schema";
import {
  LogOut,
  Search,
  Plus,
  MoreVertical,
  Phone,
  Video,
  Menu,
  X,
  Users,
  MessageCircle,
  Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<MessageWithSender | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<ConversationWithDetails[]>({
    queryKey: ['/api/conversations'],
    enabled: !!user,
  });

  // WebSocket connection with error handling
  const { sendMessage: sendWsMessage, isConnected: wsConnected } = useWebSocket((message) => {
    try {
      if (message.type === 'message') {
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        if (message.data.conversationId === selectedConversationId) {
          queryClient.invalidateQueries({ queryKey: ['/api/messages', selectedConversationId] });
        }
      } else if (message.type === 'typing') {
        const { conversationId, userId, userName } = message.data;
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          if (!newMap.has(conversationId)) {
            newMap.set(conversationId, new Set());
          }
          newMap.get(conversationId)!.add(userId);
          return newMap;
        });
        
        setTimeout(() => {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            const users = newMap.get(conversationId);
            if (users) {
              users.delete(userId);
              if (users.size === 0) {
                newMap.delete(conversationId);
              }
            }
            return newMap;
          });
        }, 3000);
      } else if (message.type === 'presence') {
        setOnlineUsers(new Set(message.data.onlineUserIds));
      } else if (message.type === 'status_update') {
        // Only invalidate if the status update came from another user
        if (message.data.userId !== user?.id) {
          queryClient.invalidateQueries({ queryKey: ['/api/messages', message.data.conversationId] });
        }
      } else if (message.type === 'reaction_added' || message.type === 'message_edited') {
        // Invalidate messages to show new reactions or edits
        queryClient.invalidateQueries({ queryKey: ['/api/messages', message.data.conversationId] });
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }, conversations?.map(c => c.id) || []);

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<MessageWithSender[]>({
    queryKey: ['/api/messages', selectedConversationId],
    enabled: !!selectedConversationId,
  });

  // Fetch all users for new conversation
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: !!user,
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, fileUrl, fileName, fileSize, type, replyToId }: {
      content?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      type?: string;
      replyToId?: string;
    }) => {
      return apiRequest('POST', '/api/messages', {
        conversationId: selectedConversationId,
        content,
        fileUrl,
        fileName,
        fileSize,
        type: type || 'text',
        replyToId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async ({ userIds, isGroup, name }: { userIds: string[]; isGroup: boolean; name?: string }) => {
      return apiRequest('POST', '/api/conversations', { userIds, isGroup, name });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setSelectedConversationId(data.id);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear reply state when conversation changes
  useEffect(() => {
    setReplyToMessage(null);
  }, [selectedConversationId]);

  // Send typing indicator
  const handleTyping = () => {
    if (!selectedConversationId || !user) return;
    
    sendWsMessage({
      type: 'typing',
      data: {
        conversationId: selectedConversationId,
        userId: user.id,
        userName: getUserDisplayName(user),
      },
    });
  };

  // Handle file upload
  const handleFileUpload = async () => {
    // This will be triggered by ObjectUploader
  };

  const handleSendMessage = (content: string) => {
    sendMessageMutation.mutate({ 
      content,
      replyToId: replyToMessage?.id 
    });
    setReplyToMessage(null);
  };

  const handleReply = (message: MessageWithSender) => {
    setReplyToMessage(message);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!selectedConversationId) return;
    
    try {
      await apiRequest('POST', `/api/messages/${messageId}/reactions`, { emoji });
      queryClient.invalidateQueries({ queryKey: ['/api/messages', selectedConversationId] });
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleRemoveReaction = async (messageId: string) => {
    if (!selectedConversationId) return;
    
    try {
      await apiRequest('DELETE', `/api/messages/${messageId}/reactions`);
      queryClient.invalidateQueries({ queryKey: ['/api/messages', selectedConversationId] });
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  const getTypingUsersInConversation = () => {
    if (!selectedConversationId || !user) return [];
    const userIds = typingUsers.get(selectedConversationId);
    if (!userIds) return [];
    
    return Array.from(userIds)
      .filter(id => id !== user.id)
      .map(id => {
        const participant = selectedConversation?.participants.find(p => p.userId === id);
        return participant ? getUserDisplayName(participant.user) : 'Someone';
      });
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const otherParticipants = conv.participants.filter(p => p.userId !== user?.id);
    const name = conv.isGroup && conv.name 
      ? conv.name 
      : otherParticipants.length > 0 
        ? getUserDisplayName(otherParticipants[0].user)
        : '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="space-y-2 text-center">
          <MessageCircle className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Sidebar - Chat List */}
      <div className={`
        w-full md:w-96 border-r flex flex-col
        ${isMobileMenuOpen || !selectedConversationId ? 'flex' : 'hidden md:flex'}
      `}>
        {/* Sidebar Header */}
        <div className="h-16 border-b px-4 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10" data-testid="avatar-current-user">
              <AvatarImage src={user?.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
              <AvatarFallback>
                {user ? getUserDisplayName(user).substring(0, 2).toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold truncate" data-testid="text-user-name">
                {user ? getUserDisplayName(user) : 'User'}
              </h2>
              {user?.status && (
                <p className="text-xs text-muted-foreground truncate">{user.status}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <NewConversationDialog users={allUsers} onCreateConversation={createConversationMutation.mutate} />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              asChild
              data-testid="button-logout"
            >
              <a href="/api/logout">
                <LogOut className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="space-y-1 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a new conversation to begin chatting
              </p>
            </div>
          ) : (
            <div data-testid="conversations-list">
              {filteredConversations.map((conversation) => {
                const otherUserId = conversation.participants.find(p => p.userId !== user!.id)?.userId;
                const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
                
                return (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    currentUserId={user!.id}
                    isActive={conversation.id === selectedConversationId}
                    isOnline={!conversation.isGroup ? isOnline : undefined}
                    onClick={() => {
                      setSelectedConversationId(conversation.id);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className={`
        flex-1 flex flex-col
        ${selectedConversationId ? 'flex' : 'hidden md:flex'}
      `}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b px-4 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setIsMobileMenuOpen(true)}
                  data-testid="button-mobile-menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>

                <div className="relative flex-shrink-0">
                  <Avatar className="h-10 w-10" data-testid="avatar-conversation-header">
                    <AvatarImage 
                      src={
                        selectedConversation.avatarUrl || 
                        (!selectedConversation.isGroup && selectedConversation.participants.find(p => p.userId !== user?.id)?.user.profileImageUrl) || 
                        undefined
                      } 
                      style={{ objectFit: 'cover' }}
                    />
                    <AvatarFallback>
                      {selectedConversation.isGroup ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        getUserDisplayName(
                          selectedConversation.participants.find(p => p.userId !== user?.id)?.user || {}
                        ).substring(0, 2).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {!selectedConversation.isGroup && selectedConversation.participants.find(p => p.userId !== user?.id) && (
                    <OnlineStatus
                      isOnline={onlineUsers.has(selectedConversation.participants.find(p => p.userId !== user?.id)!.userId)}
                      className="absolute bottom-0 right-0"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold truncate" data-testid="text-conversation-header-name">
                    {selectedConversation.isGroup && selectedConversation.name
                      ? selectedConversation.name
                      : selectedConversation.participants.find(p => p.userId !== user?.id)
                        ? getUserDisplayName(selectedConversation.participants.find(p => p.userId !== user?.id)!.user)
                        : 'Unknown'}
                  </h2>
                  {selectedConversation.isGroup ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedConversation.participants.length} members
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground" data-testid="text-user-status">
                      {onlineUsers.has(selectedConversation.participants.find(p => p.userId !== user?.id)?.userId || '')
                        ? 'online'
                        : selectedConversation.participants.find(p => p.userId !== user?.id)?.user.lastSeen
                          ? `last seen ${formatLastSeen(selectedConversation.participants.find(p => p.userId !== user?.id)!.user.lastSeen!)}`
                          : 'offline'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" data-testid="button-voice-call">
                  <Phone className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" data-testid="button-video-call">
                  <Video className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" data-testid="button-conversation-menu">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                      <div className="space-y-2 flex-1 max-w-[65%]">
                        <Skeleton className="h-20 w-full rounded-2xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send a message to start the conversation
                  </p>
                </div>
              ) : (
                <div className="space-y-4" data-testid="messages-container">
                  {messages.map((message, index) => {
                    const prevMessage = messages[index - 1];
                    const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;
                    
                    const showDateSeparator = !prevMessage || 
                      new Date(message.createdAt!).toDateString() !== new Date(prevMessage.createdAt!).toDateString();
                    
                    return (
                      <div key={message.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4" data-testid={`date-separator-${message.id}`}>
                            <div className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                              {formatDateSeparator(message.createdAt!)}
                            </div>
                          </div>
                        )}
                        <ChatMessage
                          message={message}
                          isOwn={message.senderId === user?.id}
                          showAvatar={showAvatar}
                          isGroup={selectedConversation.isGroup}
                          currentUserId={user?.id || ''}
                          conversationId={selectedConversationId || ''}
                          onAddReaction={handleAddReaction}
                          onRemoveReaction={handleRemoveReaction}
                          onReply={handleReply}
                        />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Typing Indicator */}
            {getTypingUsersInConversation().length > 0 && (
              <TypingIndicator userNames={getTypingUsersInConversation()} />
            )}

            {/* Message Composer */}
            <MessageComposer
              onSendMessage={handleSendMessage}
              onAttachFile={handleFileUpload}
              onTyping={handleTyping}
              disabled={sendMessageMutation.isPending}
              replyToMessage={replyToMessage}
              onCancelReply={handleCancelReply}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageCircle className="h-20 w-20 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Select a conversation</h3>
            <p className="text-muted-foreground">
              Choose a conversation from the list to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// New Conversation Dialog Component
function NewConversationDialog({ users, onCreateConversation }: {
  users: User[];
  onCreateConversation: (data: { userIds: string[]; isGroup: boolean; name?: string }) => void;
}) {
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  const availableUsers = users.filter(u => u.id !== currentUser?.id);

  const handleCreate = () => {
    if (selectedUsers.length === 0) return;
    
    onCreateConversation({
      userIds: selectedUsers,
      isGroup: isGroup || selectedUsers.length > 1,
      name: isGroup && groupName ? groupName : undefined,
    });
    
    setOpen(false);
    setSelectedUsers([]);
    setGroupName("");
    setIsGroup(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-new-conversation">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Select users to start a conversation
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="group-toggle">Group Chat</Label>
            <Switch
              id="group-toggle"
              checked={isGroup}
              onCheckedChange={setIsGroup}
              data-testid="switch-group-chat"
            />
          </div>

          {isGroup && (
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                data-testid="input-group-name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Select Users</Label>
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-2 space-y-1">
                {availableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUsers(prev =>
                        prev.includes(user.id)
                          ? prev.filter(id => id !== user.id)
                          : [...prev, user.id]
                      );
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-md hover-elevate active-elevate-2 ${
                      selectedUsers.includes(user.id) ? 'bg-accent' : ''
                    }`}
                    data-testid={`user-select-${user.id}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                      <AvatarFallback>
                        {getUserDisplayName(user).substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{getUserDisplayName(user)}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Button
            onClick={handleCreate}
            disabled={selectedUsers.length === 0}
            className="w-full"
            data-testid="button-create-conversation"
          >
            Create Conversation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
