import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, MessageCircle, Users as UsersIcon } from "lucide-react";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getUserDisplayName, formatLastSeen } from "@/lib/formatters";
import { OnlineStatus } from "@/components/OnlineStatus";
import type { User } from "@shared/schema";

export default function People() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all users
  const { data: users = [], isLoading, isError, error } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Get current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", "/api/conversations", {
        userIds: [userId],
        isGroup: false,
      });
      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }
      return response.json();
    },
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setLocation("/dashboard");
      toast({
        title: "Chat started",
        description: "You can now send messages",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    const displayName = getUserDisplayName(user);
    const email = user.email || "";
    const username = user.username || "";
    const query = searchQuery.toLowerCase();
    
    return (
      displayName.toLowerCase().includes(query) ||
      email.toLowerCase().includes(query) ||
      username.toLowerCase().includes(query)
    );
  });

  const handleStartChat = (userId: string) => {
    createConversationMutation.mutate(userId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <UsersIcon className="h-6 w-6" />
                All People
              </h1>
            </div>
          </div>
          <Card className="p-12">
            <div className="text-center space-y-2">
              <UsersIcon className="h-12 w-12 mx-auto text-destructive" />
              <h3 className="text-lg font-semibold">Failed to load people</h3>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "An error occurred while loading users"}
              </p>
              <Button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/users'] })}
                data-testid="button-retry"
              >
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex flex-wrap items-center gap-2">
              <UsersIcon className="h-6 w-6" />
              All People
            </h1>
            <p className="text-sm text-muted-foreground">
              Connect with {filteredUsers.length} {filteredUsers.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>

        {/* User Grid */}
        {filteredUsers.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-2">
              <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-semibold">No people found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "Try adjusting your search" : "No users available"}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <Card
                key={user.id}
                className="hover-elevate overflow-visible"
                data-testid={`card-user-${user.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-start gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {getUserDisplayName(user).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <OnlineStatus userId={user.id} className="absolute -bottom-1 -right-1" />
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <h3
                        className="font-semibold truncate"
                        data-testid={`text-username-${user.id}`}
                      >
                        {getUserDisplayName(user)}
                      </h3>
                      {user.username && (
                        <p
                          className="text-sm text-muted-foreground truncate"
                          data-testid={`text-handle-${user.id}`}
                        >
                          @{user.username}
                        </p>
                      )}
                      {user.status && (
                        <p
                          className="text-xs text-muted-foreground truncate"
                          data-testid={`text-status-${user.id}`}
                        >
                          {user.status}
                        </p>
                      )}
                      {user.lastSeen && (
                        <p
                          className="text-xs text-muted-foreground"
                          data-testid={`text-lastseen-${user.id}`}
                        >
                          {formatLastSeen(user.lastSeen)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    className="w-full mt-4"
                    variant="default"
                    onClick={() => handleStartChat(user.id)}
                    disabled={createConversationMutation.isPending}
                    data-testid={`button-start-chat-${user.id}`}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {createConversationMutation.isPending ? "Starting..." : "Start Chat"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
