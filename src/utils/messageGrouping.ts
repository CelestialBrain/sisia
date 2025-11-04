export interface ChatMessage {
  id: string;
  user_id: string | null;
  display_name: string;
  message_content: string | null;
  message_type: 'text' | 'image' | 'file' | 'voice';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  program_name: string | null;
  cumulative_qpi: number | null;
  created_at: string;
  updated_at: string;
}

export interface MessageGroup {
  userId: string | null;
  displayName: string;
  programName: string | null;
  cumulativeQpi: number | null;
  messages: ChatMessage[];
}

export function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  messages.forEach((message) => {
    const shouldStartNewGroup = 
      !currentGroup || 
      currentGroup.userId !== message.user_id ||
      // Start new group if more than 5 minutes between messages
      (currentGroup.messages.length > 0 && 
       new Date(message.created_at).getTime() - 
       new Date(currentGroup.messages[currentGroup.messages.length - 1].created_at).getTime() > 300000);

    if (shouldStartNewGroup) {
      currentGroup = {
        userId: message.user_id,
        displayName: message.display_name,
        programName: message.program_name,
        cumulativeQpi: message.cumulative_qpi,
        messages: [message]
      };
      groups.push(currentGroup);
    } else {
      currentGroup!.messages.push(message);
    }
  });

  return groups;
}
