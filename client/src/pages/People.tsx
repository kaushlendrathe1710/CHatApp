import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, MessageCircle, Users as UsersIcon, Shield, ShieldCheck, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getUserDisplayName, formatLastSeen } from "@/lib/formatters";
import type { User } from "@shared/schema";

export default function People() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Check if user is admin (admin or super_admin can see all users)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Fetch all users (only for admins, and only when not searching)
  const { data: allUsers = [], isLoading: isLoadingAll } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isAdmin && !debouncedSearch,
  });

  // Search users by username
  const { data: searchResults = [], isLoading: isSearching } = useQuery<User[]>({
    queryKey: ['/api/users/search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedSearch)}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: !!debouncedSearch,
  });

  // Use search results if searching, otherwise show all users (for admins only)
  const displayedUsers = debouncedSearch ? searchResults : (isAdmin ? allUsers : []);
  const isLoading = debouncedSearch ? isSearching : isLoadingAll;

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

  const handleStartChat = (userId: string) => {
    createConversationMutation.mutate(userId);
  };


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
              {searchQuery ? "Search Results" : "All People"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {searchQuery 
                ? `Found ${displayedUsers.length} ${displayedUsers.length === 1 ? 'person' : 'people'}`
                : `Connect with ${displayedUsers.length} ${displayedUsers.length === 1 ? 'person' : 'people'}`
              }
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username (e.g., @john123)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
          {isLoading && searchQuery && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* User Grid */}
        {isLoading && !searchQuery ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : displayedUsers.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-2">
              <Search className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                {searchQuery ? "No people found" : "Search for people"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery 
                  ? "Try adjusting your search" 
                  : "Type a username to find people and start chatting"}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedUsers.map((user) => (
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
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className="font-semibold truncate"
                          data-testid={`text-username-${user.id}`}
                        >
                          {getUserDisplayName(user)}
                        </h3>
                        {user.role === 'super_admin' && (
                          <Badge variant="default" className="flex-shrink-0" data-testid={`badge-role-${user.id}`}>
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Super Admin
                          </Badge>
                        )}
                        {user.role === 'admin' && (
                          <Badge variant="secondary" className="flex-shrink-0" data-testid={`badge-role-${user.id}`}>
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
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
