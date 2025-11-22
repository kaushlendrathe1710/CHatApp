import { File, Download, Image as ImageIcon, Video, FileText, Music, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "./AudioPlayer";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface FilePreviewProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'text';
  showDownload?: boolean;
}

export function FilePreview({ fileUrl, fileName, fileSize, mimeType, type, showDownload = true }: FilePreviewProps) {
  const [showFullImage, setShowFullImage] = useState(false);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = () => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-6 w-6" />;
      case 'video':
        return <Video className="h-6 w-6" />;
      case 'audio':
        return <Music className="h-6 w-6" />;
      case 'document':
        return <FileText className="h-6 w-6" />;
      default:
        return <File className="h-6 w-6" />;
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Image preview
  if (type === 'image') {
    return (
      <>
        <div className="relative group max-w-xs" data-testid="preview-image">
          <img
            src={fileUrl}
            alt={fileName}
            className="rounded-lg max-w-full h-auto cursor-pointer hover-elevate"
            onClick={() => setShowFullImage(true)}
            data-testid="img-message-attachment"
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            {showDownload && (
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="h-8 w-8 shadow-lg"
                data-testid="button-download-image"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
          {fileSize && (
            <p className="text-xs text-muted-foreground mt-1" data-testid="text-image-size">
              {formatFileSize(fileSize)}
            </p>
          )}
        </div>

        <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
          <DialogContent className="max-w-4xl" data-testid="dialog-full-image">
            <img
              src={fileUrl}
              alt={fileName}
              className="w-full h-auto max-h-[80vh] object-contain"
              data-testid="img-full-preview"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Video preview
  if (type === 'video') {
    return (
      <div className="max-w-sm" data-testid="preview-video">
        <video
          src={fileUrl}
          controls
          className="rounded-lg w-full"
          data-testid="video-message-attachment"
        >
          Your browser does not support the video tag.
        </video>
        {fileSize && (
          <p className="text-xs text-muted-foreground mt-1" data-testid="text-video-size">
            {formatFileSize(fileSize)}
          </p>
        )}
      </div>
    );
  }

  // Audio preview - Voice Message Player
  if (type === 'audio') {
    return (
      <div className="max-w-md" data-testid="preview-audio">
        <AudioPlayer audioUrl={fileUrl} />
      </div>
    );
  }

  // Document/file preview (generic)
  return (
    <div
      className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-xs hover-elevate cursor-pointer"
      onClick={handleDownload}
      data-testid="preview-document"
    >
      <div className="flex-shrink-0 text-orange-500">
        {getFileIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" data-testid="text-document-name">{fileName}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {fileSize && <span data-testid="text-document-size">{formatFileSize(fileSize)}</span>}
          <span className="capitalize" data-testid="text-document-type">{type}</span>
        </div>
      </div>
      {showDownload && (
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="flex-shrink-0 h-8 w-8"
          data-testid="button-download-document"
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
