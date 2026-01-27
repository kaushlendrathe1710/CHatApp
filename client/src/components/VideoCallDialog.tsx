import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import SimplePeer from "simple-peer";
import {
  getICEServers,
  formatCallDuration,
  getVideoConstraints,
} from "@/lib/webrtc";
import { apiRequest } from "@/lib/queryClient";

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
  const [isRinging, setIsRinging] = useState(true);
  const [callAccepted, setCallAccepted] = useState(isInitiator);
  const [callRejected, setCallRejected] = useState(false);
  const [pendingSignal, setPendingSignal] = useState<any>(null);
  const processedSignals = useRef<Set<string>>(new Set());
  const [preCallVideoEnabled, setPreCallVideoEnabled] = useState(true);
  const [preCallAudioEnabled, setPreCallAudioEnabled] = useState(true);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStartTime = useRef<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    console.log(
      `[VideoCall] Effect triggered - open: ${open}, callAccepted: ${callAccepted}, callRejected: ${callRejected}, isInitiator: ${isInitiator}`
    );

    // For initiator, auto-accept if not already accepted
    if (open && isInitiator && !callAccepted && !callRejected) {
      console.log("[VideoCall] Auto-accepting for initiator");
      setCallAccepted(true);
      return;
    }

    if (open && callAccepted && !callRejected) {
      console.log(
        `[VideoCall] Initializing call as ${
          isInitiator ? "initiator" : "receiver"
        }`
      );
      initializeCall();
      callStartTime.current = Date.now();
      const interval = setInterval(() => {
        setCallDuration(
          Math.floor((Date.now() - callStartTime.current) / 1000)
        );
      }, 1000);
      return () => clearInterval(interval);
    } else if (!open) {
      cleanup();
    }
  }, [open, callAccepted, callRejected, isInitiator]);

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
    if (!incomingSignal || !peer) return;

    // Remove timestamp if present and create clean signal
    const { _timestamp, ...cleanSignal } = incomingSignal;
    const signalKey = JSON.stringify(cleanSignal);

    if (processedSignals.current.has(signalKey)) {
      console.log(
        "[VideoCall] Signal already processed, skipping:",
        cleanSignal.type
      );
      return;
    }

    // Peer is ready, signal immediately
    try {
      console.log("[VideoCall] Processing incoming signal:", cleanSignal.type);
      peer.signal(cleanSignal);
      processedSignals.current.add(signalKey);
      console.log(
        "[VideoCall] ✅ Signal processed successfully:",
        cleanSignal.type
      );
    } catch (error) {
      console.error("[VideoCall] ❌ Error signaling peer:", error);
      toast({
        title: "Signaling Error",
        description: "Failed to process connection data",
        variant: "destructive",
      });
    }
  }, [peer, incomingSignal, toast]);

  // Store pending signal for receiver before peer is created
  useEffect(() => {
    console.log(
      "[VideoCall] Pending signal storage check - incomingSignal:",
      incomingSignal ? incomingSignal.type : "null",
      "peer:",
      peer ? "exists" : "null",
      "isInitiator:",
      isInitiator,
      "callAccepted:",
      callAccepted
    );
    if (incomingSignal && !peer && !isInitiator && !callAccepted) {
      const { _timestamp, ...cleanSignal } = incomingSignal;
      console.log(
        "[VideoCall] ✅ Storing pending signal for receiver:",
        cleanSignal.type
      );
      setPendingSignal(cleanSignal);
    }
  }, [incomingSignal, peer, isInitiator, callAccepted]);

  const initializeCall = async () => {
    try {
      console.log("[VideoCall] Starting initializeCall...");

      let stream: MediaStream;
      let videoEnabled = preCallVideoEnabled;

      // Try to get video and audio
      if (preCallVideoEnabled) {
        try {
          const constraints = getVideoConstraints();
          console.log(
            "[VideoCall] Requesting video with constraints:",
            constraints
          );
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log(
            "[VideoCall] Got local stream with",
            stream.getTracks().length,
            "tracks"
          );
        } catch (videoError: any) {
          console.warn(
            "[VideoCall] Camera access failed, falling back to audio-only:",
            videoError
          );

          // Fall back to audio-only
          videoEnabled = false;
          setIsVideoOff(true);
          setCameraPermissionDenied(true);

          toast({
            title: "Camera Unavailable",
            description:
              "Starting call with audio only. Camera may be in use or blocked.",
          });

          // Get audio-only stream
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          console.log("[VideoCall] Got audio-only stream");
        }
      } else {
        // User disabled video before call
        console.log("[VideoCall] Starting with video disabled by user");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: preCallAudioEnabled,
          video: false,
        });
        videoEnabled = false;
        setIsVideoOff(true);
      }

      // Apply pre-call mute state
      if (!preCallAudioEnabled) {
        stream.getAudioTracks().forEach((track) => (track.enabled = false));
        setIsMuted(true);
      }

      setLocalStream(stream);

      const iceServers = await getICEServers();

      const p = new SimplePeer({
        initiator: isInitiator,
        trickle: false,
        stream: stream,
        config: {
          iceServers,
          iceCandidatePoolSize: 10,
        },
      });

      p.on("signal", (data) => {
        console.log(
          `[VideoCall] ${
            isInitiator ? "📤 INITIATOR" : "📥 RECEIVER"
          } Generated signal:`,
          data.type
        );
        console.log(
          `[VideoCall] Current state - isRinging: ${isRinging}, isConnected: ${isConnected}`
        );
        onSignal(data);
      });

      p.on("stream", (stream) => {
        console.log(
          `[VideoCall] ${
            isInitiator ? "📤 INITIATOR" : "📥 RECEIVER"
          } Received remote stream with`,
          stream.getTracks().length,
          "tracks"
        );
        setRemoteStream(stream);
        setIsConnected(true);
        setIsRinging(false);
        console.log(
          "[VideoCall] ✅ Call connected - isRinging set to false, isConnected set to true"
        );
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

      // Process any pending signal that arrived before peer was ready
      console.log("[VideoCall] Checking for signals to process...");
      console.log(
        "[VideoCall] pendingSignal:",
        pendingSignal ? pendingSignal.type : "null"
      );
      console.log(
        "[VideoCall] incomingSignal:",
        incomingSignal ? incomingSignal.type : "null"
      );

      const signalToProcess = pendingSignal || incomingSignal;
      if (signalToProcess) {
        const { _timestamp, ...cleanSignal } = signalToProcess;
        console.log(
          "[VideoCall] Processing signal after peer creation:",
          cleanSignal.type
        );
        const signalKey = JSON.stringify(cleanSignal);
        processedSignals.current.add(signalKey);
        p.signal(cleanSignal);
        setPendingSignal(null);
        console.log(
          "[VideoCall] ✅ Initial signal processed:",
          cleanSignal.type
        );
      } else {
        console.log(
          "[VideoCall] ⚠️ No signal to process! This will prevent connection."
        );
      }

      setPeer(p);
    } catch (error) {
      console.error("[VideoCall] Error initializing call:", error);

      let errorMessage = "Failed to access camera and microphone";
      if (error instanceof Error) {
        if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          errorMessage =
            "Camera/microphone access denied. Please allow permissions.";
        } else if (error.name === "NotFoundError") {
          errorMessage =
            "No camera or microphone found. Please connect devices.";
        } else if (error.name === "NotReadableError") {
          errorMessage =
            "Camera is already in use by another application. Please close other apps using the camera.";
        } else if (error.name === "OverconstrainedError") {
          errorMessage = "Camera doesn't support the requested settings.";
        }
      }

      toast({
        title: "Video Call Error",
        description: errorMessage,
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
    setPendingSignal(null);
    processedSignals.current.clear();
  };

  const endCall = async () => {
    const duration = Math.floor((Date.now() - callStartTime.current) / 1000);

    try {
      await apiRequest("POST", "/api/call/end", {
        conversationId,
        duration,
      });
    } catch (error) {
      console.error("Error notifying call end:", error);
    }

    cleanup();
    onOpenChange(false);
  };

  const toggleMute = async () => {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();

    if (isMuted) {
      // Unmuting - check if we need to request permissions again
      if (audioTracks.length === 0 || audioTracks[0].readyState === "ended") {
        console.log(
          "[VideoCall] Audio track ended, requesting new permissions"
        );
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          const newAudioTrack = newStream.getAudioTracks()[0];

          // Replace the track in the peer connection
          if (peer) {
            const sender = peer._pc
              .getSenders()
              .find((s: RTCRtpSender) => s.track?.kind === "audio");
            if (sender) {
              await sender.replaceTrack(newAudioTrack);
            }
          }

          // Update local stream
          audioTracks.forEach((track) => track.stop());
          if (audioTracks[0]) {
            localStream.removeTrack(audioTracks[0]);
          }
          localStream.addTrack(newAudioTrack);

          setIsMuted(false);
          console.log("[VideoCall] Microphone unmuted with new permissions");
        } catch (error) {
          console.error("[VideoCall] Failed to get audio permissions:", error);
          toast({
            title: "Microphone Access Denied",
            description: "Please allow microphone access to unmute",
            variant: "destructive",
          });
        }
      } else {
        // Just enable the existing track
        audioTracks.forEach((track) => {
          track.enabled = true;
        });
        setIsMuted(false);
        console.log("[VideoCall] Microphone unmuted");
      }
    } else {
      // Muting - just disable the tracks
      audioTracks.forEach((track) => {
        track.enabled = false;
      });
      setIsMuted(true);
      console.log("[VideoCall] Microphone muted");
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;

    const videoTracks = localStream.getVideoTracks();

    if (isVideoOff) {
      // Turning video on - check if we need to request permissions again
      if (videoTracks.length === 0 || videoTracks[0].readyState === "ended") {
        console.log(
          "[VideoCall] Video track ended, requesting new permissions"
        );
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: getVideoConstraints().video,
          });
          const newVideoTrack = newStream.getVideoTracks()[0];

          // Replace the track in the peer connection
          if (peer) {
            const sender = peer._pc
              .getSenders()
              .find((s: RTCRtpSender) => s.track?.kind === "video");
            if (sender) {
              await sender.replaceTrack(newVideoTrack);
            } else {
              // Add track if sender doesn't exist
              peer.addTrack(newVideoTrack, localStream);
            }
          }

          // Update local stream
          localStream.addTrack(newVideoTrack);

          // Update local video element
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }

          setIsVideoOff(false);
          console.log("[VideoCall] Camera turned on with new permissions");
        } catch (error) {
          console.error("[VideoCall] Failed to get video permissions:", error);
          toast({
            title: "Camera Access Denied",
            description: "Please allow camera access to turn on video",
            variant: "destructive",
          });
        }
      } else {
        // Just enable the existing track
        videoTracks.forEach((track) => {
          track.enabled = true;
        });
        setIsVideoOff(false);
        console.log("[VideoCall] Camera turned on");
      }
    } else {
      // Turning video off - stop and remove tracks to free hardware resources
      videoTracks.forEach((track) => {
        track.stop();
        localStream.removeTrack(track);
      });

      // Replace with null track in peer connection
      if (peer) {
        const sender = peer._pc
          .getSenders()
          .find((s: RTCRtpSender) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(null);
        }
      }

      setIsVideoOff(true);
      console.log("[VideoCall] Camera turned off and hardware released");
    }
  };

  const togglePreCallVideo = () => {
    console.log("[VideoCall] Pre-call video toggle:", !preCallVideoEnabled);
    setPreCallVideoEnabled(!preCallVideoEnabled);
    if (cameraPermissionDenied && !preCallVideoEnabled) {
      toast({
        title: "Camera May Be Unavailable",
        description:
          "Camera access was denied earlier. You may need to refresh and grant permissions.",
      });
    }
  };

  const togglePreCallAudio = () => {
    console.log("[VideoCall] Pre-call audio toggle:", !preCallAudioEnabled);
    setPreCallAudioEnabled(!preCallAudioEnabled);
  };

  const acceptCall = () => {
    console.log("[VideoCall] 📞 RECEIVER accepting call...");
    console.log(
      "[VideoCall] State before accept - callAccepted:",
      callAccepted,
      "isRinging:",
      isRinging
    );
    setCallAccepted(true);
    setIsRinging(false);
    console.log(
      "[VideoCall] State updated - callAccepted: true, isRinging: false"
    );
  };

  const rejectCall = async () => {
    console.log("[VideoCall] Call rejected");
    setCallRejected(true);

    try {
      await apiRequest("POST", "/api/call/reject", {
        conversationId,
      });
    } catch (error) {
      console.error("[VideoCall] Error notifying call rejection:", error);
    }

    toast({
      title: "Call Declined",
      description: "You declined the call",
    });

    onOpenChange(false);
  };

  const formatDuration = (seconds: number) => {
    return formatCallDuration(seconds);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${
          isFullscreen ? "max-w-full h-screen" : "max-w-4xl"
        } p-0 border bg-card`}
        data-testid="dialog-video-call"
      >
        <VisuallyHidden>
          <DialogTitle>Video Call</DialogTitle>
          <DialogDescription>
            {isInitiator
              ? `Calling ${callerName}`
              : `Incoming call from ${callerName}`}
          </DialogDescription>
        </VisuallyHidden>
        <div className="relative w-full h-full min-h-[500px] bg-gradient-to-br from-background via-card to-background rounded-lg overflow-hidden">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              data-testid="video-remote"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 via-primary/5 to-background">
              <div className="text-center space-y-6">
                <div className="animate-pulse">
                  <Phone className="h-16 w-16 mx-auto text-primary" />
                </div>
                <p className="text-lg text-foreground font-semibold">
                  {isInitiator
                    ? `Calling ${callerName}...`
                    : `${callerName} is calling...`}
                </p>

                {/* Pre-call controls */}
                {isRinging && (
                  <div className="flex gap-3 justify-center items-center mt-6">
                    <Button
                      size="icon"
                      variant={
                        preCallAudioEnabled ? "secondary" : "destructive"
                      }
                      className="h-12 w-12 rounded-full"
                      onClick={togglePreCallAudio}
                      title={
                        preCallAudioEnabled
                          ? "Mute microphone"
                          : "Unmute microphone"
                      }
                    >
                      {preCallAudioEnabled ? (
                        <Mic className="h-5 w-5" />
                      ) : (
                        <MicOff className="h-5 w-5" />
                      )}
                    </Button>

                    <Button
                      size="icon"
                      variant={
                        preCallVideoEnabled ? "secondary" : "destructive"
                      }
                      className="h-12 w-12 rounded-full"
                      onClick={togglePreCallVideo}
                      title={
                        preCallVideoEnabled
                          ? "Turn off camera"
                          : "Turn on camera"
                      }
                      disabled={cameraPermissionDenied && !preCallVideoEnabled}
                    >
                      {preCallVideoEnabled ? (
                        <Video className="h-5 w-5" />
                      ) : (
                        <VideoOff className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                )}
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
            <div className="absolute top-4 left-4 bg-primary/90 backdrop-blur-sm px-3 py-1 rounded-full text-primary-foreground text-sm font-semibold shadow-lg">
              {formatDuration(callDuration)}
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
            {/* Incoming Call - Accept/Reject Buttons (Receiver Only) */}
            {!isInitiator && isRinging && !callAccepted && (
              <>
                <Button
                  size="icon"
                  variant="default"
                  className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg"
                  onClick={acceptCall}
                  data-testid="button-accept-call"
                  title="Accept call"
                >
                  <Phone className="h-6 w-6" />
                </Button>

                <Button
                  size="icon"
                  variant="destructive"
                  className="h-14 w-14 rounded-full"
                  onClick={rejectCall}
                  data-testid="button-reject-call"
                  title="Reject call"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Initiator Waiting - Only End Call Button */}
            {isInitiator && isRinging && !isConnected && (
              <Button
                size="icon"
                variant="destructive"
                className="h-14 w-14 rounded-full"
                onClick={endCall}
                data-testid="button-end-call"
                title="End call"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            )}

            {/* Active Call Controls - Full Controls */}
            {((isInitiator && isConnected) || (callAccepted && !isRinging)) && (
              <>
                <Button
                  size="icon"
                  variant={isMuted ? "destructive" : "secondary"}
                  className="h-12 w-12 rounded-full"
                  onClick={toggleMute}
                  data-testid="button-toggle-mute"
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                {callType === "video" && (
                  <Button
                    size="icon"
                    variant={isVideoOff ? "destructive" : "secondary"}
                    className="h-12 w-12 rounded-full"
                    onClick={toggleVideo}
                    data-testid="button-toggle-video"
                  >
                    {isVideoOff ? (
                      <VideoOff className="h-5 w-5" />
                    ) : (
                      <Video className="h-5 w-5" />
                    )}
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
                  {isFullscreen ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
