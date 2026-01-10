import type React from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getBlurPlaceholder, getShimmerPlaceholder } from '@/lib/blur-data';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  enableBlur?: boolean;
  className?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  enableBlur = true,
  className,
  ...props
}: OptimizedImageProps &
  Omit<
    React.ComponentProps<typeof Image>,
    'src' | 'alt' | 'width' | 'height' | 'fill' | 'priority' | 'className'
  >) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Use placeholder image if src is not provided
  const imageSrc = src || '/placeholder.svg';

  // Extract dimensions from placeholder URL if needed
  let finalWidth = width;
  let finalHeight = height;

  if (!finalWidth && !finalHeight && !fill && imageSrc.includes('placeholder.svg')) {
    const match = imageSrc.match(/width=(\d+).*height=(\d+)/);
    if (match) {
      finalWidth = Number.parseInt(match[1], 10);
      finalHeight = Number.parseInt(match[2], 10);
    } else {
      // Default dimensions
      finalWidth = 800;
      finalHeight = 600;
    }
  }

  // Get blur placeholder for this image
  const blurDataURL = enableBlur ? getBlurPlaceholder(imageSrc) : undefined;

  return (
    <div className={cn('relative overflow-hidden', fill ? 'w-full h-full' : '', className)}>
      {/* Blur placeholder background */}
      {enableBlur && blurDataURL && !isLoaded && !priority && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${blurDataURL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)', // Prevent blur edge artifacts
          }}
        />
      )}
      
      {/* Shimmer fallback for images without blur data */}
      {enableBlur && !blurDataURL && !isLoaded && !priority && (
        <div
          className="absolute inset-0 z-0 animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800"
          style={{
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite',
          }}
        />
      )}

      <Image
        src={imageSrc || '/placeholder.svg'}
        alt={alt}
        placeholder="empty"
        width={fill ? undefined : finalWidth}
        height={fill ? undefined : finalHeight}
        fill={fill}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        onLoad={() => setIsLoaded(true)}
        sizes={fill ? '(max-width: 768px) 100vw, 50vw' : undefined}
        className={cn(
          'object-cover relative z-10 transition-opacity duration-500',
          fill ? 'w-full h-full' : '',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        {...props}
      />
    </div>
  );
}
