import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserDisplayName } from "@/lib/formatters";
import type { ConversationWithDetails } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  conversations: ConversationWithDetails[];
  currentConversationId: string;
  currentUserId: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  messageId,
  conversations,
  currentConversationId,
  currentUserId,
}: ForwardMessageDialogProps) {
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [isForwarding, setIsForwarding] = useState(false);
  const { toast } = useToast();

  const availableConversations = conversations.filter(
    (conv) => conv.id !== currentConversationId
  );

  const toggleConversation = (conversationId: string) => {
    setSelectedConversations((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const handleForward = async () => {
    if (selectedConversations.length === 0) {
      toast({
        title: "No conversations selected",
        description: "Please select at least one conversation to forward to",
        variant: "destructive",
      });
      return;
    }

    setIsForwarding(true);
    try {
      await apiRequest('POST', `/api/messages/${messageId}/forward`, {
        conversationIds: selectedConversations,
      });

      toast({
        title: "Message forwarded",
        description: `Forwarded to ${selectedConversations.length} conversation${selectedConversations.length > 1 ? 's' : ''}`,
      });

      selectedConversations.forEach((convId) => {
        queryClient.invalidateQueries({ queryKey: ['/api/messages', convId] });
      });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });

      setSelectedConversations([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Error forwarding message:", error);
      toast({
        title: "Failed to forward message",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-forward-message">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-96">
          <div className="space-y-1">
            {availableConversations.length === 0 ? (
              <p className="text-sm text-secondary py-4 text-center" data-testid="text-no-conversations">
                No other conversations available
              </p>
            ) : (
              availableConversations.map((conv) => {
                const isSelected = selectedConversations.includes(conv.id);
                const otherParticipant = conv.participants.find(
                  (p) => p.userId !== currentUserId
                );
                const displayName = conv.isGroup
                  ? (conv.name || `Group (${conv.participants.length} members)`)
                  : (otherParticipant?.user ? getUserDisplayName(otherParticipant.user) : 'Unknown');

                return (
                  <div
                    key={conv.id}
                    className="flex items-center gap-3 p-3 rounded-md hover-elevate active-elevate-2 cursor-pointer"
                    onClick={() => toggleConversation(conv.id)}
                    data-testid={`conversation-item-${conv.id}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        toggleConversation(conv.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-conversation-${conv.id}`}
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={otherParticipant?.user?.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {displayName?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      {conv.isGroup && (
                        <p className="text-xs text-secondary truncate">
                          {conv.participants.length} members
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" data-testid={`icon-selected-${conv.id}`} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedConversations([]);
              onOpenChange(false);
            }}
            disabled={isForwarding}
            data-testid="button-cancel-forward"
          >
            Cancel
          </Button>
          <Button
            onClick={handleForward}
            disabled={selectedConversations.length === 0 || isForwarding}
            data-testid="button-confirm-forward"
          >
            {isForwarding ? "Forwarding..." : `Forward${selectedConversations.length > 0 ? ` (${selectedConversations.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
