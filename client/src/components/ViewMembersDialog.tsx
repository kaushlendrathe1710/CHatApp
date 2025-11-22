import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, User } from "lucide-react";

interface Participant {
  conversationId: string;
  userId: string;
  role: "admin" | "member" | "subscriber";
  user: {
    id: string;
    email: string;
    username: string;
    avatarUrl?: string | null;
    role?: "user" | "admin" | "super_admin";
  };
}

interface ViewMembersDialogProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onlineUserIds: string[];
}

export function ViewMembersDialog({
  conversationId,
  open,
  onOpenChange,
  onlineUserIds,
}: ViewMembersDialogProps) {
  const { data: participants = [], isLoading } = useQuery<Participant[]>({
    queryKey: ["/api/conversations", conversationId, "participants"],
    enabled: open && !!conversationId,
  });

  const getInitials = (username: string) => {
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isOnline = (userId: string) => onlineUserIds.includes(userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-view-members">
        <DialogHeader>
          <DialogTitle>
            Group Members ({participants.length})
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          <div className="space-y-2">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                  data-testid={`member-item-${participant.userId}`}
                >
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={participant.user.avatarUrl || undefined} />
                      <AvatarFallback>
                        {getInitials(participant.user.username)}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline(participant.userId) && (
                      <div
                        className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background"
                        data-testid={`status-online-${participant.userId}`}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="text-sm font-medium truncate" data-testid={`text-username-${participant.userId}`}>
                        {participant.user.username}
                      </p>
                      {participant.role === "admin" && (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-xs"
                          data-testid={`badge-group-admin-${participant.userId}`}
                        >
                          <Crown className="h-3 w-3" />
                          Group Admin
                        </Badge>
                      )}
                      {participant.user.role === "super_admin" && (
                        <Badge
                          variant="default"
                          className="gap-1 text-xs"
                          data-testid={`badge-super-admin-${participant.userId}`}
                        >
                          <Crown className="h-3 w-3" />
                          Super Admin
                        </Badge>
                      )}
                      {participant.user.role === "admin" && (
                        <Badge
                          variant="default"
                          className="gap-1 text-xs"
                          data-testid={`badge-system-admin-${participant.userId}`}
                        >
                          <Crown className="h-3 w-3" />
                          System Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate" data-testid={`text-email-${participant.userId}`}>
                      {participant.user.email}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
