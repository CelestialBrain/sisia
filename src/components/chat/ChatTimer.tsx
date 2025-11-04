import { Clock } from "lucide-react";
import { useChatTimer } from "@/hooks/useChatTimer";

export function ChatTimer() {
  const { timeLeft } = useChatTimer();
  
  return (
    <div className="bg-muted/50 border-b px-4 py-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>Chat resets in {timeLeft}</span>
    </div>
  );
}
