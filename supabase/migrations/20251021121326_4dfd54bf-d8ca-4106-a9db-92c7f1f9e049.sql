-- Create users table for student profiles
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (student_id = current_setting('app.current_student_id', true));

-- Users can insert their own profile
CREATE POLICY "Users can create own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (true);

-- Create umbrellas table
CREATE TABLE public.umbrellas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL,
  qr_code text UNIQUE NOT NULL,
  status text DEFAULT 'available' CHECK (status IN ('available', 'borrowed')),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.umbrellas ENABLE ROW LEVEL SECURITY;

-- Anyone can view umbrellas
CREATE POLICY "Anyone can view umbrellas"
  ON public.umbrellas
  FOR SELECT
  USING (true);

-- Create borrows table
CREATE TABLE public.borrows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  umbrella_id uuid REFERENCES public.umbrellas(id) ON DELETE CASCADE NOT NULL,
  borrowed_at timestamptz DEFAULT now() NOT NULL,
  returned_at timestamptz,
  return_photo_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'returned'))
);

ALTER TABLE public.borrows ENABLE ROW LEVEL SECURITY;

-- Users can view their own borrows
CREATE POLICY "Users can view own borrows"
  ON public.borrows
  FOR SELECT
  USING (true);

-- Users can create borrows
CREATE POLICY "Users can create borrows"
  ON public.borrows
  FOR INSERT
  WITH CHECK (true);

-- Users can update their own borrows
CREATE POLICY "Users can update own borrows"
  ON public.borrows
  FOR UPDATE
  USING (true);

-- Create storage bucket for return photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('return-photos', 'return-photos', true);

-- Storage policies for return photos
CREATE POLICY "Anyone can upload return photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'return-photos');

CREATE POLICY "Anyone can view return photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'return-photos');

-- Insert some sample umbrellas
INSERT INTO public.umbrellas (location, qr_code) VALUES
  ('Main Library', 'QR-LIB-001'),
  ('Main Library', 'QR-LIB-002'),
  ('Science Building', 'QR-SCI-001'),
  ('Student Center', 'QR-STU-001'),
  ('Engineering Hall', 'QR-ENG-001');
