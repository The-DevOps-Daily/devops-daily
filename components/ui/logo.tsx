'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number | string;
  href?: string;
  showText?: boolean;
  textClassName?: string;
  interactive?: boolean;
}

export function Logo({ 
  className, 
  size = 40, 
  href, 
  showText = false, 
  textClassName,
  interactive = true 
}: LogoProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!interactive || !isHovering) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!logoRef.current) return;
      
      const rect = logoRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate relative position from center (-1 to 1)
      const relativeX = (e.clientX - centerX) / (rect.width / 2);
      const relativeY = (e.clientY - centerY) / (rect.height / 2);
      
      // Clamp values to prevent extreme transformations
      const clampedX = Math.max(-1, Math.min(1, relativeX));
      const clampedY = Math.max(-1, Math.min(1, relativeY));
      
      setMousePosition({ x: clampedX, y: clampedY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive, isHovering]);

  const logo = (
    <div 
      ref={logoRef}
      className={cn('flex items-center group relative p-4', className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setMousePosition({ x: 0, y: 0 });
      }}
      style={{
        // Add padding for effects to have room
        margin: '-1rem',
        padding: '1rem',
      }}
    >
      {/* Fade mask for smooth edge transitions */}
      {interactive && isHovering && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
          }}
        >
          {/* Background glow effect with smooth edges */}
          <div 
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at ${50 + mousePosition.x * 30}% ${50 + mousePosition.y * 30}%, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 30%, transparent 70%)`,
              filter: 'blur(20px)',
              transform: 'scale(1.5)',
              transition: 'all 0.3s ease-out',
            }}
          />
        </div>
      )}

      {/* Particles with fade at edges */}
      {interactive && isHovering && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
          }}
        >
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-gradient-to-r from-primary/60 to-purple-600/60 rounded-full"
              style={{
                left: `${50 + mousePosition.x * 20}%`,
                top: `${50 + mousePosition.y * 20}%`,
                transform: `translate(${Math.cos(i * 90 * Math.PI / 180) * 15}px, ${Math.sin(i * 90 * Math.PI / 180) * 15}px)`,
                animation: `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) ${i * 0.15}s infinite`,
                filter: 'blur(0.5px)',
              }}
            />
          ))}
        </div>
      )}
      
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="30 0 300 300"
        width={size}
        height={size}
        className={cn(
          'text-primary transition-all duration-500',
          interactive && [
            'group-hover:scale-110',
            'group-hover:drop-shadow-2xl',
            'group-hover:filter',
          ]
        )}
        style={{
          transform: isHovering ? 
            `scale(1.1) rotateZ(${mousePosition.x * 3}deg) translateX(${mousePosition.x * 2}px) translateY(${mousePosition.y * 2}px)` : 
            'scale(1)',
          filter: isHovering ?
            `drop-shadow(${-mousePosition.x * 3}px ${-mousePosition.y * 3}px 10px rgba(139, 92, 246, 0.2))` :
            'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1,
          position: 'relative',
        }}
        fill="currentColor"
      >
        {/* Add gradient definitions for hover effect */}
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="text-primary" stopColor="currentColor">
              <animate 
                attributeName="stop-color" 
                values="currentColor;#8b5cf6;#3b82f6;currentColor" 
                dur="2s" 
                repeatCount="indefinite" 
              />
            </stop>
            <stop offset="100%" className="text-purple-600" stopColor="currentColor">
              <animate 
                attributeName="stop-color" 
                values="currentColor;#3b82f6;#8b5cf6;currentColor" 
                dur="2s" 
                repeatCount="indefinite" 
              />
            </stop>
          </linearGradient>
          
          {/* Softer glow filter */}
          <filter id="logo-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feColorMatrix in="coloredBlur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.6 0"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <g
          fill={interactive ? "url(#logo-gradient)" : "currentColor"}
          stroke="none"
          transform="matrix(2.289112659087108,0,0,2.289112659087108,35.650702102437315,35.95649971171595)"
          className={cn(
            'transition-all duration-700',
            interactive && 'group-hover:filter group-hover:[filter:url(#logo-glow)]'
          )}
        >
          {/* First path with hover animation */}
          <path 
            d="M45.264 60.825a1.71 1.71 0 01-2.261-2.059l1.221-4.327c-5.317 7.252-10.752 11.975-19.48 11.975-9.15 0-16.595-7.445-16.595-16.595 0-3.267.952-6.314 2.588-8.885l.391.784a1.711 1.711 0 002.896.263l7.746-10.31a1.71 1.71 0 00-1.365-2.736l-12.897-.009h-.001a1.708 1.708 0 00-1.529 2.472l1.651 3.309A22.748 22.748 0 001.9 49.819c0 12.595 10.247 22.843 22.843 22.843 6.753 0 12.588-2.274 17.839-6.953a49.127 49.127 0 005.638-6.008l-.01-.014-2.946 1.138z"
            className={cn(
              'transition-all duration-500 origin-center',
              interactive && 'group-hover:animate-pulse'
            )}
          />
          
          {/* Second path with different animation */}
          <path 
            d="M68.594 67.006L64.1 55.047a1.71 1.71 0 00-2.854-.56l-1.85 1.994c-1.521-2.051-3.002-4.308-4.526-6.66l.001-.001-3.747-5.692c-2.59-3.79-5.313-7.321-8.541-10.197-5.251-4.679-11.086-6.954-17.839-6.954-.288 0-.573.007-.858.018.413.396.763.866 1.029 1.399a5.01 5.01 0 01-.183 4.833h.012c10.468 0 16.2 6.789 22.67 16.595l3.71 5.692c1.273 1.928 2.581 3.824 3.964 5.617l-1.684 1.814c-.402.435-.553 1.047-.395 1.617s.6 1.02 1.169 1.186l12.378 3.615c.158.045.32.068.479.068h.023a1.708 1.708 0 001.69-1.709 1.698 1.698 0 00-.154-.716z"
            className={cn(
              'transition-all duration-700 origin-center',
              interactive && 'group-hover:scale-105'
            )}
            style={{
              transformOrigin: '50% 50%'
            }}
          />
          
          {/* Third path with another animation */}
          <path 
            d="M91.317 33.667a22.698 22.698 0 00-16.152-6.69c-5.321 0-9.577 1.732-13.19 4.461l-1.949-1.775a1.71 1.71 0 00-2.796.8l-3.503 12.41a1.71 1.71 0 002.261 2.059l12.03-4.646a1.709 1.709 0 00.534-2.858l-1.838-1.674c2.447-1.597 5.197-2.529 8.45-2.529 9.149 0 16.595 7.444 16.595 16.595 0 9.149-7.445 16.595-16.595 16.595-1.187 0-2.305-.126-3.366-.361.188.535.283 1.094.283 1.668a5.05 5.05 0 01-2.378 4.273c1.69.433 3.503.668 5.461.668 12.595 0 22.843-10.248 22.843-22.843a22.685 22.685 0 00-6.69-16.153z"
            className={cn(
              'transition-all duration-900 origin-center',
              interactive && 'group-hover:scale-110'
            )}
            style={{
              transformOrigin: '50% 50%'
            }}
          />
        </g>
        
        {/* Softer animated sparkles */}
        {interactive && (
          <g className="opacity-0 group-hover:opacity-60 transition-opacity duration-700">
            <circle cx="80" cy="80" r="1.5" fill="#fbbf24" opacity="0.8" className="animate-pulse" />
            <circle cx="250" cy="100" r="1.5" fill="#8b5cf6" opacity="0.8" className="animate-pulse" style={{ animationDelay: '0.3s' }} />
            <circle cx="180" cy="220" r="1.5" fill="#3b82f6" opacity="0.8" className="animate-pulse" style={{ animationDelay: '0.6s' }} />
            <circle cx="100" cy="200" r="1.5" fill="#10b981" opacity="0.8" className="animate-pulse" style={{ animationDelay: '0.9s' }} />
          </g>
        )}
      </svg>

      {showText && (
        <span className={cn(
          'ml-2 text-xl font-bold transition-all duration-500',
          interactive && [
            'group-hover:bg-gradient-to-r',
            'group-hover:from-primary',
            'group-hover:via-purple-600', 
            'group-hover:to-blue-600',
            'group-hover:bg-clip-text',
            'group-hover:text-transparent',
            'group-hover:animate-pulse'
          ],
          textClassName
        )}
        style={{
          transform: isHovering ? 
            `perspective(400px) rotateY(${mousePosition.x * 3}deg) rotateX(${-mousePosition.y * 3}deg)` : 
            'none',
          transition: 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1,
        }}
        >
          DevOps Daily
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link 
        href={href} 
        className={cn(
          'inline-block transition-all duration-300',
          interactive && 'hover:scale-105'
        )}
      >
        {logo}
      </Link>
    );
  }

  return logo;
}
