import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChatTimer } from "@/components/chat/ChatTimer";
import { OnlineUsersIndicator } from "@/components/chat/OnlineUsersIndicator";
import { MessageList } from "@/components/chat/MessageList";
import { TypingIndicators } from "@/components/chat/TypingIndicators";
import { ChatInput } from "@/components/chat/ChatInput";
import { filterProfanity } from "@/utils/profanityFilter";
import { RateLimiter } from "@/utils/rateLimiter";
import type { ChatMessage } from "@/utils/messageGrouping";
import { calculateQPI } from "@/utils/qpiCalculations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { useClientLogger } from "@/hooks/useClientLogger";

const rateLimiter = new RateLimiter();

export default function Chat() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastTypingTime = useRef(0);
  const PAGE_SIZE = 50;
  const [uploadingFile, setUploadingFile] = useState<{
    type: 'image' | 'file' | 'voice';
    fileName?: string;
    aspectRatio?: number;
  } | null>(null);

  const { logNetworkRequest } = useClientLogger();

  // Fetch user's program and QPI
  const { data: enrollment } = useQuery({
    queryKey: ['active-enrollment', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('program_enrollments')
        .select('*, programs(name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
      return data;
    },
    enabled: !!user && !isGuest
  });

  const { data: userCourses } = useQuery({
    queryKey: ['user-courses-qpi', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('user_courses')
        .select('*')
        .eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user && !isGuest
  });

  const cumulativeQPI = userCourses ? calculateQPI(userCourses).cumulativeQPI : null;

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages'],
    queryFn: async () => {
      const start = performance.now();
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        if (error) {
          const duration = performance.now() - start;
          logNetworkRequest('GET', `/chat_messages?initial=true&limit=${PAGE_SIZE}`, 500, duration, { error: error.message });
          throw error;
        }

        setHasMore((data?.length || 0) === PAGE_SIZE);

        const result = ((data || []) as ChatMessage[]).reverse();
        const duration = performance.now() - start;
        logNetworkRequest('GET', `/chat_messages?initial=true&limit=${PAGE_SIZE}`, 200, duration, { count: result.length, source: 'initial' });
        return result;
      } catch (e: any) {
        const duration = performance.now() - start;
        logNetworkRequest('GET', `/chat_messages?initial=true&limit=${PAGE_SIZE}`, 500, duration, { error: e?.message || String(e) });
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes after unmount
    refetchOnWindowFocus: false, // Don't refetch when returning to tab
    refetchOnMount: false, // Don't refetch on mount if we have cached data
    refetchInterval: 5000 // Still refresh while on page for new messages
  });

  // Fetch read counts
  const { data: readCounts = {} } = useQuery({
    queryKey: ['chat-read-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_read_receipts')
        .select('message_id');
      
      const counts: Record<string, number> = {};
      data?.forEach(receipt => {
        counts[receipt.message_id] = (counts[receipt.message_id] || 0) + 1;
      });
      
      return counts;
    },
    refetchInterval: 2000 // Ultra-fast refresh
  });

  // Fetch online users
  useQuery({
    queryKey: ['chat-online-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_online_users')
        .select('user_id');
      
      setOnlineCount(data?.length || 0);
      return data;
    },
    refetchInterval: 5000 // Fast refresh for online status
  });

  // Fetch typing users
  useQuery({
    queryKey: ['chat-typing'],
    queryFn: async () => {
      // Guard: Only query if user is authenticated and has valid ID
      if (!user?.id || isGuest) {
        setTypingUsers([]);
        return [];
      }
      
      const { data } = await supabase
        .from('chat_typing_indicators')
        .select('display_name, user_id')
        .neq('user_id', user.id);
      
      setTypingUsers(data?.map(t => t.display_name) || []);
      return data;
    },
    enabled: !!user?.id && !isGuest,
    refetchInterval: 2000 // Refresh every 2s
  });

  // Fetch latest user profile data
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user && !isGuest,
    refetchInterval: 10000 // Check for profile updates every 10 seconds
  });

  // Fetch all user profiles to get QPI badge preferences
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['chat-user-profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, show_on_leaderboard');
      return data || [];
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Create a map of user_id to showQPI preference
  const qpiPreferences = allProfiles.reduce((acc, profile) => {
    acc[profile.id] = profile.show_on_leaderboard ?? false;
    return acc;
  }, {} as Record<string, boolean>);

  // Update online presence
  useEffect(() => {
    if (!user || isGuest) return;

    const updatePresence = async () => {
      const displayName = userProfile?.display_name || user.user_metadata?.display_name || 'Anonymous';
      await supabase
        .from('chat_online_users')
        .upsert({
          user_id: user.id,
          display_name: displayName,
          last_seen_at: new Date().toISOString()
        });
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000);

    return () => {
      clearInterval(interval);
      supabase
        .from('chat_online_users')
        .delete()
        .eq('user_id', user.id)
        .then(() => {});
    };
  }, [user, isGuest, userProfile]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          console.log('[Chat] Realtime INSERT:', newMessage.id, 'from user:', newMessage.user_id);
          
          // Skip duplicates for own messages (optimistic update already showed it)
          if (user && newMessage.user_id === user.id) {
            // Replace temp optimistic message with real one
            queryClient.setQueryData(['chat-messages'], (old: ChatMessage[] | undefined) => {
              if (!old) {
                console.log('[Chat] No old messages, adding new one');
                return [newMessage];
              }
              
              // Check if this exact message already exists (prevent duplicates)
              const existingIndex = old.findIndex(msg => msg.id === newMessage.id);
              if (existingIndex !== -1) {
                console.log('[Chat] Message already exists, skipping');
                return old;
              }
              
              // Remove ALL temp messages and add the real one
              const withoutTemp = old.filter(msg => !msg.id.toString().startsWith('temp-'));
              console.log('[Chat] Removed', old.length - withoutTemp.length, 'temp messages');
              return [...withoutTemp, newMessage];
            });
            return;
          }
          
          // For other users' messages, add if not duplicate
          queryClient.setQueryData(['chat-messages'], (old: ChatMessage[] | undefined) => {
            if (!old) return [newMessage];
            // Prevent duplicates by checking if message already exists
            if (old.some(msg => msg.id === newMessage.id)) {
              console.log('[Chat] Other user message already exists, skipping');
              return old;
            }
            console.log('[Chat] Adding other user message');
            return [...old, newMessage];
          });
          
          // Mark as read if not own message
          if (user && payload.new.user_id !== user.id) {
            supabase
              .from('chat_read_receipts')
              .insert({
                message_id: payload.new.id,
                user_id: user.id
              })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['chat-read-counts'] });
              });
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_online_users' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-online-users'] });
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_typing_indicators' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-typing'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const handleTyping = useCallback(async () => {
    if (!user || isGuest) return;
    
    const now = Date.now();
    if (now - lastTypingTime.current < 2000) return; // Debounce
    
    lastTypingTime.current = now;

    await supabase
      .from('chat_typing_indicators')
      .upsert({
        user_id: user.id,
        display_name: user.user_metadata?.display_name || 'Anonymous',
        started_typing_at: new Date().toISOString()
      });

    // Auto-remove after 3 seconds
    setTimeout(async () => {
      await supabase
        .from('chat_typing_indicators')
        .delete()
        .eq('user_id', user.id);
    }, 3000);
  }, [user, isGuest]);

  const sendMessage = async (content: string, type: 'text' | 'image' | 'file' | 'voice' = 'text', fileUrl?: string, fileName?: string, fileSize?: number) => {
    if (!user || isGuest) {
      toast.error('Please sign in to send messages');
      return;
    }

    const rateCheck = rateLimiter.canSendMessage();
    if (!rateCheck.allowed) {
      toast.error(rateCheck.reason);
      return;
    }

    // Fetch fresh user metadata to get current display name
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const currentDisplayName = currentUser?.user_metadata?.display_name || 'Anonymous';

    const filteredContent = type === 'text' ? filterProfanity(content) : content;

    // Optimistic update - instantly show message
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}-${Math.random()}`,
      user_id: user.id,
      display_name: currentDisplayName,
      message_content: filteredContent,
      message_type: type,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_size: fileSize || null,
      program_name: enrollment?.programs?.name || null,
      cumulative_qpi: cumulativeQPI,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[Chat] Sending message with optimistic ID:', optimisticMessage.id);
    queryClient.setQueryData(['chat-messages'], (old: ChatMessage[] | undefined) => {
      if (!old) return [optimisticMessage];
      return [...old, optimisticMessage];
    });

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        display_name: currentDisplayName,
        message_content: filteredContent,
        message_type: type,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        program_name: enrollment?.programs?.name || null,
        cumulative_qpi: cumulativeQPI
      });

    if (error) {
      console.error('[Chat] Send message error:', error);
      toast.error('Failed to send message');
      // Remove optimistic message on error
      queryClient.setQueryData(['chat-messages'], (old: ChatMessage[] | undefined) => {
        if (!old) return [];
        return old.filter(msg => msg.id !== optimisticMessage.id);
      });
    } else {
      console.log('[Chat] Message sent successfully');
    }
  };

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;

    // Get image dimensions if it's an image
    let aspectRatio: number | undefined;
    if (file.type.startsWith('image/')) {
      aspectRatio = await getImageAspectRatio(file);
      setUploadingFile({ type: 'image', fileName: file.name, aspectRatio });
    } else {
      setUploadingFile({ type: 'file', fileName: file.name });
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data, error } = await supabase.functions.invoke('chat-upload', {
        body: formData,
      });

      if (error || !data) {
        toast.error('Failed to upload file');
        return;
      }

      const messageType = file.type.startsWith('image/') ? 'image' : 'file';
      await sendMessage('', messageType, data.url, data.fileName, data.size);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(null);
    }
  };

  const getImageAspectRatio = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve(img.width / img.height);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => resolve(16 / 9); // Default aspect ratio
      img.src = URL.createObjectURL(file);
    });
  };

  const handleVoiceUpload = async (blob: Blob) => {
    if (!user) return;

    setUploadingFile({ type: 'voice' });

    const formData = new FormData();
    formData.append('file', blob, 'voice-message.webm');

    try {
      const { data, error } = await supabase.functions.invoke('chat-upload', {
        body: formData,
      });

      if (error || !data) {
        toast.error('Failed to upload voice message');
        return;
      }

      await sendMessage('', 'voice', data.url, 'Voice Message', data.size);
    } catch (error) {
      console.error('Voice upload error:', error);
      toast.error('Failed to upload voice message');
    } finally {
      setUploadingFile(null);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);

    const current = (queryClient.getQueryData<ChatMessage[]>(['chat-messages']) || []);
    const oldest = current[0];
    const before = oldest?.created_at || new Date().toISOString();
    const start = performance.now();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .lt('created_at', before)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    const duration = performance.now() - start;

    if (error) {
      console.error('[Chat] loadMoreMessages error:', error);
      logNetworkRequest('GET', `/chat_messages?before=${encodeURIComponent(before)}&limit=${PAGE_SIZE}`, 500, duration, { error: error.message });
      setIsLoadingMore(false);
      return;
    }

    logNetworkRequest('GET', `/chat_messages?before=${encodeURIComponent(before)}&limit=${PAGE_SIZE}`, 200, duration, { count: data?.length || 0 });

    const older = (data || []).reverse() as ChatMessage[];

    queryClient.setQueryData(['chat-messages'], (old: ChatMessage[] | undefined) => {
      const base = old || [];
      // Deduplicate by id
      const existingIds = new Set(base.map(m => m.id));
      const toPrepend = older.filter(m => !existingIds.has(m.id));
      return [...toPrepend, ...base];
    });

    if ((data?.length || 0) < PAGE_SIZE) setHasMore(false);
    setIsLoadingMore(false);
  };

  const downloadChat = async () => {
    try {
      // Fetch all messages
      const { data: allMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Export - ${format(new Date(), 'MMM dd, yyyy')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .message {
      background: white;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 14px;
    }
    .display-name {
      font-weight: 600;
      color: #1a1a1a;
    }
    .program {
      color: #666;
      font-size: 12px;
    }
    .qpi {
      background: #3b82f6;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .timestamp {
      color: #999;
      font-size: 12px;
      margin-left: auto;
    }
    .message-content {
      color: #333;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .message-type {
      color: #666;
      font-style: italic;
      font-size: 14px;
    }
    img {
      max-width: 100%;
      border-radius: 8px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Community Chat Export</h1>
    <p>Exported on ${format(new Date(), 'MMMM dd, yyyy \'at\' h:mm a')}</p>
    <p>Total Messages: ${allMessages?.length || 0}</p>
  </div>
  ${allMessages?.map(msg => `
    <div class="message">
      <div class="message-header">
        <span class="display-name">${msg.display_name}</span>
        ${msg.program_name ? `<span class="program">${msg.program_name}</span>` : ''}
        ${msg.cumulative_qpi ? `<span class="qpi">QPI: ${Number(msg.cumulative_qpi).toFixed(2)}</span>` : ''}
        <span class="timestamp">${format(new Date(msg.created_at), 'MMM dd, h:mm a')}</span>
      </div>
      <div class="message-content">
        ${msg.message_type === 'text' ? msg.message_content : ''}
        ${msg.message_type === 'image' ? `<div class="message-type">[Image: ${msg.file_name}]</div><img src="${msg.file_url}" alt="${msg.file_name}" />` : ''}
        ${msg.message_type === 'file' ? `<div class="message-type">[File: ${msg.file_name}]</div>` : ''}
        ${msg.message_type === 'voice' ? `<div class="message-type">[Voice Message]</div>` : ''}
      </div>
    </div>
  `).join('')}
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-${format(new Date(), 'yyyy-MM-dd')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Chat exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export chat');
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col overflow-hidden h-[calc(100dvh-12rem+15px)] lg:h-[calc(100dvh-7rem)]">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Community Chat</h1>
        <p className="text-muted-foreground">Connect with fellow students in real-time. All messages reset daily at 8 AM PHT.</p>
      </div>

      <Card className="flex flex-col overflow-hidden pb-0 flex-1">
        <ChatTimer />
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <OnlineUsersIndicator count={onlineCount} />
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadChat}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export Chat</span>
          </Button>
        </div>
        
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          onScrollTop={loadMoreMessages}
          currentUserId={user?.id || null}
          readCounts={readCounts}
          qpiPreferences={qpiPreferences}
        />
        
        <TypingIndicators typingUsers={typingUsers} />
        
        <ChatInput
          disabled={isGuest}
          value={inputMessage}
          onChange={setInputMessage}
          onSend={handleSend}
          onFileUpload={handleFileUpload}
          onVoiceUpload={handleVoiceUpload}
          onTyping={handleTyping}
        />
      </Card>
    </div>
  );
}
