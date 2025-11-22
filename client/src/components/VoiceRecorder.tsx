import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, X, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onRecordComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onRecordComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(40).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio context for waveform visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      // Start timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setDuration(seconds);
      }, 1000);
      
      // Start waveform animation
      visualizeAudio();
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      onCancel();
    }
  };

  const visualizeAudio = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const animate = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Sample 40 bars from the frequency data
      const bars = 40;
      const step = Math.floor(bufferLength / bars);
      const newWaveform = [];
      
      for (let i = 0; i < bars; i++) {
        const index = i * step;
        const value = dataArray[index] / 255; // Normalize to 0-1
        newWaveform.push(value);
      }
      
      setWaveformData(newWaveform);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordComplete(audioBlob, duration);
    } else {
      stopRecording();
      // Wait for blob to be created
      setTimeout(() => {
        if (audioBlob) {
          onRecordComplete(audioBlob, duration);
        }
      }, 100);
    }
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const handleDelete = () => {
    setAudioBlob(null);
    setDuration(0);
    startRecording();
  };

  const cleanup = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 w-full px-4 py-3 bg-card border-t" data-testid="voice-recorder">
      {/* Cancel Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCancel}
        data-testid="button-cancel-recording"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" data-testid="recording-indicator" />
          <span className="text-sm font-medium text-destructive" data-testid="text-recording-duration">
            {formatDuration(duration)}
          </span>
        </div>
      )}

      {/* Waveform Visualization */}
      <div className="flex-1 flex items-center justify-center gap-0.5 h-12" data-testid="waveform-visualization">
        {waveformData.map((value, index) => (
          <div
            key={index}
            className={cn(
              "w-1 bg-primary rounded-full transition-all duration-100",
              isRecording ? "animate-pulse" : ""
            )}
            style={{
              height: `${Math.max(4, value * 48)}px`,
              opacity: isRecording ? 0.6 + value * 0.4 : 0.3,
            }}
          />
        ))}
      </div>

      {/* Duration (when stopped) */}
      {!isRecording && audioBlob && (
        <span className="text-sm text-muted-foreground" data-testid="text-recorded-duration">
          {formatDuration(duration)}
        </span>
      )}

      {/* Delete Button (when stopped) */}
      {!isRecording && audioBlob && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          data-testid="button-delete-recording"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      )}

      {/* Stop/Send Button */}
      {isRecording ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={stopRecording}
          data-testid="button-stop-recording"
        >
          <div className="w-5 h-5 bg-destructive rounded-sm" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSend}
          className="text-primary"
          data-testid="button-send-recording"
        >
          <Send className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
