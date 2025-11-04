import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause } from "lucide-react";

interface VoicePlayerProps {
  url: string;
}

export function VoicePlayer({ url }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset state when URL changes
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(false);

    const handleLoadedMetadata = () => {
      const audioDuration = audio.duration;
      if (!isNaN(audioDuration) && isFinite(audioDuration)) {
        setDuration(audioDuration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError(true);
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    // Force reload when URL changes
    audio.load();

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [url]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error playing audio:', err);
      setError(true);
      setIsPlaying(false);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingTime = duration - currentTime;

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 rounded-lg p-2 md:p-3 min-w-[200px] md:min-w-[240px] max-w-[280px] md:max-w-[320px]">
        <span className="text-xs text-destructive">Failed to load audio</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 md:gap-3 bg-muted/50 rounded-lg p-2 md:p-3 min-w-[200px] md:min-w-[240px] max-w-[280px] md:max-w-[320px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      
      <Button
        size="icon"
        variant="ghost"
        onClick={togglePlayPause}
        className="h-8 w-8 shrink-0"
        disabled={!duration}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <div className="flex-1 space-y-1">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSliderChange}
          className="cursor-pointer"
          disabled={!duration}
        />
        <div className="flex justify-center text-xs text-muted-foreground">
          <span>{formatTime(remainingTime)}</span>
        </div>
      </div>
    </div>
  );
}
