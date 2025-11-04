-- Create freedom_wall_posts table
CREATE TABLE public.freedom_wall_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  image_url TEXT,
  post_url TEXT NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  featured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.freedom_wall_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view featured posts
CREATE POLICY "Anyone can view freedom wall posts"
  ON public.freedom_wall_posts
  FOR SELECT
  USING (true);

-- Only admins can insert posts
CREATE POLICY "Only admins can insert freedom wall posts"
  ON public.freedom_wall_posts
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update posts
CREATE POLICY "Only admins can update freedom wall posts"
  ON public.freedom_wall_posts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete posts
CREATE POLICY "Only admins can delete freedom wall posts"
  ON public.freedom_wall_posts
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_freedom_wall_posts_updated_at
  BEFORE UPDATE ON public.freedom_wall_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.freedom_wall_posts;
