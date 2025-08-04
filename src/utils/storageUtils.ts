import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

interface UploadOptions {
  userId: string;
  file: File;
  progressCallback?: (progress: number) => void;
}

/**
 * Uploads a file to Supabase Storage
 * @param options Upload options including file and user ID
 * @returns The public URL of the uploaded file
 */
export async function uploadAttachment(options: UploadOptions): Promise<string> {
  const { userId, file } = options;
  
  // Create a unique file name
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;
  
  // Upload the file to the messages bucket
  const { error } = await supabase.storage
    .from('attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });
    
  if (error) {
    console.error('Error uploading file:', error);
    throw new Error(`Error uploading file: ${error.message}`);
  }
  
  // Get the public URL for the file
  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(filePath);
    
  return urlData.publicUrl;
}

/**
 * Deletes a file from Supabase Storage
 * @param url The public URL of the file to delete
 */
export async function deleteAttachment(url: string): Promise<void> {
  // Extract the path from the URL
  const path = url.split('/').slice(4).join('/');
  
  const { error } = await supabase.storage
    .from('attachments')
    .remove([path]);
    
  if (error) {
    console.error('Error deleting file:', error);
    throw new Error(`Error deleting file: ${error.message}`);
  }
}

/**
 * Creates a temporary URL with a signed token for private files
 * @param path Path to the file in storage
 * @param expiresIn Seconds until the URL expires (default: 60 seconds)
 */
export async function getSignedUrl(path: string, expiresIn = 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(path, expiresIn);
    
  if (error) {
    console.error('Error creating signed URL:', error);
    throw new Error(`Error creating signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}
