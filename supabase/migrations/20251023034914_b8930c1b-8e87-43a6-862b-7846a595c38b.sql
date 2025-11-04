-- Add id_photo_url to users table to store ID card photo
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS id_photo_url TEXT;

-- Create storage bucket for ID photos if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-photos',
  'id-photos',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ID photos
CREATE POLICY "Users can upload their own ID photo"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'id-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own ID photo"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Moderators can view all ID photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-photos' 
  AND has_role(auth.uid(), 'moderator'::app_role)
);
