import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Paperclip, File, Image as ImageIcon, Video, FileText, Music, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileAttachmentUploaderProps {
  onFileUpload: (fileData: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mediaObjectKey: string;
    mimeType: string;
    type: 'image' | 'video' | 'document' | 'audio';
  }) => void;
  disabled?: boolean;
}

export function FileAttachmentUploader({ onFileUpload, disabled }: FileAttachmentUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getFileType = (mimeType: string): 'image' | 'video' | 'document' | 'audio' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const getFileIcon = (file: File) => {
    const type = getFileType(file.type);
    switch (type) {
      case 'image':
        return <ImageIcon className="h-12 w-12 text-blue-500" />;
      case 'video':
        return <Video className="h-12 w-12 text-purple-500" />;
      case 'audio':
        return <Music className="h-12 w-12 text-green-500" />;
      case 'document':
        return <FileText className="h-12 w-12 text-orange-500" />;
      default:
        return <File className="h-12 w-12 text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 50MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Step 1: Get upload URL from server
      const uploadUrlResponse = await fetch('/api/messages/upload-url', {
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
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!fileUploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Set object metadata to make file publicly accessible
      const metadataResponse = await fetch('/api/objects/metadata', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fileUrl: objectKey, // Use objectKey (e.g. /objects/...) not uploadURL
        }),
      });

      if (!metadataResponse.ok) {
        throw new Error('Failed to set file metadata');
      }

      const { objectPath } = await metadataResponse.json();
      
      // Construct file data to return - use objectPath which is served through /objects/ endpoint
      const fileData = {
        fileUrl: objectPath, // Use /objects/... path
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mediaObjectKey: objectKey,
        mimeType: selectedFile.type,
        type: getFileType(selectedFile.type),
      };

      toast({
        title: "File uploaded",
        description: "Your file has been uploaded successfully",
      });

      onFileUpload(fileData);
      setIsOpen(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setIsOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="flex-shrink-0"
        data-testid="button-attach-file"
      >
        <Paperclip className="h-5 w-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent data-testid="dialog-file-upload">
          <DialogHeader>
            <DialogTitle>Attach File</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!selectedFile ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                  data-testid="input-file"
                />
                <File className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Select a file to upload (Max 50MB)
                </p>
                <Button onClick={() => fileInputRef.current?.click()} data-testid="button-select-file">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  {getFileIcon(selectedFile)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid="text-file-name">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-file-size">
                      {formatFileSize(selectedFile.size)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize" data-testid="text-file-type">
                      {getFileType(selectedFile.type)}
                    </p>
                  </div>
                  {!uploading && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSelectedFile(null)}
                      className="flex-shrink-0 h-8 w-8"
                      data-testid="button-remove-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {selectedFile.type.startsWith('image/') && (
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-md"
                    data-testid="img-file-preview"
                  />
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={uploading} data-testid="button-cancel-upload">
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || uploading}
              data-testid="button-upload-file"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
