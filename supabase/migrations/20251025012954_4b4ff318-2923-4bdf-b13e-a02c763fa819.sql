-- Delete all users from auth (this will cascade to related tables)
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    DELETE FROM auth.users WHERE id = user_record.id;
  END LOOP;
END $$;

-- Delete all objects from storage buckets first
DELETE FROM storage.objects WHERE bucket_id = 'return-photos';
DELETE FROM storage.objects WHERE bucket_id = 'id-photos';

-- Now drop storage buckets
DELETE FROM storage.buckets WHERE id = 'return-photos';
DELETE FROM storage.buckets WHERE id = 'id-photos';
