import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCapture({ open, onClose, onCapture }: CameraCaptureProps) {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamIdRef = useRef<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      startCamera();
      checkMultipleCameras();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open, facingMode]);

  const checkMultipleCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    } catch (error) {
      console.error('Error checking cameras:', error);
    }
  };

  const startCamera = async () => {
    // Increment stream ID to invalidate any pending async resolutions
    const currentStreamId = ++streamIdRef.current;
    
    // Stop previous stream if any (this will increment streamIdRef again)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      // Only apply stream if this is still the latest request AND dialog is still open
      if (currentStreamId === streamIdRef.current && open) {
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } else {
        // This is a stale response or dialog closed, stop it immediately
        mediaStream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
      // Only close if dialog is still open
      if (open) {
        onClose();
      }
    }
  };

  const stopCamera = () => {
    // Invalidate current stream ID to reject any pending promises
    streamIdRef.current++;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        // Stop camera before calling callbacks
        stopCamera();
        onCapture(file);
        onClose();
      }
    }, 'image/jpeg', 0.95);
  };

  const handleClose = () => {
    // Always stop camera before closing
    stopCamera();
    onClose();
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-3xl" data-testid="dialog-camera-capture">
        <DialogHeader>
          <DialogTitle>Take a Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              data-testid="video-camera-preview"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex gap-2 justify-center">
            {hasMultipleCameras && (
              <Button
                variant="outline"
                size="icon"
                onClick={switchCamera}
                data-testid="button-switch-camera"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={capturePhoto}
              size="lg"
              data-testid="button-capture-photo"
            >
              <Camera className="h-5 w-5 mr-2" />
              Capture Photo
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleClose}
              data-testid="button-cancel-camera"
            >
              <X className="h-5 w-5 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
