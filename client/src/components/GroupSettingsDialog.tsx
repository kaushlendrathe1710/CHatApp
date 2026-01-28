import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, MoreVertical, UserPlus, Crown, UserMinus, Pencil, Check, X } from "lucide-react";
import type { User, ConversationParticipant, Conversation } from "@shared/schema";

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  isAdmin: boolean;
  currentUserId: string;
}

type ParticipantWithUser = ConversationParticipant & { user: User };

export function GroupSettingsDialog({ 
  open, 
  onOpenChange, 
  conversationId,
  isAdmin,
  currentUserId,
}: GroupSettingsDialogProps) {
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const { toast } = useToast();

  // Fetch conversation details for current name
  const { data: conversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", conversationId],
    enabled: open,
  });

  // Fetch group participants
  const { data: participants = [], isLoading: isLoadingParticipants } = useQuery<ParticipantWithUser[]>({
    queryKey: ["/api/conversations", conversationId, "participants"],
    enabled: open,
  });

  // Fetch all users for adding new participants
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: showAddParticipant,
  });

  // Filter out users who are already participants
  const availableUsers = allUsers.filter(
    (user) => !participants.some((p) => p.userId === user.id)
  );

  const handleAddParticipant = async (userId: string) => {
    try {
      await apiRequest("POST", `/api/conversations/${conversationId}/participants`, {
        userId,
        role: "member",
      });

      toast({
        title: "Participant added",
        description: "User has been added to the group",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setShowAddParticipant(false);
    } catch (error: any) {
      console.error("Error adding participant:", error);
      toast({
        title: "Failed to add participant",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    try {
      await apiRequest("DELETE", `/api/conversations/${conversationId}/participants/${userId}`);

      toast({
        title: "Participant removed",
        description: "User has been removed from the group",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch (error: any) {
      console.error("Error removing participant:", error);
      toast({
        title: "Failed to remove participant",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    try {
      await apiRequest("PATCH", `/api/conversations/${conversationId}/participants/${userId}/role`, {
        role: "admin",
      });

      toast({
        title: "Promoted to admin",
        description: "User is now a group admin",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "participants"] });
    } catch (error: any) {
      console.error("Error promoting participant:", error);
      toast({
        title: "Failed to promote participant",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDemoteToMember = async (userId: string) => {
    try {
      await apiRequest("PATCH", `/api/conversations/${conversationId}/participants/${userId}/role`, {
        role: "member",
      });

      toast({
        title: "Demoted to member",
        description: "User is now a group member",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "participants"] });
    } catch (error: any) {
      console.error("Error demoting participant:", error);
      toast({
        title: "Failed to demote participant",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => {
      return await apiRequest("PATCH", `/api/conversations/${conversationId}/name`, { name: newName });
    },
    onSuccess: () => {
      toast({
        title: "Group renamed",
        description: "Group name has been updated",
      });
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
    },
    onError: (error: any) => {
      console.error("Error renaming group:", error);
      toast({
        title: "Failed to rename group",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = () => {
    setEditedName(conversation?.name || "");
    setIsEditingName(true);
  };

  const handleSaveRename = () => {
    if (editedName.trim().length === 0) {
      toast({
        title: "Invalid name",
        description: "Group name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    renameMutation.mutate(editedName.trim());
  };

  const handleCancelRename = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  const getInitials = (user: User) => {
    if (user.fullName) {
      return user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const getUserDisplay = (user: User) => {
    return user.fullName || user.username || user.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-group-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Group Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Name Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Group Name</h3>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter group name"
                  disabled={renameMutation.isPending}
                  data-testid="input-group-name"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveRename();
                    } else if (e.key === "Escape") {
                      handleCancelRename();
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSaveRename}
                  disabled={renameMutation.isPending}
                  data-testid="button-save-group-name"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelRename}
                  disabled={renameMutation.isPending}
                  data-testid="button-cancel-group-name"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 p-2 rounded-md border">
                <span className="text-sm" data-testid="text-group-name">
                  {conversation?.name || "Unnamed Group"}
                </span>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleStartEdit}
                    data-testid="button-edit-group-name"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Participants Section */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Participants ({participants.length})
            </h3>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddParticipant(!showAddParticipant)}
                data-testid="button-toggle-add-participant"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {showAddParticipant && isAdmin && (
            <ScrollArea className="h-32 rounded-md border">
              {availableUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No users available to add
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                      onClick={() => handleAddParticipant(user.id)}
                      data-testid={`add-user-item-${user.id}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback>{getInitials(user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getUserDisplay(user)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          <ScrollArea className="h-64 rounded-md border">
            {isLoadingParticipants ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading participants...
              </div>
            ) : participants.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No participants
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-2 rounded-md"
                    data-testid={`participant-item-${participant.userId}`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={participant.user.profileImageUrl || undefined} />
                      <AvatarFallback>{getInitials(participant.user)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getUserDisplay(participant.user)}
                        {participant.userId === currentUserId && (
                          <span className="text-muted-foreground"> (You)</span>
                        )}
                      </p>
                      {participant.user.username && participant.user.fullName && (
                        <p className="text-xs text-muted-foreground truncate">
                          @{participant.user.username}
                        </p>
                      )}
                    </div>
                    {participant.role === "admin" && (
                      <Badge variant="secondary" className="text-xs">
                        <Crown className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                    {isAdmin && participant.userId !== currentUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            data-testid={`button-participant-menu-${participant.userId}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {participant.role === "member" ? (
                            <DropdownMenuItem
                              onClick={() => handlePromoteToAdmin(participant.userId)}
                              data-testid={`button-promote-${participant.userId}`}
                            >
                              <Crown className="h-4 w-4 mr-2" />
                              Make Admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleDemoteToMember(participant.userId)}
                              data-testid={`button-demote-${participant.userId}`}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove Admin
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleRemoveParticipant(participant.userId)}
                            className="text-destructive"
                            data-testid={`button-remove-${participant.userId}`}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Remove from Group
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-group-settings"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
