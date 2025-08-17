import React, { useState, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { cn } from '../../lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: React.ReactNode;
  blurDataURL?: string;
  sizes?: string;
  priority?: boolean;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholder,
  blurDataURL,
  sizes,
  priority = false,
  onClick,
  onLoad,
  onError,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(priority ? src : null);

  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    skip: priority, // Skip intersection observer if priority loading
  });

  // Load image when it comes into view
  React.useEffect(() => {
    if ((inView || priority) && !imageSrc && !hasError) {
      setImageSrc(src);
    }
  }, [inView, priority, imageSrc, hasError, src]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
    onError?.();
  };

  // Show placeholder while loading or on error
  if (!imageSrc || hasError) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center bg-slate-200 dark:bg-slate-700 animate-pulse',
          className
        )}
        onClick={onClick}
      >
        {hasError ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm">
            Failed to load image
          </div>
        ) : (
          placeholder || (
            <div className="w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded" />
          )
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      {/* Blur placeholder */}
      {!isLoaded && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110"
          aria-hidden="true"
        />
      )}
      
      {/* Loading skeleton */}
      {!isLoaded && !blurDataURL && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse" />
      )}
      
      {/* Actual image */}
      <img
        src={imageSrc}
        alt={alt}
        sizes={sizes}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          onClick && 'cursor-pointer'
        )}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        loading={priority ? 'eager' : 'lazy'}
      />
    </div>
  );
};

export default React.memo(LazyImage);
