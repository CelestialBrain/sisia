import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface VoiceRecorderProps {
  onSend: (blob: Blob) => void;
}

export function VoiceRecorder({ onSend }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_DURATION = 60; // 60 seconds

  // Manage object URL lifecycle
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setAudioUrl(null);
      };
    }
  }, [audioBlob]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        chunksRef.current = [];
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  };

  const sendRecording = () => {
    if (audioBlob) {
      onSend(audioBlob);
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
    }
  };

  return (
    <Popover open={isRecording || !!audioBlob}>
      <PopoverTrigger asChild>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={startRecording} 
          title="Record voice message"
          disabled={isRecording || !!audioBlob}
        >
          <Mic className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="end"
        alignOffset={-40}
        className={`${audioBlob ? 'w-[260px] sm:w-[280px]' : 'w-[280px] sm:w-[320px]'} max-w-[95vw] p-3`}
        onInteractOutside={(e) => {
          if (isRecording || audioBlob) {
            e.preventDefault();
          }
        }}
      >
        {isRecording ? (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium tabular-nums">
                {duration}s / {MAX_DURATION}s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" className="h-8 w-8" variant="ghost" onClick={cancelRecording}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="icon" className="h-8 w-8" variant="default" onClick={stopRecording}>
                <Square className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : audioBlob && audioUrl ? (
          <div className="flex flex-col gap-2">
            <audio 
              src={audioUrl} 
              controls 
              preload="metadata"
              className="w-full"
            />
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelRecording}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="default" onClick={sendRecording}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
