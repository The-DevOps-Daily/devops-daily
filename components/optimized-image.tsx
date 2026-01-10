import type React from 'react';
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
  const placeholder = enableBlur ? (blurDataURL ? 'blur' : 'empty') : 'empty';
  const blurURL = blurDataURL || (enableBlur && !priority ? getShimmerPlaceholder(finalWidth || 400, finalHeight || 300) : undefined);

  return (
    <div className={cn('relative', fill ? 'w-full h-full' : '', className)}>
      <Image
        src={imageSrc || '/placeholder.svg'}
        alt={alt}
        placeholder={placeholder as 'blur' | 'empty'}
        blurDataURL={blurURL}
        width={fill ? undefined : finalWidth}
        height={fill ? undefined : finalHeight}
        fill={fill}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        sizes={fill ? '(max-width: 768px) 100vw, 50vw' : undefined}
        className={cn('object-cover', fill ? 'w-full h-full' : '')}
        {...props}
      />
    </div>
  );
}
