import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audioUrl: string;
  duration?: number;
  className?: string;
}

export function AudioPlayer({ audioUrl, duration, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(40).fill(0.3));
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(Math.floor(audio.duration));
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(Math.floor(audio.currentTime));
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    });

    // Generate static waveform (random pattern for visual appeal)
    const staticWaveform = Array.from({ length: 40 }, () => 0.2 + Math.random() * 0.8);
    setWaveformData(staticWaveform);

    return () => {
      audio.pause();
      audio.remove();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioUrl]);

  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error("Error playing audio:", error);
      }
    }
  };

  const handleWaveformClick = (index: number) => {
    if (!audioRef.current || !audioDuration) return;
    
    const clickPosition = index / waveformData.length;
    const newTime = clickPosition * audioDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(Math.floor(newTime));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? currentTime / audioDuration : 0;

  return (
    <div className={cn("flex items-center gap-2 min-w-[280px] max-w-md", className)} data-testid="audio-player">
      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayPause}
        className="flex-shrink-0 hover-elevate active-elevate-2"
        data-testid="button-play-pause-audio"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      {/* Waveform */}
      <div className="flex-1 flex items-center gap-0.5 h-12 cursor-pointer" data-testid="audio-waveform">
        {waveformData.map((value, index) => {
          const barProgress = index / waveformData.length;
          const isPlayed = barProgress <= progress;
          
          return (
            <div
              key={index}
              onClick={() => handleWaveformClick(index)}
              className={cn(
                "flex-1 rounded-full transition-all duration-100 hover-elevate",
                isPlayed ? "bg-primary" : "bg-muted"
              )}
              style={{
                height: `${Math.max(4, value * 48)}px`,
                opacity: isPlayed ? 0.8 : 0.4,
              }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 min-w-[35px]" data-testid="text-audio-duration">
        {formatTime(isPlaying ? currentTime : audioDuration)}
      </span>
    </div>
  );
}
