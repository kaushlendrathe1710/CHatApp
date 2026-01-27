import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, Heart, MessageCircle, Eye, Trash2, Smile } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserPhoto } from "@shared/schema";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";

export default function PhotoGallery() {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  // Get current user
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  // Get user's photos
  const { data: photos = [], isLoading } = useQuery<UserPhoto[]>({
    queryKey: ['/api/photos/user', user?.id],
    enabled: !!user?.id,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      setUploading(true);
      try {
        // Step 1: Get upload URL and objectKey from server
        const uploadUrlResponse = await fetch('/api/photos/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!uploadUrlResponse.ok) {
          throw new Error('Failed to get upload URL');
        }
        
        const { uploadURL, objectKey } = await uploadUrlResponse.json();

        // Step 2: Upload file to GCS using signed URL
        const fileUploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!fileUploadResponse.ok) {
          throw new Error('Failed to upload file to storage');
        }

        // Step 3: Save photo metadata with objectKey
        const photoResponse = await fetch('/api/photos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            objectKey,
            caption,
          }),
        });

        if (!photoResponse.ok) {
          const errorData = await photoResponse.json();
          throw new Error(errorData.message || 'Failed to save photo');
        }

        const photo = await photoResponse.json();
        return photo;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      toast({
        title: "Photo uploaded",
        description: "Your photo has been uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/photos/user', user?.id] });
      setUploadDialogOpen(false);
      setCaption("");
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }
    },
    onSuccess: () => {
      toast({
        title: "Photo deleted",
        description: "Your photo has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/photos/user', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const textarea = captionRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCaption = caption.substring(0, start) + emojiData.emoji + caption.substring(end);
      setCaption(newCaption);
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + emojiData.emoji.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    } else {
      setCaption(caption + emojiData.emoji);
    }
    setEmojiPickerOpen(false);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a photo to upload",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ file: selectedFile, caption });
  };

  if (isLoading) {
    return <div className="p-4">Loading photos...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Photo Gallery</h1>
          <p className="text-muted-foreground">Share your moments</p>
        </div>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-photo">
              <Upload className="mr-2 h-4 w-4" />
              Upload Photo
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-upload-photo">
            <DialogHeader>
              <DialogTitle>Upload Photo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="photo-file">Photo</Label>
                <Input
                  id="photo-file"
                  type="file"
                  accept="image/*"
                  data-testid="input-photo-file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <Label htmlFor="caption">Caption (optional)</Label>
                <div className="relative">
                  <Textarea
                    ref={captionRef}
                    id="caption"
                    placeholder="Add a caption..."
                    value={caption}
                    data-testid="input-caption"
                    onChange={(e) => setCaption(e.target.value)}
                    className="pr-12"
                  />
                  <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2"
                        data-testid="button-emoji-picker"
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-0" align="end">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        theme={Theme.AUTO}
                        width={350}
                        height={400}
                        searchPlaceholder="Search emoji..."
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full"
                data-testid="button-submit-upload"
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {photos.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <button
              onClick={() => setUploadDialogOpen(true)}
              className="w-full text-center py-12 hover-elevate active-elevate-2 rounded-md"
              data-testid="button-empty-state-upload"
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No photos yet</h3>
              <p className="text-muted-foreground">Upload your first photo to get started</p>
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo) => (
            <Card key={photo.id} data-testid={`card-photo-${photo.id}`}>
              <CardHeader className="p-0">
                <img
                  src={photo.photoUrl}
                  alt={photo.caption || "Photo"}
                  className="w-full h-64 object-cover rounded-t-md"
                  data-testid={`img-photo-${photo.id}`}
                />
              </CardHeader>
              <CardContent className="p-4">
                {photo.caption && (
                  <p className="text-sm mb-3" data-testid={`text-caption-${photo.id}`}>
                    {photo.caption}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1" data-testid={`text-likes-${photo.id}`}>
                      <Heart className="h-4 w-4" />
                      {photo.likeCount}
                    </span>
                    <span className="flex items-center gap-1" data-testid={`text-comments-${photo.id}`}>
                      <MessageCircle className="h-4 w-4" />
                      {photo.commentCount}
                    </span>
                    <span className="flex items-center gap-1" data-testid={`text-views-${photo.id}`}>
                      <Eye className="h-4 w-4" />
                      {photo.viewCount}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(photo.id)}
                    data-testid={`button-delete-${photo.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
