import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Smile, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import type { MessageWithSender } from "@shared/schema";

interface MessageComposerProps {
  onSendMessage: (content: string) => void;
  onAttachFile?: () => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  replyToMessage?: MessageWithSender | null;
  onCancelReply?: () => void;
}

export function MessageComposer({
  onSendMessage,
  onAttachFile,
  onTyping,
  disabled = false,
  placeholder = "Type a message...",
  replyToMessage,
  onCancelReply
}: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const handleChange = (value: string) => {
    setMessage(value);
    onTyping?.();
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  };

  return (
    <div className="border-t bg-background p-4">
      {replyToMessage && (
        <div className="mb-2 flex items-center gap-2 bg-muted p-2 rounded-md" data-testid="reply-preview">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Replying to {replyToMessage.sender.firstName || replyToMessage.sender.email}
            </p>
            <p className="text-sm truncate">{replyToMessage.content}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancelReply}
            className="flex-shrink-0 h-6 w-6"
            data-testid="button-cancel-reply"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        {onAttachFile && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onAttachFile}
            disabled={disabled}
            className="flex-shrink-0"
            data-testid="button-attach-file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        )}

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={disabled}
              className="flex-shrink-0"
              data-testid="button-emoji-picker"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0" align="start" side="top">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.AUTO}
              width={350}
              height={400}
              searchPlaceholder="Search emoji..."
              previewConfig={{ showPreview: false }}
            />
          </PopoverContent>
        </Popover>

        <div className="flex-1 min-w-0">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            data-testid="input-message"
          />
        </div>

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="flex-shrink-0"
          data-testid="button-send"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
