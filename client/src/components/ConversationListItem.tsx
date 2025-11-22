import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { OnlineStatus } from "@/components/OnlineStatus";
import { formatChatListTime, getUserDisplayName } from "@/lib/formatters";
import type { ConversationWithDetails } from "@shared/schema";
import { Users, Image as ImageIcon, Paperclip, Shield, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationListItemProps {
  conversation: ConversationWithDetails;
  currentUserId: string;
  isActive?: boolean;
  onClick?: () => void;
  isOnline?: boolean;
}

export function ConversationListItem({
  conversation,
  currentUserId,
  isActive,
  onClick,
  isOnline
}: ConversationListItemProps) {
  const otherParticipants = conversation.participants.filter(
    p => p.userId !== currentUserId
  );

  const getConversationName = () => {
    if ((conversation.isGroup || conversation.isBroadcast) && conversation.name) {
      return conversation.name;
    }
    if (otherParticipants.length > 0) {
      return getUserDisplayName(otherParticipants[0].user);
    }
    return 'Unknown';
  };

  const getConversationAvatar = () => {
    if (conversation.avatarUrl) {
      return conversation.avatarUrl;
    }
    if (!conversation.isGroup && otherParticipants.length > 0) {
      return otherParticipants[0].user.profileImageUrl || undefined;
    }
    return undefined;
  };

  const getInitials = () => {
    const name = getConversationName();
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getLastMessagePreview = () => {
    if (!conversation.lastMessage) {
      return { type: 'text', content: 'No messages yet' };
    }
    
    const msg = conversation.lastMessage;
    if (msg.type === 'image') {
      return { type: 'image', content: 'Photo' };
    }
    if (msg.type === 'file') {
      return { type: 'file', content: msg.fileName || 'File' };
    }
    return { type: 'text', content: msg.content || '' };
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-4 hover-elevate active-elevate-2 transition-colors text-left border-b border-border",
        isActive && "bg-accent"
      )}
      data-testid={`conversation-item-${conversation.id}`}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12" data-testid="avatar-conversation">
          <AvatarImage src={getConversationAvatar()} style={{ objectFit: 'cover' }} />
          <AvatarFallback>
            {conversation.isGroup ? (
              <Users className="h-5 w-5" />
            ) : (
              getInitials()
            )}
          </AvatarFallback>
        </Avatar>
        {!conversation.isGroup && isOnline !== undefined && (
          <OnlineStatus
            isOnline={isOnline}
            size="sm"
            className="absolute bottom-0 right-0"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="font-medium truncate" data-testid="text-conversation-name">
              {getConversationName()}
            </h3>
            {!conversation.isGroup && !conversation.isBroadcast && otherParticipants.length > 0 && (
              <>
                {otherParticipants[0].user.role === 'super_admin' && (
                  <Badge variant="default" className="flex-shrink-0 text-xs px-1 py-0 h-4">
                    <ShieldCheck className="h-2.5 w-2.5" />
                  </Badge>
                )}
                {otherParticipants[0].user.role === 'admin' && (
                  <Badge variant="secondary" className="flex-shrink-0 text-xs px-1 py-0 h-4">
                    <Shield className="h-2.5 w-2.5" />
                  </Badge>
                )}
              </>
            )}
          </div>
          {conversation.lastMessage && (
            <span className="text-xs text-muted-foreground flex-shrink-0" data-testid="text-last-message-time">
              {formatChatListTime(conversation.lastMessage.createdAt!)}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground truncate min-w-0" data-testid="text-last-message">
            {(() => {
              const preview = getLastMessagePreview();
              if (preview.type === 'image') {
                return (
                  <>
                    <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{preview.content}</span>
                  </>
                );
              }
              if (preview.type === 'file') {
                return (
                  <>
                    <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{preview.content}</span>
                  </>
                );
              }
              return <span className="truncate">{preview.content}</span>;
            })()}
          </div>
          
          {conversation.unreadCount !== undefined && conversation.unreadCount > 0 && (
            <Badge 
              variant="default" 
              className="flex-shrink-0 h-5 min-w-[20px] px-1.5 rounded-full"
              data-testid="badge-unread-count"
            >
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
