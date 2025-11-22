import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMessageTime, getUserDisplayName } from "@/lib/formatters";
import { decryptMessage } from "@/lib/encryption";
import type { MessageWithSender } from "@shared/schema";
import { Check, CheckCheck, Download, FileText, Image as ImageIcon, Reply, Edit2, MoreVertical, X, Forward, Clock, Shield, ShieldAlert, Copy, Trash2, CheckSquare, Square } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { MessageReactions } from "@/components/MessageReactions";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilePreview } from "./FilePreview";
import { useToast } from "@/hooks/use-toast";

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
  onDelete?: (message: MessageWithSender) => void;
  isEditing?: boolean;
  editContent?: string;
  onEditContentChange?: (content: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onEnterSelectionMode?: () => void;
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
  onDelete,
  isEditing = false,
  editContent = '',
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onEnterSelectionMode
}: ChatMessageProps) {
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decryptionError, setDecryptionError] = useState(false);
  const senderName = getUserDisplayName(message.sender);
  const initials = senderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const { toast } = useToast();

  const handleCopyMessage = async () => {
    const textToCopy = message.isEncrypted && decryptedContent 
      ? decryptedContent 
      : message.content || '';
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        description: "Message copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast({
        description: "Failed to copy message",
        variant: "destructive",
      });
    }
  };

  // Decrypt message if encrypted
  useEffect(() => {
    const decrypt = async () => {
      if (message.isEncrypted && message.content) {
        try {
          const decrypted = await decryptMessage(message.content);
          setDecryptedContent(decrypted);
          setDecryptionError(false);
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          setDecryptedContent(null);
          setDecryptionError(true);
        }
      } else {
        setDecryptedContent(null);
        setDecryptionError(false);
      }
    };

    decrypt();
  }, [message.content, message.isEncrypted]);

  const getExpirationText = () => {
    if (!message.expiresAt) return null;
    
    const expiresAt = new Date(message.expiresAt);
    const now = new Date();
    
    if (expiresAt <= now) {
      return "Expired";
    }
    
    try {
      return `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`;
    } catch (error) {
      return null;
    }
  };

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

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;
    
    const repliedToName = getUserDisplayName(message.replyTo.sender);
    const repliedContent = message.replyTo.content || 
      (message.replyTo.type === 'image' ? 'Photo' :
       message.replyTo.type === 'video' ? 'Video' :
       message.replyTo.type === 'audio' ? 'Audio' :
       message.replyTo.type === 'file' ? 'File' : 'Message');
    
    return (
      <div className={`mb-2 pl-3 border-l-4 py-1 ${
        isOwn 
          ? 'border-primary-foreground/30 bg-primary-foreground/10' 
          : 'border-primary/30 bg-primary/10'
      }`} data-testid={`reply-preview-${message.id}`}>
        <p className={`text-xs font-semibold ${
          isOwn ? 'text-primary-foreground' : 'text-primary'
        }`}>
          {repliedToName}
        </p>
        <p className={`text-xs truncate ${
          isOwn ? 'text-primary-foreground/80' : 'text-foreground/80'
        }`}>
          {repliedContent}
        </p>
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
    // Handle file attachments (images, videos, documents, audio)
    if ((message.type === 'image' || message.type === 'video' || message.type === 'document' || message.type === 'audio' || message.type === 'file') && message.fileUrl) {
      const fileType = message.type === 'file' ? 'document' : message.type;
      return (
        <div className="space-y-2">
          <FilePreview
            fileUrl={message.fileUrl}
            fileName={message.fileName || 'File'}
            fileSize={message.fileSize || undefined}
            mimeType={message.mimeType || 'application/octet-stream'}
            type={fileType as 'image' | 'video' | 'document' | 'audio' | 'text'}
            showDownload={true}
          />
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
      );
    }

    // Handle encrypted messages
    if (message.isEncrypted) {
      if (decryptionError) {
        return (
          <div className="flex items-center gap-2 text-destructive" data-testid={`text-decryption-error-${message.id}`}>
            <ShieldAlert className="h-4 w-4" />
            <span className="text-sm">Unable to decrypt message</span>
          </div>
        );
      }
      
      if (!decryptedContent) {
        return (
          <div className="flex items-center gap-2 text-muted-foreground" data-testid={`text-decrypting-${message.id}`}>
            <Shield className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Decrypting...</span>
          </div>
        );
      }
      
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Encrypted</span>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words" data-testid={`text-message-${message.id}`}>
            {decryptedContent}
          </p>
        </div>
      );
    }

    // Plain text message
    return (
      <p className="text-sm whitespace-pre-wrap break-words" data-testid={`text-message-${message.id}`}>
        {message.content}
      </p>
    );
  };

  const renderStatusIcon = () => {
    if (!isOwn) return null;

    if (message.status === 'read') {
      return <CheckCheck className="h-4 w-4 text-status-online" data-testid="icon-read" />;
    }
    if (message.status === 'delivered') {
      return <CheckCheck className="h-4 w-4 text-muted-foreground" data-testid="icon-delivered" />;
    }
    return <Check className="h-4 w-4 text-muted-foreground" data-testid="icon-sent" />;
  };

  return (
    <div 
      className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end`}
      data-testid={`message-${message.id}`}
      onClick={() => isSelectionMode && onToggleSelect && onToggleSelect()}
    >
      {/* Checkbox for selection mode */}
      {isSelectionMode && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect && onToggleSelect();
          }}
          data-testid={`checkbox-select-${message.id}`}
        >
          {isSelected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5" />
          )}
        </Button>
      )}
      
      {/* Avatar (show only when not in selection mode) */}
      {!isSelectionMode && showAvatar && !isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0" data-testid={`avatar-${message.senderId}`}>
          <AvatarImage src={message.sender.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      )}
      {!isSelectionMode && showAvatar && isOwn && <div className="h-8 w-8 flex-shrink-0" />}
      
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
          {renderReplyPreview()}
          {renderMessageContent()}
          
          <div className={`flex flex-col gap-0.5 mt-1`}>
            <div className={`flex items-center gap-1 justify-end ${
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
            {getExpirationText() && (
              <div className={`flex items-center gap-1 justify-end ${
                isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground/80'
              }`}>
                <Clock className="h-3 w-3" />
                <span className="text-xs" data-testid={`text-expiration-${message.id}`}>
                  {getExpirationText()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Message Actions Menu (visible on hover) */}
        {!isEditing && (onReply || onForward || (onEdit && isOwn) || (onDelete && isOwn) || message.content) && (
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
              {onEnterSelectionMode && !isSelectionMode && (
                <DropdownMenuItem onClick={() => onEnterSelectionMode()} data-testid={`menu-select-${message.id}`}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select
                </DropdownMenuItem>
              )}
              {message.content && (
                <DropdownMenuItem onClick={handleCopyMessage} data-testid={`menu-copy-${message.id}`}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </DropdownMenuItem>
              )}
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
              {onDelete && isOwn && (
                <DropdownMenuItem onClick={() => onDelete(message)} className="text-destructive" data-testid={`menu-delete-${message.id}`}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
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
