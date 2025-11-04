import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMessageTime, getUserDisplayName } from "@/lib/formatters";
import type { MessageWithSender } from "@shared/schema";
import { Check, CheckCheck, Download, FileText, Image as ImageIcon, Reply, Edit2, MoreVertical, X, Forward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageReactions } from "@/components/MessageReactions";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatMessageProps {
  message: MessageWithSender;
  isOwn: boolean;
  showAvatar?: boolean;
  isGroup?: boolean;
  currentUserId: string;
  conversationId: string;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onRemoveReaction?: (messageId: string) => void;
  onReply?: (message: MessageWithSender) => void;
  onEdit?: (message: MessageWithSender) => void;
  onForward?: (message: MessageWithSender) => void;
  isEditing?: boolean;
  editContent?: string;
  onEditContentChange?: (content: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}

export function ChatMessage({ 
  message, 
  isOwn, 
  showAvatar = true, 
  isGroup = false,
  currentUserId,
  conversationId,
  onAddReaction,
  onRemoveReaction,
  onReply,
  onEdit,
  onForward,
  isEditing = false,
  editContent = '',
  onEditContentChange,
  onSaveEdit,
  onCancelEdit
}: ChatMessageProps) {
  const senderName = getUserDisplayName(message.sender);
  const initials = senderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const renderForwardedFromBadge = () => {
    if (!message.forwardedFromUser) return null;
    
    const forwardedName = getUserDisplayName(message.forwardedFromUser);
    return (
      <div className="text-xs text-muted-foreground italic mb-1" data-testid={`text-forwarded-from-${message.id}`}>
        <Forward className="h-3 w-3 inline mr-1" />
        Forwarded from {forwardedName}
      </div>
    );
  };

  const renderMessageContent = () => {
    // If editing, show textarea
    if (isEditing && message.type === 'text') {
      return (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => onEditContentChange?.(e.target.value)}
            className="min-h-[60px] resize-none"
            data-testid={`input-edit-message-${message.id}`}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelEdit}
              data-testid={`button-cancel-edit-${message.id}`}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSaveEdit}
              data-testid={`button-save-edit-${message.id}`}
            >
              Save
            </Button>
          </div>
        </div>
      );
    }
    
    // Regular message rendering
    if (message.type === 'image' && message.fileUrl) {
      return (
        <div className="space-y-2">
          <div className="rounded-md overflow-hidden max-w-sm">
            <img 
              src={message.fileUrl} 
              alt={message.fileName || 'Shared image'} 
              className="w-full h-auto max-h-96 object-cover"
              data-testid={`img-message-${message.id}`}
            />
          </div>
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
      );
    }

    if (message.type === 'file' && message.fileUrl) {
      return (
        <div className="space-y-2">
          <div className={`flex items-center gap-3 p-3 rounded-md ${
            isOwn ? 'bg-primary/10' : 'bg-muted'
          }`}>
            <div className={`p-2 rounded-md ${isOwn ? 'bg-primary/20' : 'bg-background'}`}>
              <FileText className="h-5 w-5" data-testid={`icon-file-${message.id}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.fileName || 'File'}</p>
              {message.fileSize && (
                <p className="text-xs text-muted-foreground">
                  {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            <Button 
              size="icon" 
              variant="ghost"
              className="flex-shrink-0"
              asChild
              data-testid={`button-download-${message.id}`}
            >
              <a href={message.fileUrl} download={message.fileName} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
      );
    }

    return (
      <p className="text-sm whitespace-pre-wrap break-words" data-testid={`text-message-${message.id}`}>
        {message.content}
      </p>
    );
  };

  const renderStatusIcon = () => {
    if (!isOwn) return null;

    if (message.status === 'read') {
      return <CheckCheck className="h-4 w-4 text-primary" data-testid="icon-read" />;
    }
    if (message.status === 'delivered') {
      return <CheckCheck className="h-4 w-4" data-testid="icon-delivered" />;
    }
    return <Check className="h-4 w-4" data-testid="icon-sent" />;
  };

  return (
    <div 
      className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end`}
      data-testid={`message-${message.id}`}
    >
      {showAvatar && !isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0" data-testid={`avatar-${message.senderId}`}>
          <AvatarImage src={message.sender.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      )}
      {showAvatar && isOwn && <div className="h-8 w-8 flex-shrink-0" />}
      
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[65%] gap-1`}>
        {isGroup && !isOwn && showAvatar && (
          <span className="text-xs font-medium px-3 text-muted-foreground" data-testid="text-sender-name">
            {senderName}
          </span>
        )}
        
        <div
          className={`group rounded-2xl px-3 py-2 ${
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-card-border rounded-bl-sm'
          }`}
        >
          {renderForwardedFromBadge()}
          {renderMessageContent()}
          
          <div className={`flex items-center gap-1 mt-1 justify-end ${
            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`}>
            {message.isEdited && (
              <span className="text-xs italic" data-testid="text-edited-indicator">
                edited
              </span>
            )}
            <span className="text-xs" data-testid="text-message-time">
              {formatMessageTime(message.createdAt!)}
            </span>
            {renderStatusIcon()}
          </div>
        </div>
        
        {/* Message Actions Menu (visible on hover) */}
        {!isEditing && (onReply || onForward || (onEdit && isOwn)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                data-testid={`button-message-menu-${message.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? "end" : "start"}>
              {onReply && (
                <DropdownMenuItem onClick={() => onReply(message)} data-testid={`menu-reply-${message.id}`}>
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </DropdownMenuItem>
              )}
              {onForward && (
                <DropdownMenuItem onClick={() => onForward(message)} data-testid={`menu-forward-${message.id}`}>
                  <Forward className="h-4 w-4 mr-2" />
                  Forward
                </DropdownMenuItem>
              )}
              {onEdit && isOwn && message.type === 'text' && (
                <DropdownMenuItem onClick={() => onEdit(message)} data-testid={`menu-edit-${message.id}`}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* Reactions */}
        <MessageReactions
          messageId={message.id}
          conversationId={conversationId}
          reactions={message.reactions || []}
          currentUserId={currentUserId}
          onAddReaction={(emoji) => onAddReaction?.(message.id, emoji)}
          onRemoveReaction={() => onRemoveReaction?.(message.id)}
        />
      </div>
    </div>
  );
}
