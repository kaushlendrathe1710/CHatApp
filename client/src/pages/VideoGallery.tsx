import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Heart, MessageCircle, Eye, Trash2, PlayCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { UserVideo } from "@shared/schema";

export default function VideoGallery() {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  const { data: videos = [], isLoading } = useQuery<UserVideo[]>({
    queryKey: ['/api/videos/user', user?.id],
    enabled: !!user?.id,
  });

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (!file) {
      setVideoDuration(null);
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      // Use Math.ceil to ensure any video over 20s is rejected
      const duration = Math.ceil(video.duration);
      setVideoDuration(duration);
      
      if (duration > 20) {
        toast({
          title: "Video too long",
          description: "Videos must be 20 seconds or less",
          variant: "destructive",
        });
      }
    };
    video.src = URL.createObjectURL(file);
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ file, caption, duration }: { file: File; caption: string; duration: number }) => {
      setUploading(true);
      try {
        const uploadUrlResponse = await fetch('/api/videos/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!uploadUrlResponse.ok) {
          throw new Error('Failed to get upload URL');
        }
        
        const { uploadURL, objectKey } = await uploadUrlResponse.json();

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

        const videoResponse = await fetch('/api/videos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            objectKey,
            caption,
            duration,
          }),
        });

        if (!videoResponse.ok) {
          const errorData = await videoResponse.json();
          throw new Error(errorData.message || 'Failed to save video');
        }

        const video = await videoResponse.json();
        return video;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      toast({
        title: "Video uploaded",
        description: "Your video has been uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/videos/user', user?.id] });
      setUploadDialogOpen(false);
      setCaption("");
      setSelectedFile(null);
      setVideoDuration(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete video');
      }
    },
    onSuccess: () => {
      toast({
        title: "Video deleted",
        description: "Your video has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/videos/user', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a video to upload",
        variant: "destructive",
      });
      return;
    }

    if (!videoDuration || videoDuration > 20) {
      toast({
        title: "Invalid video",
        description: "Video must be 20 seconds or less",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ file: selectedFile, caption, duration: videoDuration });
  };

  if (isLoading) {
    return <div className="p-4">Loading videos...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Video Gallery</h1>
          <p className="text-muted-foreground">Share your 20-second clips</p>
        </div>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-video">
              <Upload className="mr-2 h-4 w-4" />
              Upload Video
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-upload-video">
            <DialogHeader>
              <DialogTitle>Upload Video</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="video-file">Video (max 20 seconds)</Label>
                <Input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  data-testid="input-video-file"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
                {videoDuration !== null && (
                  <p className="text-sm mt-1" data-testid="text-video-duration">
                    Duration: {videoDuration}s {videoDuration > 20 && <span className="text-destructive">(too long)</span>}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="caption">Caption (optional)</Label>
                <Textarea
                  id="caption"
                  placeholder="Add a caption..."
                  value={caption}
                  data-testid="input-caption"
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !videoDuration || videoDuration > 20}
                className="w-full"
                data-testid="button-submit-upload"
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {videos.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <PlayCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No videos yet</h3>
              <p className="text-muted-foreground">Upload your first video to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Card key={video.id} data-testid={`card-video-${video.id}`}>
              <CardHeader className="p-0">
                <div className="relative">
                  <video
                    src={video.videoUrl}
                    controls
                    className="w-full h-64 object-cover rounded-t-md bg-black"
                    data-testid={`video-player-${video.id}`}
                    preload="metadata"
                  />
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded" data-testid={`text-duration-${video.id}`}>
                      {video.duration}s
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {video.caption && (
                  <p className="text-sm mb-3" data-testid={`text-caption-${video.id}`}>
                    {video.caption}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1" data-testid={`text-likes-${video.id}`}>
                      <Heart className="h-4 w-4" />
                      {video.likeCount}
                    </span>
                    <span className="flex items-center gap-1" data-testid={`text-comments-${video.id}`}>
                      <MessageCircle className="h-4 w-4" />
                      {video.commentCount}
                    </span>
                    <span className="flex items-center gap-1" data-testid={`text-views-${video.id}`}>
                      <Eye className="h-4 w-4" />
                      {video.viewCount}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(video.id)}
                    data-testid={`button-delete-${video.id}`}
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
