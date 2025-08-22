import { createClient } from '@/lib/supabase/client';
import { createStorageClient } from '@/lib/supabase/storage-client';

const supabase = createClient();
const storageClient = createStorageClient();

export interface UploadResult {
  url: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export class StorageService {
  private static readonly BASE_BUCKET_NAME = 'chat-attachments';
  private static bucketChecked = false;
  
  /**
   * Get bucket name for specific chat/group
   */
  private static getBucketName(chatId?: string): string {
    if (!chatId) {
      return this.BASE_BUCKET_NAME;
    }
    return `${this.BASE_BUCKET_NAME}-${chatId}`;
  }

  /**
   * Ensure bucket exists before any operation
   */
  private static async ensureBucket(chatId?: string): Promise<void> {
    const bucketName = this.getBucketName(chatId);
    
    try {
      const { data: buckets, error: listError } = await storageClient.storage.listBuckets();
      
      if (listError) {
        console.error('List buckets error:', listError);
        // Continue anyway, maybe the bucket exists but we can't list
        return;
      }

      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log(`Bucket '${bucketName}' not found. Attempting to create...`);
        
        try {
          // Use storage client with service role key to bypass RLS policies
          const { error: createError } = await storageClient.storage.createBucket(bucketName, {
            public: true,
            allowedMimeTypes: ['image/*', 'video/*', 'audio/*', 'application/*', 'text/*'],
            fileSizeLimit: 50 * 1024 * 1024 // 50MB
          });

          if (createError) {
            console.error('Create bucket error:', createError);
            
            // Handle RLS policy errors specifically
            if (createError.message.includes('row-level security policy') || 
                createError.message.includes('permission denied')) {
              console.warn('Bucket creation failed due to RLS policies. Please create the bucket manually in Supabase dashboard.');
              console.warn('Required bucket name:', bucketName);
              console.warn('Required settings: public=true, fileSizeLimit=50MB');
              return;
            }
            
            throw new Error(`Failed to create bucket: ${createError.message}`);
          } else {
            console.log('Bucket created successfully');
          }
        } catch (createError: any) {
          console.error('Create bucket failed:', createError);
          
          // Handle RLS policy errors gracefully
          if (createError.message.includes('row-level security policy') || 
              createError.message.includes('permission denied')) {
            console.warn('Bucket creation failed due to RLS policies. Please create the bucket manually in Supabase dashboard.');
            console.warn('Required bucket name:', bucketName);
            console.warn('Required settings: public=true, fileSizeLimit=50MB');
            return;
          }
          
          throw createError;
        }
      }
    } catch (error) {
      console.error('Ensure bucket error:', error);
      // Don't throw here, let the upload attempt and show the actual error
    }
  }

  /**
   * Upload a file to Supabase storage
   */
  static async uploadFile(file: File, userId: string, chatId?: string): Promise<UploadResult> {
    try {
      // Ensure bucket exists for this chat
      await this.ensureBucket(chatId);
      
      const bucketName = this.getBucketName(chatId);

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || '';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2);
      const fileName = `${timestamp}_${randomId}.${fileExtension}`;
      const filePath = `${userId}/${fileName}`;

      console.log('Uploading file:', { fileName, fileSize: file.size, mimeType: file.type, bucketName });

      // Try to upload file to storage using storage client to bypass RLS
      const { data, error } = await storageClient.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Storage upload error:', error);
        
        // Check if it's a bucket not found error
        if (error.message.includes('Bucket not found') || error.message.includes('bucket not found')) {
          console.error(`Bucket '${this.BUCKET_NAME}' does not exist. Please create it manually in Supabase dashboard.`);
          console.error('Required settings:');
          console.error('- Bucket name: chat-attachments');
          console.error('- Public: true');
          console.error('- File size limit: 50MB');
          console.error('- Allowed MIME types: image/*, video/*, audio/*, application/*, text/*');
        }
        
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = storageClient.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log('File uploaded successfully:', { publicUrl, path: data.path });

      return {
        url: publicUrl,
        path: data.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      };
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files concurrently
   */
  static async uploadMultipleFiles(
    files: File[], 
    userId: string,
    chatId?: string,
    onProgress?: (file: File, progress: number) => void
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map(async (file) => {
      try {
        if (onProgress) {
          onProgress(file, 0);
        }
        
        const result = await this.uploadFile(file, userId, chatId);
        
        if (onProgress) {
          onProgress(file, 100);
        }
        
        return result;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Delete a file from storage
   */
  static async deleteFile(filePath: string, chatId?: string): Promise<void> {
    try {
      await this.ensureBucket(chatId);
      const bucketName = this.getBucketName(chatId);

      const { error } = await storageClient.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) {
        console.error('Storage delete error:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
      }

      console.log('File deleted successfully:', filePath);
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }

  /**
   * Get file info from storage
   */
  static async getFileInfo(filePath: string, chatId?: string) {
    try {
      await this.ensureBucket(chatId);
      const bucketName = this.getBucketName(chatId);

      const { data, error } = await storageClient.storage
        .from(bucketName)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop()
        });

      if (error) {
        console.error('Get file info error:', error);
        throw new Error(`Failed to get file info: ${error.message}`);
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Get file info error:', error);
      throw error;
    }
  }

  /**
   * Check if storage bucket exists and create if needed (for admin use)
   */
  static async ensureBucketExists(chatId?: string): Promise<void> {
    await this.ensureBucket(chatId);
  }

  /**
   * Check bucket status and provide setup instructions
   */
  static async checkBucketStatus(chatId?: string): Promise<{ exists: boolean; message: string }> {
    try {
      const bucketName = this.getBucketName(chatId);
      const { data: buckets, error: listError } = await storageClient.storage.listBuckets();
      
      if (listError) {
        return {
          exists: false,
          message: `Error checking buckets: ${listError.message}. Please check your Supabase permissions.`
        };
      }

      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (bucketExists) {
        return {
          exists: true,
          message: `Bucket '${bucketName}' exists and is ready for use.`
        };
      } else {
        return {
          exists: false,
          message: `Bucket '${bucketName}' does not exist. Please create it manually in Supabase dashboard with these settings:
            - Bucket name: ${bucketName}
            - Public: true
            - File size limit: 50MB
            - Allowed MIME types: image/*, video/*, audio/*, application/*, text/*`
        };
      }
    } catch (error) {
      return {
        exists: false,
        message: `Error checking bucket status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
