-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to read public files
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'attachments');

-- Allow users to update their own files
CREATE POLICY "Allow users to update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create a function to extract the object path from a storage URL
-- (Used in application code, not in triggers)
CREATE OR REPLACE FUNCTION public.extract_storage_path(url text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  path text;
BEGIN
  -- Extract path from URL pattern: /storage/v1/object/public/attachments/{path}
  IF url IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF url LIKE '%/storage/v1/object/public/attachments/%' THEN
    path := substring(url from '/storage/v1/object/public/attachments/(.*)');
    RETURN path;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- We'll skip the trigger for now since it's causing issues
-- Instead, we'll add a column to track if an attachment has been verified
ALTER TABLE public."Message" 
  ADD COLUMN IF NOT EXISTS "attachmentVerified" BOOLEAN DEFAULT FALSE;
