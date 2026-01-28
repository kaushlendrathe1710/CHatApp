import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus } from "lucide-react";
import type { MessageReactionWithUser } from "@shared/schema";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";

interface MessageReactionsProps {
  messageId: string;
  conversationId: string;
  reactions: MessageReactionWithUser[];
  currentUserId: string;
  onAddReaction: (emoji: string) => void;
  onRemoveReaction: () => void;
}

export function MessageReactions({
  messageId,
  conversationId,
  reactions,
  currentUserId,
  onAddReaction,
  onRemoveReaction,
}: MessageReactionsProps) {
  const { theme: currentTheme } = useTheme();

  const reactionGroups = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReactionWithUser[]>);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onAddReaction(emojiData.emoji);
  };

  const handleReactionClick = (emoji: string) => {
    const hasReacted = reactions.some(
      r => r.emoji === emoji && r.userId === currentUserId
    );
    if (hasReacted) {
      onRemoveReaction();
    } else {
      onAddReaction(emoji);
    }
  };

  if (reactions.length === 0) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`button-add-reaction-${messageId}`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0" align="start">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={(currentTheme === "dark" ? Theme.DARK : Theme.LIGHT) as Theme}
              searchPlaceholder="Search emoji..."
              width={320}
              height={400}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {Object.entries(reactionGroups).map(([emoji, reactionList]) => {
        const hasReacted = reactionList.some(r => r.userId === currentUserId);
        const count = reactionList.length;
        
        return (
          <Button
            key={emoji}
            variant={hasReacted ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 text-xs gap-1 no-default-hover-elevate no-default-active-elevate"
            onClick={() => handleReactionClick(emoji)}
            data-testid={`reaction-${messageId}-${emoji}`}
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </Button>
        );
      })}
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            data-testid={`button-add-reaction-${messageId}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-0" align="start">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={(currentTheme === "dark" ? Theme.DARK : Theme.LIGHT) as Theme}
            searchPlaceholder="Search emoji..."
            width={320}
            height={400}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
