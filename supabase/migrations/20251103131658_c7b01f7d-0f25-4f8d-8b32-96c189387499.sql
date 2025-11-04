-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  message_content TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'file', 'voice')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  program_name TEXT,
  cumulative_qpi NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);

-- Create chat_read_receipts table
CREATE TABLE chat_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_read_receipts_message ON chat_read_receipts(message_id);

-- Create chat_typing_indicators table
CREATE TABLE chat_typing_indicators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  started_typing_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create chat_online_users table
CREATE TABLE chat_online_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages" ON chat_messages 
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert messages" ON chat_messages 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own messages" ON chat_messages 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON chat_messages 
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_read_receipts
ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read receipts" ON chat_read_receipts 
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert receipts" ON chat_read_receipts 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for chat_typing_indicators
ALTER TABLE chat_typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read typing" ON chat_typing_indicators 
  FOR SELECT USING (true);

CREATE POLICY "Users manage own typing" ON chat_typing_indicators 
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for chat_online_users
ALTER TABLE chat_online_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read online" ON chat_online_users 
  FOR SELECT USING (true);

CREATE POLICY "Users manage own presence" ON chat_online_users 
  FOR ALL USING (auth.uid() = user_id);

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Authenticated can upload chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-files');

CREATE POLICY "Anyone can read chat files"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-files');

-- Enable realtime for all chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_online_users;
