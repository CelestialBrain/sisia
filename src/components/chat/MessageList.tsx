import { useEffect, useRef } from "react";
import { Message } from "./Message";
import { Loader2, MessageCircle } from "lucide-react";
import { groupMessages, type ChatMessage } from "@/utils/messageGrouping";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  onScrollTop: () => void;
  currentUserId: string | null;
  readCounts: Record<string, number>;
  qpiPreferences: Record<string, boolean>;
}

export function MessageList({ 
  messages, 
  isLoading,
  isLoadingMore,
  onScrollTop, 
  currentUserId,
  readCounts,
  qpiPreferences
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const isAtBottom = useRef(true);
  const previousScrollHeight = useRef(0);

  // Auto-scroll to bottom on new messages (only if already at bottom)
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // If loading more (prepending), preserve scroll position
      if (isLoadingMore && previousScrollHeight.current > 0) {
        const heightDiff = scrollHeight - previousScrollHeight.current;
        scrollRef.current.scrollTop = scrollTop + heightDiff;
        previousScrollHeight.current = scrollHeight;
        return;
      }
      
      // Auto-scroll if within 150px of bottom or already at bottom
      if (distanceFromBottom < 150) {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }
        });
      }
      
      previousScrollHeight.current = scrollHeight;
    }
  }, [messages, isLoadingMore]);

  const handleScroll = () => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // Check if at bottom
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 50;

    // Load more when scrolled to top
    if (scrollTop === 0 && scrollTop < lastScrollTop.current) {
      onScrollTop();
    }

    lastScrollTop.current = scrollTop;
  };

  if (isLoading) {
    return (
      <div className="py-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-3 px-4">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 min-h-[400px]">
        <MessageCircle className="h-16 w-16 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-semibold mb-2">Start the Conversation</h3>
          <p className="text-sm text-muted-foreground">
            Be the first to send a message today!
          </p>
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessages(messages);

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="py-4 pb-4 space-y-0 overflow-y-auto flex-1 px-4"
    >
      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {groupedMessages.map((group) => (
        <div key={group.messages[0].id}>
          {group.messages.map((message, idx) => (
            <Message
              key={message.id}
              message={message}
              isOwn={message.user_id === currentUserId}
              isFirstInGroup={idx === 0}
              isLastInGroup={idx === group.messages.length - 1}
              readCount={readCounts[message.id] || 0}
              showQPI={qpiPreferences[message.user_id] ?? false}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
