import React, {
  useState,
  useRef,
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Smile, X, Camera } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import type { MessageWithSender } from "@shared/schema";
import { FileAttachmentUploader } from "./FileAttachmentUploader";
import { CameraCapture } from "./CameraCapture";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MessageComposerProps {
  onSendMessage: (
    content: string,
    fileData?: {
      fileUrl: string;
      fileName: string;
      fileSize: number;
      mediaObjectKey: string;
      mimeType: string;
      type: "image" | "video" | "document" | "audio";
    }
  ) => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  replyToMessage?: MessageWithSender | null;
  onCancelReply?: () => void;
}

export const MessageComposer = React.memo(function MessageComposer({
  onSendMessage,
  onTyping,
  disabled = false,
  placeholder = "Type a message...",
  replyToMessage,
  onCancelReply,
}: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [focusAfterSend, setFocusAfterSend] = useState(false);
  const [pendingFileData, setPendingFileData] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mediaObjectKey: string;
    mimeType: string;
    type: "image" | "video" | "document" | "audio";
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Auto-focus input on mount
  useEffect(() => {
    console.warn("MessageComposer: Auto-focusing on mount");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Focus after sending message, when not disabled
  useLayoutEffect(() => {
    console.warn(
      "MessageComposer: useLayoutEffect for focusAfterSend triggered, focusAfterSend:",
      focusAfterSend,
      "disabled:",
      disabled
    );
    if (focusAfterSend && !disabled && textareaRef.current) {
      console.warn(
        "MessageComposer: Focusing textarea after send (not disabled)"
      );
      // Use setTimeout to ensure focus happens after any DOM updates
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
      setFocusAfterSend(false);
    } else if (focusAfterSend && disabled) {
      console.warn("MessageComposer: Waiting to focus, still disabled");
    } else if (focusAfterSend && !textareaRef.current) {
      console.warn(
        "MessageComposer: focusAfterSend is true but textareaRef.current is null"
      );
    }
  }, [focusAfterSend, disabled]);

  const handleSend = () => {
    // Allow sending if message has content OR if file is attached
    if (!disabled && (message.trim() || pendingFileData)) {
      console.warn(
        "MessageComposer: Sending message, setting focusAfterSend to true"
      );
      onSendMessage(message.trim() || "", pendingFileData || undefined);
      setMessage("");
      setPendingFileData(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setFocusAfterSend(true);
    }
  };

  const handleFileUpload = (fileData: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mediaObjectKey: string;
    mimeType: string;
    type: "image" | "video" | "document" | "audio";
  }) => {
    // Store file data and let user add caption before sending
    setPendingFileData(fileData);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleRemoveFile = () => {
    setPendingFileData(null);
  };

  const handleCameraCapture = async (file: File) => {
    try {
      // Get signed upload URL from server
      const uploadResponse = (await apiRequest(
        "POST",
        "/api/messages/upload-url",
        {
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }
      )) as unknown as { uploadURL: string; objectKey: string };
      console.log("Upload response received:", JSON.stringify(uploadResponse));

      // Upload to GCS using signed URL
      const uploadResult = await fetch(uploadResponse.uploadURL, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload file to cloud storage");
      }

      // Set file metadata to public and get the public objectPath
      console.log("Setting metadata for objectKey:", uploadResponse.objectKey);
      const metadataResponse = await fetch("/api/objects/metadata", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          fileUrl: uploadResponse.objectKey,
        }),
      });

      if (!metadataResponse.ok) {
        const errorData = await metadataResponse.json();
        console.error("Metadata error response:", errorData);
        throw new Error(errorData.error || "Failed to set file metadata");
      }

      const { objectPath } = await metadataResponse.json();

      // Store file data for sending with message - use objectPath for public URL
      setPendingFileData({
        fileUrl: objectPath,
        fileName: file.name,
        fileSize: file.size,
        mediaObjectKey: uploadResponse.objectKey,
        mimeType: file.type,
        type: "image",
      });

      toast({
        title: "Photo Captured",
        description: "Add a caption or send it now.",
      });

      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (error) {
      console.error("Error uploading camera photo:", error);
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error ? error.message : "Failed to upload photo",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const handleChange = (value: string) => {
    setMessage(value);
    onTyping?.();

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 128) + "px";
    }
  };

  return (
    <div className="border-t bg-background p-4">
      {replyToMessage && (
        <div
          className="mb-2 flex items-center gap-2 bg-muted p-2 rounded-md"
          data-testid="reply-preview"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Replying to{" "}
              {replyToMessage.sender.fullName || replyToMessage.sender.email}
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

      {/* Pending File Preview */}
      {pendingFileData && (
        <div
          className="mb-2 flex items-center gap-2 bg-muted p-2 rounded-md"
          data-testid="pending-file-preview"
        >
          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{pendingFileData.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {(pendingFileData.fileSize / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRemoveFile}
            className="flex-shrink-0 h-6 w-6"
            data-testid="button-remove-file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <FileAttachmentUploader
          onFileUpload={handleFileUpload}
          disabled={disabled}
        />

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setCameraOpen(true)}
          disabled={disabled}
          className="flex-shrink-0"
          data-testid="button-camera"
        >
          <Camera className="h-5 w-5" />
        </Button>

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
          <PopoverContent
            className="w-auto p-0 border-0"
            align="start"
            side="top"
          >
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
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            data-testid="input-message"
          />
        </div>

        <Button
          size="icon"
          onClick={handleSend}
          disabled={(!message.trim() && !pendingFileData) || disabled}
          className="flex-shrink-0"
          data-testid="button-send"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
});
