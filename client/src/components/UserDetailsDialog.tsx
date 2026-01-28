import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Video, MessageCircle, Shield, ShieldCheck, Mail, AtSign, Clock } from "lucide-react";
import { formatLastSeen, getUserDisplayName } from "@/lib/formatters";
import { OnlineStatus } from "./OnlineStatus";
import type { User } from "@shared/schema";

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  isOnline?: boolean;
  onStartCall?: (type: "audio" | "video") => void;
  onStartChat?: () => void;
}

export function UserDetailsDialog({
  open,
  onOpenChange,
  user,
  isOnline = false,
  onStartCall,
  onStartChat,
}: UserDetailsDialogProps) {
  const displayName = getUserDisplayName(user);
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-user-details">
        <DialogHeader>
          <DialogTitle>Contact Info</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar and Name */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative">
              <Avatar className="h-24 w-24" data-testid="avatar-user-details">
                <AvatarImage
                  src={user.profileImageUrl || undefined}
                  style={{ objectFit: "cover" }}
                />
                <AvatarFallback className="text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <OnlineStatus
                isOnline={isOnline}
                size="lg"
                className="absolute bottom-1 right-1"
              />
            </div>
            <div>
              <h2 className="text-2xl font-semibold" data-testid="text-user-name">
                {displayName}
              </h2>
              {user.role && (user.role === 'admin' || user.role === 'super_admin') && (
                <div className="flex justify-center mt-2">
                  {user.role === 'super_admin' && (
                    <Badge variant="default" data-testid="badge-role">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Super Admin
                    </Badge>
                  )}
                  {user.role === 'admin' && (
                    <Badge variant="secondary" data-testid="badge-role">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          {user.status && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-sm" data-testid="text-status">
                {user.status}
              </p>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-3">
            {user.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm truncate" data-testid="text-email">
                    {user.email}
                  </p>
                </div>
              </div>
            )}

            {user.username && (
              <div className="flex items-center gap-3">
                <AtSign className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="text-sm truncate" data-testid="text-username">
                    @{user.username}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-sm" data-testid="text-online-status">
                  {isOnline ? "online" : user.lastSeen ? `last seen ${formatLastSeen(user.lastSeen)}` : "offline"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {onStartChat && (
              <Button
                onClick={() => {
                  onStartChat();
                  onOpenChange(false);
                }}
                className="flex-1"
                data-testid="button-start-chat"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Message
              </Button>
            )}
            {onStartCall && (
              <>
                <Button
                  onClick={() => {
                    onStartCall("audio");
                    onOpenChange(false);
                  }}
                  variant="outline"
                  size="icon"
                  data-testid="button-voice-call"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => {
                    onStartCall("video");
                    onOpenChange(false);
                  }}
                  variant="outline"
                  size="icon"
                  data-testid="button-video-call"
                >
                  <Video className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
