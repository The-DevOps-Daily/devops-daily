import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number | string;
  href?: string;
  showText?: boolean;
  textClassName?: string;
}

export function Logo({ className, size = 40, href, showText = false, textClassName }: LogoProps) {
  const logo = (
    <div className={cn('flex items-center group', className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="30 0 300 300"
        width={size}
        height={size}
        className="text-primary transition-all duration-700 ease-out group-hover:scale-110 group-hover:rotate-6 group-hover:drop-shadow-2xl"
        fill="currentColor"
      >
        <defs>
          <linearGradient id="logo-gradient-hover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6">
              <animate attributeName="stop-color" values="#8b5cf6;#ec4899;#8b5cf6" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#3b82f6">
              <animate attributeName="stop-color" values="#3b82f6;#06b6d4;#3b82f6" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#10b981">
              <animate attributeName="stop-color" values="#10b981;#84cc16;#10b981" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          <filter id="logo-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <g
          className="group-hover:fill-[url(#logo-gradient-hover)] group-hover:[filter:url(#logo-glow)] transition-all duration-700"
          fill="currentColor"
          stroke="none"
          transform="matrix(2.289112659087108,0,0,2.289112659087108,35.650702102437315,35.95649971171595)"
        >
          <path 
            className="transition-all duration-700 ease-out"
            d="M45.264 60.825a1.71 1.71 0 01-2.261-2.059l1.221-4.327c-5.317 7.252-10.752 11.975-19.48 11.975-9.15 0-16.595-7.445-16.595-16.595 0-3.267.952-6.314 2.588-8.885l.391.784a1.711 1.711 0 002.896.263l7.746-10.31a1.71 1.71 0 00-1.365-2.736l-12.897-.009h-.001a1.708 1.708 0 00-1.529 2.472l1.651 3.309A22.748 22.748 0 001.9 49.819c0 12.595 10.247 22.843 22.843 22.843 6.753 0 12.588-2.274 17.839-6.953a49.127 49.127 0 005.638-6.008l-.01-.014-2.946 1.138z"
          />
          <path 
            className="transition-all duration-700 ease-out"
            d="M68.594 67.006L64.1 55.047a1.71 1.71 0 00-2.854-.56l-1.85 1.994c-1.521-2.051-3.002-4.308-4.526-6.66l.001-.001-3.747-5.692c-2.59-3.79-5.313-7.321-8.541-10.197-5.251-4.679-11.086-6.954-17.839-6.954-.288 0-.573.007-.858.018.413.396.763.866 1.029 1.399a5.01 5.01 0 01-.183 4.833h.012c10.468 0 16.2 6.789 22.67 16.595l3.71 5.692c1.273 1.928 2.581 3.824 3.964 5.617l-1.684 1.814c-.402.435-.553 1.047-.395 1.617s.6 1.02 1.169 1.186l12.378 3.615c.158.045.32.068.479.068h.023a1.708 1.708 0 001.69-1.709 1.698 1.698 0 00-.154-.716z"
          />
          <path 
            className="transition-all duration-700 ease-out"
            d="M91.317 33.667a22.698 22.698 0 00-16.152-6.69c-5.321 0-9.577 1.732-13.19 4.461l-1.949-1.775a1.71 1.71 0 00-2.796.8l-3.503 12.41a1.71 1.71 0 002.261 2.059l12.03-4.646a1.709 1.709 0 00.534-2.858l-1.838-1.674c2.447-1.597 5.197-2.529 8.45-2.529 9.149 0 16.595 7.444 16.595 16.595 0 9.149-7.445 16.595-16.595 16.595-1.187 0-2.305-.126-3.366-.361.188.535.283 1.094.283 1.668a5.05 5.05 0 01-2.378 4.273c1.69.433 3.503.668 5.461.668 12.595 0 22.843-10.248 22.843-22.843a22.685 22.685 0 00-6.69-16.153z"
          />
        </g>
      </svg>

      {showText && (
        <span className={cn(
          'ml-2 text-xl font-bold transition-all duration-700',
          'group-hover:bg-gradient-to-r group-hover:from-primary group-hover:via-purple-600 group-hover:to-blue-600',
          'group-hover:bg-clip-text group-hover:text-transparent',
          textClassName
        )}>
          DevOps Daily
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {logo}
      </Link>
    );
  }

  return logo;
}
