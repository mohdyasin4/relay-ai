// Image optimization utilities for better performance

interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

export class ImageOptimizer {
  /**
   * Compress and resize an image file
   */
  static async compressImage(
    file: File,
    options: ImageCompressionOptions = {}
  ): Promise<File> {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 0.8,
      format = 'jpeg'
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: `image/${format}`,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          `image/${format}`,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate a low-quality blur placeholder for an image
   */
  static async generateBlurDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Create tiny 20x20 canvas for blur placeholder
        const ratio = img.width / img.height;
        const width = ratio > 1 ? 20 : 20 * ratio;
        const height = ratio > 1 ? 20 / ratio : 20;

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.1));
      };

      img.onerror = () => reject(new Error('Failed to generate blur placeholder'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Convert image to WebP format if supported
   */
  static async convertToWebP(file: File, quality: number = 0.8): Promise<File | null> {
    // Check if browser supports WebP
    if (!ImageOptimizer.isWebPSupported()) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(webpFile);
            } else {
              resolve(null);
            }
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Check if browser supports WebP format
   */
  static isWebPSupported(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * Preload images for better performance
   */
  static preloadImages(urls: string[]): Promise<HTMLImageElement[]> {
    const promises = urls.map(url => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    });

    return Promise.all(promises);
  }

  /**
   * Get optimal image sizes for responsive images
   */
  static getResponsiveSizes(containerWidth: number): string {
    if (containerWidth <= 640) return '100vw';
    if (containerWidth <= 1024) return '50vw';
    if (containerWidth <= 1280) return '33vw';
    return '25vw';
  }

  /**
   * Create multiple sizes of an image for responsive loading
   */
  static async createResponsiveImages(
    file: File,
    sizes: number[] = [400, 800, 1200]
  ): Promise<{ size: number; file: File; url: string }[]> {
    const results = await Promise.all(
      sizes.map(async (size) => {
        const resized = await ImageOptimizer.compressImage(file, {
          maxWidth: size,
          maxHeight: size,
        });
        return {
          size,
          file: resized,
          url: URL.createObjectURL(resized),
        };
      })
    );

    return results;
  }
}

/**
 * Hook for image optimization
 */
export function useImageOptimization() {
  const compressImage = async (file: File, options?: ImageCompressionOptions) => {
    try {
      return await ImageOptimizer.compressImage(file, options);
    } catch (error) {
      console.error('Image compression failed:', error);
      return file; // Return original if compression fails
    }
  };

  const generateBlurPlaceholder = async (file: File) => {
    try {
      return await ImageOptimizer.generateBlurDataURL(file);
    } catch (error) {
      console.error('Blur placeholder generation failed:', error);
      return null;
    }
  };

  const convertToWebP = async (file: File) => {
    try {
      return await ImageOptimizer.convertToWebP(file);
    } catch (error) {
      console.error('WebP conversion failed:', error);
      return null;
    }
  };

  return {
    compressImage,
    generateBlurPlaceholder,
    convertToWebP,
    isWebPSupported: ImageOptimizer.isWebPSupported(),
  };
}
