import React, {
  useState,
  useRef,
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Paperclip,
  Send,
  Smile,
  X,
  Camera,
  Image as ImageIcon,
  FileText,
  Reply,
  Mic,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import type { MessageWithSender } from "@shared/schema";
import { FileAttachmentUploader } from "./FileAttachmentUploader";
import { CameraCapture } from "./CameraCapture";
import { VoiceRecorder } from "./VoiceRecorder";
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
  onJumpToReply?: () => void;
}

export const MessageComposer = React.memo(function MessageComposer({
  onSendMessage,
  onTyping,
  disabled = false,
  placeholder = "Type a message...",
  replyToMessage,
  onCancelReply,
  onJumpToReply,
}: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [focusAfterSend, setFocusAfterSend] = useState(false);
  const [pendingFileData, setPendingFileData] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mediaObjectKey: string;
    mimeType: string;
    type: "image" | "video" | "document" | "audio";
  } | null>(null);
  const [focusReason, setFocusReason] = useState<
    "mount" | "reply" | "send" | null
  >(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Initial mount focus
  useEffect(() => {
    setFocusReason("mount");
  }, []);

  // Focus after message is sent
  useEffect(() => {
    if (focusAfterSend) {
      setFocusReason("send");
    }
  }, [focusAfterSend]);

    useEffect(() => {
      if (replyToMessage) {
        setFocusReason("reply");
      }
    }, [replyToMessage]);

  // Focus AFTER textarea is fully positioned in DOM
  useLayoutEffect(() => {
    if (!textareaRef.current || disabled) return;

    const shouldFocus =
      focusReason === "mount" ||
      focusReason === "send" ||
      (focusReason === "reply" && replyToMessage);

    if (!shouldFocus) return;

    // Keep consistent height + apply focus
    textareaRef.current.style.height = "auto";
    textareaRef.current.focus();

    setFocusReason(null);
    setFocusAfterSend(false);
  }, [focusReason, disabled, replyToMessage]);

  const handleSend = () => {
    // Allow sending if message has content OR if file is attached
    if (!disabled && (message.trim() || pendingFileData)) {
      console.log(
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
      const response = await apiRequest("POST", "/api/messages/upload-url", {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });
      const uploadResponse = (await response.json()) as {
        uploadURL: string;
        objectKey: string;
      };
      console.log("Upload response received:", JSON.stringify(uploadResponse));

      // Upload to S3 using signed URL
      console.log("Uploading to S3, file size:", file.size, "type:", file.type);
      const uploadResult = await fetch(uploadResponse.uploadURL, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      console.log(
        "S3 upload response status:",
        uploadResult.status,
        uploadResult.statusText
      );
      if (!uploadResult.ok) {
        const errorText = await uploadResult.text();
        console.error("S3 upload error:", errorText);
        throw new Error(
          `Failed to upload file to cloud storage: ${
            uploadResult.status
          } ${errorText.substring(0, 200)}`
        );
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

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Check if any of the clipboard items is an image
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.startsWith("image/")) {
        e.preventDefault();

        const file = item.getAsFile();
        if (!file) continue;

        try {
          // Show loading toast
          toast({
            title: "Uploading Image",
            description: "Please wait...",
          });

          // Get signed upload URL from server
          const response = await apiRequest(
            "POST",
            "/api/messages/upload-url",
            {
              fileName: file.name || `pasted-image-${Date.now()}.png`,
              mimeType: file.type,
              fileSize: file.size,
            }
          );
          const uploadResponse = (await response.json()) as {
            uploadURL: string;
            objectKey: string;
          };

          // Upload to S3 using signed URL
          const uploadResult = await fetch(uploadResponse.uploadURL, {
            method: "PUT",
            headers: {
              "Content-Type": file.type,
            },
            body: file,
          });

          if (!uploadResult.ok) {
            throw new Error(`Failed to upload image`);
          }

          // Set file metadata to public and get the public objectPath
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
            throw new Error(errorData.error || "Failed to set file metadata");
          }

          const { objectPath } = await metadataResponse.json();

          // Store file data for sending with message
          setPendingFileData({
            fileUrl: objectPath,
            fileName: file.name || `pasted-image-${Date.now()}.png`,
            fileSize: file.size,
            mediaObjectKey: uploadResponse.objectKey,
            mimeType: file.type,
            type: "image",
          });

          toast({
            title: "Image Ready",
            description: "Add a caption or send it now.",
          });

          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        } catch (error) {
          console.error("Error uploading pasted image:", error);
          toast({
            title: "Upload Failed",
            description:
              error instanceof Error ? error.message : "Failed to upload image",
            variant: "destructive",
          });
        }

        // Only process the first image
        break;
      }
    }
  };

  const handleVoiceRecordComplete = async (
    audioBlob: Blob,
    duration: number
  ) => {
    try {
      // Create file from blob
      const fileName = `voice-message-${Date.now()}.webm`;
      const file = new File([audioBlob], fileName, { type: audioBlob.type });

      // Get signed upload URL from server
      const response = await apiRequest("POST", "/api/messages/upload-url", {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });
      const uploadResponse = (await response.json()) as {
        uploadURL: string;
        objectKey: string;
      };

      // Upload to S3 using signed URL
      const uploadResult = await fetch(uploadResponse.uploadURL, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error(`Failed to upload voice message`);
      }

      // Set file metadata to public and get the public objectPath
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
        throw new Error(errorData.error || "Failed to set file metadata");
      }

      const { objectPath } = await metadataResponse.json();

      // Send the voice message
      onSendMessage("", {
        fileUrl: objectPath,
        fileName: file.name,
        fileSize: file.size,
        mediaObjectKey: uploadResponse.objectKey,
        mimeType: file.type,
        type: "audio",
      });

      setVoiceRecording(false);

      toast({
        title: "Voice Message Sent",
        description: `${duration}s recording sent successfully`,
      });
    } catch (error) {
      console.error("Error uploading voice message:", error);
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload voice message",
        variant: "destructive",
      });
      setVoiceRecording(false);
    }
  };

  const handleCancelVoiceRecording = () => {
    setVoiceRecording(false);
  };

  // Show voice recorder if recording
  if (voiceRecording) {
    return (
      <VoiceRecorder
        onRecordComplete={handleVoiceRecordComplete}
        onCancel={handleCancelVoiceRecording}
      />
    );
  }

  return (
    <div className="border-t bg-background p-4">
      {replyToMessage && (
        <div
          className="mb-2 flex items-start gap-2 bg-accent/50 border-l-4 border-l-primary p-3 rounded-md cursor-pointer hover-elevate transition-colors"
          onClick={onJumpToReply}
          data-testid="reply-preview"
        >
          <Reply className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-medium text-primary truncate">
                {replyToMessage.sender.fullName ||
                  replyToMessage.sender.email?.split("@")[0] ||
                  "User"}
              </p>
              {replyToMessage.type === "image" && (
                <ImageIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
              {replyToMessage.type === "file" && (
                <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {replyToMessage.type === "image" ? (
                <span className="flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  Photo
                </span>
              ) : replyToMessage.type === "file" ? (
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                  {replyToMessage.fileName || "File"}
                </span>
              ) : (
                replyToMessage.content || "Message"
              )}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancelReply}
            className="flex-shrink-0 h-6 w-6"
            tabIndex={-1}
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

      <div className="flex items-end gap-1 sm:gap-2 w-full">
        <FileAttachmentUploader
          onFileUpload={handleFileUpload}
          disabled={disabled}
        />

        {/* Hide camera on mobile - accessible via attachment menu */}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setCameraOpen(true)}
          disabled={disabled}
          className="hidden sm:flex flex-shrink-0 min-w-[44px] min-h-[44px]"
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
              className="flex-shrink-0 min-w-[44px] min-h-[44px]"
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
              width={320}
              height={380}
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
            onPaste={handlePaste}
            placeholder={placeholder}
            className="min-h-[44px] max-h-32 resize-none text-base"
            rows={1}
            data-testid="input-message"
          />
        </div>

        {/* Show microphone button when no text, otherwise show send button */}
        {!message.trim() && !pendingFileData ? (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setVoiceRecording(true)}
            disabled={disabled}
            className="flex-shrink-0 min-w-[44px] min-h-[44px]"
            data-testid="button-voice-record"
          >
            <Mic className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={(!message.trim() && !pendingFileData) || disabled}
            className="flex-shrink-0 min-w-[44px] min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground"
            data-testid="button-send"
          >
            <Send className="h-5 w-5" />
          </Button>
        )}
      </div>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
});
