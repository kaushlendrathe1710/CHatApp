import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import SimplePeer from "simple-peer";
import {
  getICEServers,
  formatCallDuration,
  getAudioConstraints,
} from "@/lib/webrtc";
import { apiRequest } from "@/lib/queryClient";

interface AudioCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  isInitiator: boolean;
  onSignal: (signal: any) => void;
  incomingSignal?: any;
  callerName?: string;
  callerAvatar?: string;
}

export function AudioCallDialog({
  open,
  onOpenChange,
  conversationId,
  isInitiator,
  onSignal,
  incomingSignal,
  callerName = "Unknown",
  callerAvatar,
}: AudioCallDialogProps) {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isRinging, setIsRinging] = useState(true);
  const [callAccepted, setCallAccepted] = useState(isInitiator); // Initiator auto-accepts
  const [callRejected, setCallRejected] = useState(false);
  const [pendingSignal, setPendingSignal] = useState<any>(null);
  const processedSignals = useRef<Set<string>>(new Set());

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const callStartTime = useRef<number>(0);
  const callTimer = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Store pending signal for receiver before peer is created
  useEffect(() => {
    console.log(
      "[AudioCall] Pending signal storage check - incomingSignal:",
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
        "[AudioCall] ✅ Storing pending signal for receiver:",
        cleanSignal.type
      );
      setPendingSignal(cleanSignal);
    }
  }, [incomingSignal, peer, isInitiator, callAccepted]);

  // Play ringtone for incoming calls
  useEffect(() => {
    if (
      open &&
      !isInitiator &&
      isRinging &&
      !callAccepted &&
      ringtoneRef.current
    ) {
      console.log("[AudioCall] Playing ringtone for incoming call");
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch((err) => {
        console.warn("[AudioCall] Could not play ringtone:", err);
      });
    } else if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    };
  }, [open, isInitiator, isRinging, callAccepted]);

  // Initialize call when dialog opens AND call is accepted
  useEffect(() => {
    console.log(
      `[AudioCall] Effect triggered - open: ${open}, callAccepted: ${callAccepted}, callRejected: ${callRejected}, isInitiator: ${isInitiator}`
    );

    // For initiator, auto-accept if not already accepted
    if (open && isInitiator && !callAccepted && !callRejected) {
      console.log("[AudioCall] Auto-accepting for initiator");
      setCallAccepted(true);
      return;
    }

    if (open && callAccepted && !callRejected) {
      console.log(
        `[AudioCall] Initializing call as ${
          isInitiator ? "initiator" : "receiver"
        }`
      );
      initializeCall();
      callStartTime.current = Date.now();

      // Start call duration timer
      callTimer.current = setInterval(() => {
        setCallDuration(
          Math.floor((Date.now() - callStartTime.current) / 1000)
        );
      }, 1000);

      return () => {
        if (callTimer.current) {
          clearInterval(callTimer.current);
        }
      };
    } else if (!open) {
      cleanup();
    }
  }, [open, callAccepted, callRejected, isInitiator]);

  // Connect remote audio stream to audio element
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((error) => {
        console.error("Error playing remote audio:", error);
      });
    }
  }, [remoteStream]);

  // Handle incoming signals (offers, answers, ICE candidates)
  useEffect(() => {
    if (!incomingSignal || !peer) return;

    // Remove timestamp if present and create clean signal
    const { _timestamp, ...cleanSignal } = incomingSignal;
    const signalKey = JSON.stringify(cleanSignal);

    if (processedSignals.current.has(signalKey)) {
      console.log(
        "[AudioCall] Signal already processed, skipping:",
        cleanSignal.type
      );
      return;
    }

    // Peer is ready, signal immediately
    try {
      console.log("[AudioCall] Processing incoming signal:", cleanSignal.type);
      peer.signal(cleanSignal);
      processedSignals.current.add(signalKey);
      console.log(
        "[AudioCall] ✅ Signal processed successfully:",
        cleanSignal.type
      );
    } catch (error) {
      console.error("[AudioCall] ❌ Error signaling peer:", error);
      toast({
        title: "Connection Error",
        description: "Failed to process connection data",
        variant: "destructive",
      });
    }
  }, [peer, incomingSignal, toast]);

  const initializeCall = async () => {
    try {
      console.log("[AudioCall] Starting initializeCall...");
      // Get audio stream with high-quality constraints
      const constraints = getAudioConstraints();
      console.log(
        "[AudioCall] Requesting audio with constraints:",
        constraints
      );
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log(
        "[AudioCall] Got local stream with",
        stream.getAudioTracks().length,
        "audio tracks"
      );
      setLocalStream(stream);

      // Get WebRTC configuration with STUN/TURN servers
      const iceServers = await getICEServers();
      console.log("[AudioCall] Got ICE servers:", iceServers.length, "servers");

      console.log(
        "[AudioCall] Creating SimplePeer as",
        isInitiator ? "initiator" : "receiver"
      );
      const p = new SimplePeer({
        initiator: isInitiator,
        trickle: false,
        stream: stream,
        config: {
          iceServers,
          iceCandidatePoolSize: 10,
        },
      });

      // Handle signaling
      p.on("signal", (data) => {
        console.log(
          `[AudioCall] ${
            isInitiator ? "📤 INITIATOR" : "📥 RECEIVER"
          } Generated signal:`,
          data.type
        );
        console.log(
          `[AudioCall] Current state - isRinging: ${isRinging}, isConnected: ${isConnected}`
        );
        onSignal(data);
      });

      // Handle incoming stream
      p.on("stream", (stream) => {
        console.log(
          `[AudioCall] ${
            isInitiator ? "📤 INITIATOR" : "📥 RECEIVER"
          } Received remote stream with`,
          stream.getTracks().length,
          "tracks"
        );
        setRemoteStream(stream);
        setIsConnected(true);
        setIsRinging(false);
        console.log(
          "[AudioCall] ✅ Call connected - isRinging set to false, isConnected set to true"
        );
      });

      // Handle connection
      p.on("connect", () => {
        console.log(
          `[AudioCall] ${
            isInitiator ? "📤 INITIATOR" : "📥 RECEIVER"
          } ✅ Peer connection established!`
        );
        setIsConnected(true);
        setIsRinging(false);
      });

      // Handle errors
      p.on("error", (err) => {
        console.error("[AudioCall] Peer error:", err);

        // Provide user-friendly error messages
        let errorMessage = "Connection failed";
        if (err.message.includes("Ice connection failed")) {
          errorMessage =
            "Unable to establish connection. Please check your network.";
        } else if (err.message.includes("Data channel error")) {
          errorMessage = "Connection lost";
        }

        toast({
          title: "Call Error",
          description: errorMessage,
          variant: "destructive",
        });

        endCall();
      });

      // Handle connection close
      p.on("close", () => {
        console.log("[AudioCall] Connection closed");
        endCall();
      });

      // Process any pending signal that arrived before peer was ready
      console.log("[AudioCall] Checking for signals to process...");
      console.log(
        "[AudioCall] pendingSignal:",
        pendingSignal ? pendingSignal.type : "null"
      );
      console.log(
        "[AudioCall] incomingSignal:",
        incomingSignal ? incomingSignal.type : "null"
      );

      const signalToProcess = pendingSignal || incomingSignal;
      if (signalToProcess) {
        const { _timestamp, ...cleanSignal } = signalToProcess;
        console.log(
          "[AudioCall] Processing signal after peer creation:",
          cleanSignal.type
        );
        const signalKey = JSON.stringify(cleanSignal);
        processedSignals.current.add(signalKey);
        p.signal(cleanSignal);
        setPendingSignal(null);
        console.log(
          "[AudioCall] ✅ Initial signal processed:",
          cleanSignal.type
        );
      } else {
        console.log(
          "[AudioCall] ⚠️ No signal to process! This will prevent connection."
        );
      }

      setPeer(p);

      console.log(
        "[AudioCall] Peer initialized as",
        isInitiator ? "initiator" : "receiver"
      );
    } catch (error) {
      console.error("[AudioCall] Error initializing call:", error);

      let errorMessage = "Failed to access microphone";
      if (error instanceof Error) {
        if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          errorMessage =
            "Microphone access denied. Please allow microphone permission.";
        } else if (error.name === "NotFoundError") {
          errorMessage = "No microphone found. Please connect a microphone.";
        }
      }

      toast({
        title: "Permission Error",
        description: errorMessage,
        variant: "destructive",
      });

      endCall();
    }
  };

  const cleanup = () => {
    console.log("[AudioCall] Cleaning up resources");

    // Stop call timer
    if (callTimer.current) {
      clearInterval(callTimer.current);
      callTimer.current = null;
    }

    // Destroy peer connection
    if (peer) {
      peer.destroy();
      setPeer(null);
    }

    // Stop local media tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        console.log("[AudioCall] Stopped track:", track.kind);
      });
      setLocalStream(null);
    }

    // Clear remote stream
    if (remoteStream) {
      setRemoteStream(null);
    }

    // Reset state
    setIsConnected(false);
    setCallDuration(0);
    setIsRinging(true);
    setIsMuted(false);
    setPendingSignal(null);
    processedSignals.current.clear();
  };

  const endCall = async () => {
    const duration = Math.floor((Date.now() - callStartTime.current) / 1000);

    console.log("[AudioCall] Ending call, duration:", duration);

    // Notify backend about call end
    try {
      await apiRequest("POST", "/api/call/end", {
        conversationId,
        duration,
      });
    } catch (error) {
      console.error("[AudioCall] Error notifying call end:", error);
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
          "[AudioCall] Audio track ended, requesting new permissions"
        );
        try {
          const audioConstraints = getAudioConstraints();
          const newStream = await navigator.mediaDevices.getUserMedia(
            audioConstraints
          );
          const newAudioTrack = newStream.getAudioTracks()[0];

          // Replace the track in the peer connection
          if (peer && (peer as any)._pc) {
            const sender = (peer as any)._pc
              .getSenders()
              .find((s: RTCRtpSender) => s.track?.kind === "audio");
            if (sender) {
              await sender.replaceTrack(newAudioTrack);
            }
          }

          // Update local stream
          audioTracks.forEach((track) => track.stop());
          localStream.removeTrack(audioTracks[0]);
          localStream.addTrack(newAudioTrack);

          setIsMuted(false);
          console.log("[AudioCall] Microphone unmuted with new permissions");
        } catch (error) {
          console.error("[AudioCall] Failed to get audio permissions:", error);
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
        console.log("[AudioCall] Microphone unmuted");
      }
    } else {
      // Muting - just disable the tracks
      audioTracks.forEach((track) => {
        track.enabled = false;
      });
      setIsMuted(true);
      console.log("[AudioCall] Microphone muted");
    }
  };

  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isSpeakerOn;
      setIsSpeakerOn(!isSpeakerOn);
      console.log("[AudioCall] Speaker", !isSpeakerOn ? "on" : "off");
    }
  };

  const acceptCall = () => {
    console.log("[AudioCall] 📞 RECEIVER accepting call...");
    console.log(
      "[AudioCall] State before accept - callAccepted:",
      callAccepted,
      "isRinging:",
      isRinging
    );
    setCallAccepted(true);
    setIsRinging(false);
    console.log(
      "[AudioCall] State updated - callAccepted: true, isRinging: false"
    );
  };

  const rejectCall = async () => {
    console.log("[AudioCall] Call rejected");
    setCallRejected(true);

    // Notify the caller that call was rejected
    try {
      await apiRequest("POST", "/api/call/reject", {
        conversationId,
      });
    } catch (error) {
      console.error("[AudioCall] Error notifying call rejection:", error);
    }

    // Show message to receiver
    toast({
      title: "Call Declined",
      description: "You declined the call",
    });

    onOpenChange(false);
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            endCall();
          }
        }}
      >
        <DialogContent
          className="max-w-md p-0 border bg-card overflow-hidden"
          data-testid="dialog-audio-call"
        >
          <VisuallyHidden>
            <DialogTitle>Audio Call</DialogTitle>
            <DialogDescription>
              {isInitiator
                ? `Calling ${callerName}`
                : `Incoming call from ${callerName}`}
            </DialogDescription>
          </VisuallyHidden>
          <div className="relative w-full h-[500px] flex flex-col items-center justify-between p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
            {/* Call Status */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
              {/* Avatar */}
              <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-xl">
                <AvatarImage src={callerAvatar} alt={callerName} />
                <AvatarFallback className="text-3xl bg-primary/10 text-foreground">
                  {getInitials(callerName)}
                </AvatarFallback>
              </Avatar>

              {/* Caller Name */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  {callerName}
                </h2>

                {/* Call Status */}
                {isRinging && (
                  <p className="text-lg text-muted-foreground animate-pulse">
                    {isInitiator ? "Calling..." : "Incoming call..."}
                  </p>
                )}

                {isConnected && (
                  <p className="text-lg text-primary font-mono font-semibold">
                    {formatCallDuration(callDuration)}
                  </p>
                )}
              </div>

              {/* Connection Status Indicator */}
              {!isConnected && !isRinging && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin h-4 w-4 border-2 border-muted-foreground/30 border-t-primary rounded-full" />
                  <span>Connecting...</span>
                </div>
              )}
            </div>

            {/* Call Controls */}
            <div className="flex gap-4 justify-center items-center">
              {/* Incoming Call - Accept/Reject Buttons (Receiver Only) */}
              {!isInitiator && isRinging && !callAccepted && (
                <>
                  <Button
                    size="icon"
                    variant="default"
                    className="h-16 w-16 rounded-full shadow-xl hover:scale-110 transition-transform bg-primary hover:bg-primary/90"
                    onClick={acceptCall}
                    data-testid="button-accept-call"
                    title="Accept call"
                  >
                    <Phone className="h-7 w-7" />
                  </Button>

                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-16 w-16 rounded-full shadow-xl hover:scale-110 transition-transform"
                    onClick={rejectCall}
                    data-testid="button-reject-call"
                    title="Reject call"
                  >
                    <PhoneOff className="h-7 w-7" />
                  </Button>
                </>
              )}

              {/* Initiator Waiting - Only End Call Button */}
              {isInitiator && isRinging && !isConnected && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-16 w-16 rounded-full shadow-xl hover:scale-110 transition-transform"
                  onClick={endCall}
                  data-testid="button-end-call"
                  title="End call"
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>
              )}

              {/* Active Call Controls - Full Controls */}
              {((isInitiator && isConnected) ||
                (callAccepted && !isRinging)) && (
                <>
                  {/* Mute Button */}
                  <Button
                    size="icon"
                    variant={isMuted ? "destructive" : "secondary"}
                    className="h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform"
                    onClick={toggleMute}
                    data-testid="button-toggle-mute"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <MicOff className="h-6 w-6" />
                    ) : (
                      <Mic className="h-6 w-6" />
                    )}
                  </Button>

                  {/* End Call Button */}
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-16 w-16 rounded-full shadow-xl hover:scale-110 transition-transform"
                    onClick={endCall}
                    data-testid="button-end-call"
                    title="End call"
                  >
                    <PhoneOff className="h-7 w-7" />
                  </Button>

                  {/* Speaker Button */}
                  <Button
                    size="icon"
                    variant={!isSpeakerOn ? "destructive" : "secondary"}
                    className="h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform"
                    onClick={toggleSpeaker}
                    data-testid="button-toggle-speaker"
                    title={isSpeakerOn ? "Mute speaker" : "Unmute speaker"}
                  >
                    {isSpeakerOn ? (
                      <Volume2 className="h-6 w-6" />
                    ) : (
                      <VolumeX className="h-6 w-6" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Ringtone for incoming calls - using a simple beep tone */}
      <audio ref={ringtoneRef} loop>
        <source
          src="data:audio/wav;base64,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"
          type="audio/wav"
        />
      </audio>
    </>
  );
}
