import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
import SimplePeer from "simple-peer";

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  isInitiator: boolean;
  callType: "audio" | "video";
  onSignal: (signal: any) => void;
  incomingSignal?: any;
  callerName?: string;
  ws: WebSocket | null;
}

export function VideoCallDialog({
  open,
  onOpenChange,
  conversationId,
  isInitiator,
  callType,
  onSignal,
  incomingSignal,
  callerName,
  ws,
}: VideoCallDialogProps) {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStartTime = useRef<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      initializeCall();
      callStartTime.current = Date.now();
      const interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      cleanup();
    }
  }, [open]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle all incoming signals (ICE candidates, answers, offers, renegotiation)
  // React's dependency array ensures this only runs when incomingSignal actually changes
  useEffect(() => {
    if (peer && incomingSignal) {
      try {
        peer.signal(incomingSignal);
      } catch (error) {
        console.error("Error signaling peer:", error);
        toast({
          title: "Signaling Error",
          description: "Failed to process connection data",
          variant: "destructive",
        });
      }
    }
  }, [peer, incomingSignal, toast]);

  const initializeCall = async () => {
    try {
      const constraints = {
        audio: true,
        video: callType === "video",
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      const p = new SimplePeer({
        initiator: isInitiator,
        trickle: false,
        stream: stream,
      });

      p.on("signal", (data) => {
        onSignal(data);
      });

      p.on("stream", (stream) => {
        setRemoteStream(stream);
        setIsConnected(true);
      });

      p.on("error", (err) => {
        console.error("Peer error:", err);
        toast({
          title: "Call Error",
          description: "Connection failed",
          variant: "destructive",
        });
        endCall();
      });

      if (incomingSignal) {
        p.signal(incomingSignal);
      }

      setPeer(p);
    } catch (error) {
      console.error("Error initializing call:", error);
      toast({
        title: "Permission Denied",
        description: "Please allow camera and microphone access",
        variant: "destructive",
      });
      endCall();
    }
  };

  const cleanup = () => {
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setIsConnected(false);
    setCallDuration(0);
  };

  const endCall = () => {
    const duration = Math.floor((Date.now() - callStartTime.current) / 1000);
    
    ws?.send(
      JSON.stringify({
        type: "call_end",
        data: { conversationId, duration },
      })
    );

    cleanup();
    onOpenChange(false);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${isFullscreen ? "max-w-full h-screen" : "max-w-4xl"} p-0`}
        data-testid="dialog-video-call"
      >
        <div className="relative w-full h-full min-h-[500px] bg-black rounded-lg overflow-hidden">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              data-testid="video-remote"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              <div className="text-center space-y-4">
                <div className="animate-pulse">
                  <Phone className="h-16 w-16 mx-auto" />
                </div>
                <p className="text-lg">
                  {isInitiator ? `Calling ${callerName}...` : `${callerName} is calling...`}
                </p>
              </div>
            </div>
          )}

          {callType === "video" && localStream && (
            <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                data-testid="video-local"
              />
            </div>
          )}

          {isConnected && (
            <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
              {formatDuration(callDuration)}
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
            <Button
              size="icon"
              variant={isMuted ? "destructive" : "secondary"}
              className="h-12 w-12 rounded-full"
              onClick={toggleMute}
              data-testid="button-toggle-mute"
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {callType === "video" && (
              <Button
                size="icon"
                variant={isVideoOff ? "destructive" : "secondary"}
                className="h-12 w-12 rounded-full"
                onClick={toggleVideo}
                data-testid="button-toggle-video"
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            )}

            <Button
              size="icon"
              variant="destructive"
              className="h-12 w-12 rounded-full"
              onClick={endCall}
              data-testid="button-end-call"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-full"
              onClick={() => setIsFullscreen(!isFullscreen)}
              data-testid="button-toggle-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
