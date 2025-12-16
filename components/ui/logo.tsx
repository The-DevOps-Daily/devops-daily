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
  const [ripples, setRipples] = useState<{id: number, x: number, y: number}[]>([]);
  const logoRef = useRef<HTMLDivElement>(null);
  const nextRippleId = useRef(0);

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
      
      // Add ripple effect occasionally
      if (Math.random() > 0.92) {
        const rippleX = 50 + clampedX * 30;
        const rippleY = 50 + clampedY * 30;
        setRipples(prev => [...prev, { id: nextRippleId.current++, x: rippleX, y: rippleY }]);
        // Remove ripple after animation
        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== nextRippleId.current - 1));
        }, 1500);
      }
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
        setRipples([]);
      }}
      style={{
        // Add padding for effects to have room
        margin: '-1rem',
        padding: '1rem',
      }}
    >
      {/* Enhanced fade mask with multiple layers for ultra-smooth transitions */}
      {interactive && isHovering && (
        <>
          {/* Base layer with soft edges */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              maskImage: `radial-gradient(ellipse at ${50 + mousePosition.x * 20}% ${50 + mousePosition.y * 20}%, black 20%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.3) 60%, transparent 80%)`,
              WebkitMaskImage: `radial-gradient(ellipse at ${50 + mousePosition.x * 20}% ${50 + mousePosition.y * 20}%, black 20%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.3) 60%, transparent 80%)`,
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
          
          {/* Ripple effects */}
          {ripples.map(ripple => (
            <div
              key={ripple.id}
              className="absolute pointer-events-none"
              style={{
                left: `${ripple.x}%`,
                top: `${ripple.y}%`,
                width: '120px',
                height: '120px',
                marginLeft: '-60px',
                marginTop: '-60px',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'ripple-expand 1.5s ease-out forwards',
                opacity: 0,
              }}
            />
          ))}
        </>
      )}

      {/* Particles with fade at edges */}
      {interactive && isHovering && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            maskImage: `radial-gradient(ellipse at ${50 + mousePosition.x * 20}% ${50 + mousePosition.y * 20}%, black 25%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.3) 65%, transparent 85%)`,
            WebkitMaskImage: `radial-gradient(ellipse at ${50 + mousePosition.x * 20}% ${50 + mousePosition.y * 20}%, black 25%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.3) 65%, transparent 85%)`,
            transition: 'all 0.5s ease-out',
          }}
        >
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30) * Math.PI / 180;
            const orbitRadius = 30 + (i % 3) * 15;
            const size = i % 3 === 0 ? 6 : i % 3 === 1 ? 4 : 3;
            const colors = [
              '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9',
              '#14b8a6', '#10b981', '#84cc16', '#eab308',
              '#f97316', '#ef4444', '#ec4899', '#a855f7'
            ];
            
            return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${50 + mousePosition.x * 25 + Math.cos(angle + Date.now() / (1500 + i * 100)) * orbitRadius}%`,
                top: `${50 + mousePosition.y * 25 + Math.sin(angle + Date.now() / (1500 + i * 100)) * orbitRadius}%`,
                background: `radial-gradient(circle, ${colors[i]}, transparent)`,
                boxShadow: `0 0 ${size * 2}px ${colors[i]}`,
                opacity: 0.6 + Math.sin(Date.now() / 1000 + i) * 0.3,
                transform: `translate(-50%, -50%) scale(${1 + Math.sin(Date.now() / 800 + i) * 0.4})`,
                animation: `particle-orbit ${3 + (i % 4)}s ease-in-out infinite`,
                animationDelay: `${i * 0.08}s`,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: i % 3 === 0 ? 'blur(0px)' : 'blur(0.5px)',
                zIndex: size === 6 ? 2 : 1,
              }}
            />
            );
          })}
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
            `perspective(1000px) rotateY(${mousePosition.x * 10}deg) rotateX(${-mousePosition.y * 10}deg) scale(1.15)` : 
            'scale(1)',
          filter: isHovering ?
            `drop-shadow(${-mousePosition.x * 5}px ${-mousePosition.y * 5}px 20px rgba(139, 92, 246, 0.5)) brightness(1.1) contrast(1.1) saturate(1.2)` :
            'none',
          transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          zIndex: 1,
          position: 'relative',
          transformStyle: 'preserve-3d',
          willChange: 'transform, filter',
        }}
        fill="currentColor"
      >
        {/* Add gradient definitions for hover effect */}
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="text-primary" stopColor="currentColor">
              <animate 
                attributeName="stop-color" 
                values="#8b5cf6;#ec4899;#3b82f6;#10b981;#f59e0b;#ef4444;#8b5cf6" 
                dur="4s" 
                repeatCount="indefinite" 
              />
            </stop>
            <stop offset="50%" className="text-blue-600" stopColor="#3b82f6">
              <animate 
                attributeName="stop-color" 
                values="#3b82f6;#06b6d4;#10b981;#84cc16;#eab308;#f97316;#3b82f6" 
                dur="4s" 
                repeatCount="indefinite"
                begin="1s" 
              />
            </stop>
            <stop offset="100%" className="text-purple-600" stopColor="currentColor">
              <animate 
                attributeName="stop-color" 
                values="#8b5cf6;#a855f7;#ec4899;#ef4444;#f97316;#3b82f6;#8b5cf6" 
                dur="4s" 
                repeatCount="indefinite" 
                begin="2s"
              />
            </stop>
          </linearGradient>
          
          {/* Enhanced multi-layer glow filter */}
          <filter id="logo-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1"/>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2"/>
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur3"/>
            <feColorMatrix in="blur1" type="matrix" values="1 0 0 0 0.2  0 1 0 0 0  0 0 1 0 0.5  0 0 0 0.8 0" result="purple1"/>
            <feColorMatrix in="blur2" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 1  0 0 0 0.5 0" result="blue2"/>
            <feColorMatrix in="blur3" type="matrix" values="1 0 0 0 0.1  0 0 0 0 0.5  0 0 0 0 0.3  0 0 0 0.3 0" result="green3"/>
            <feMerge>
              <feMergeNode in="green3"/>
              <feMergeNode in="blue2"/>
              <feMergeNode in="purple1"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Morphing filter for subtle animation */}
          <filter id="logo-morph">
            <feTurbulence type="turbulence" baseFrequency="0.01" numOctaves="2" seed="2">
              <animate attributeName="baseFrequency" values="0.01;0.02;0.01" dur="8s" repeatCount="indefinite" />
            </feTurbulence>
            <feColorMatrix type="saturate" values="0"/>
            <feDisplacementMap in="SourceGraphic" scale="1.5" />
          </filter>
        </defs>
        
        <g
          fill={interactive && isHovering ? "url(#logo-gradient)" : "currentColor"}
          stroke="none"
          transform="matrix(2.289112659087108,0,0,2.289112659087108,35.650702102437315,35.95649971171595)"
          className={cn(
            'transition-all duration-700 origin-center',
            interactive && isHovering && 'filter [filter:url(#logo-glow)]'
          )}
          style={{
            transformOrigin: '50% 50%',
            transform: isHovering && interactive ? `scale(${1 + mousePosition.x * 0.05}, ${1 + mousePosition.y * 0.05})` : 'scale(1)',
          }}
        >
          {/* First path with hover animation */}
          <path 
            d="M45.264 60.825a1.71 1.71 0 01-2.261-2.059l1.221-4.327c-5.317 7.252-10.752 11.975-19.48 11.975-9.15 0-16.595-7.445-16.595-16.595 0-3.267.952-6.314 2.588-8.885l.391.784a1.711 1.711 0 002.896.263l7.746-10.31a1.71 1.71 0 00-1.365-2.736l-12.897-.009h-.001a1.708 1.708 0 00-1.529 2.472l1.651 3.309A22.748 22.748 0 001.9 49.819c0 12.595 10.247 22.843 22.843 22.843 6.753 0 12.588-2.274 17.839-6.953a49.127 49.127 0 005.638-6.008l-.01-.014-2.946 1.138z"
            className={cn(
              'transition-all duration-500 origin-center',
              interactive && isHovering && 'animate-pulse'
            )}
            style={{
              transform: isHovering && interactive ? 
                `rotate(${mousePosition.x * 2}deg) translateX(${mousePosition.x * 1}px)` : 
                'none',
              transformOrigin: '50% 50%',
            }}
          />
          
          {/* Second path with different animation */}
          <path 
            d="M68.594 67.006L64.1 55.047a1.71 1.71 0 00-2.854-.56l-1.85 1.994c-1.521-2.051-3.002-4.308-4.526-6.66l.001-.001-3.747-5.692c-2.59-3.79-5.313-7.321-8.541-10.197-5.251-4.679-11.086-6.954-17.839-6.954-.288 0-.573.007-.858.018.413.396.763.866 1.029 1.399a5.01 5.01 0 01-.183 4.833h.012c10.468 0 16.2 6.789 22.67 16.595l3.71 5.692c1.273 1.928 2.581 3.824 3.964 5.617l-1.684 1.814c-.402.435-.553 1.047-.395 1.617s.6 1.02 1.169 1.186l12.378 3.615c.158.045.32.068.479.068h.023a1.708 1.708 0 001.69-1.709 1.698 1.698 0 00-.154-.716z"
            className={cn(
              'transition-all duration-700 origin-center',
              interactive && isHovering && 'scale-105'
            )}
            style={{
              transformOrigin: '50% 50%',
              transform: isHovering && interactive ? 
                `rotate(${-mousePosition.x * 3}deg) translateY(${mousePosition.y * 2}px)` : 
                'none',
            }}
          />
          
          {/* Third path with another animation */}
          <path 
            d="M91.317 33.667a22.698 22.698 0 00-16.152-6.69c-5.321 0-9.577 1.732-13.19 4.461l-1.949-1.775a1.71 1.71 0 00-2.796.8l-3.503 12.41a1.71 1.71 0 002.261 2.059l12.03-4.646a1.709 1.709 0 00.534-2.858l-1.838-1.674c2.447-1.597 5.197-2.529 8.45-2.529 9.149 0 16.595 7.444 16.595 16.595 0 9.149-7.445 16.595-16.595 16.595-1.187 0-2.305-.126-3.366-.361.188.535.283 1.094.283 1.668a5.05 5.05 0 01-2.378 4.273c1.69.433 3.503.668 5.461.668 12.595 0 22.843-10.248 22.843-22.843a22.685 22.685 0 00-6.69-16.153z"
            className={cn(
              'transition-all duration-900 origin-center',
              interactive && isHovering && 'scale-110'
            )}
            style={{
              transformOrigin: '50% 50%',
              transform: isHovering && interactive ? 
                `rotate(${mousePosition.y * 2}deg) translateX(${-mousePosition.x * 1.5}px)` : 
                'none',
            }}
          />
        </g>
        
        {/* Softer animated sparkles */}
        {interactive && isHovering && (
          <g className="opacity-80 transition-opacity duration-700">
            {[...Array(8)].map((_, i) => {
              const angle = (i * 45) * Math.PI / 180;
              const radius = 100 + Math.sin(Date.now() / 1000 + i) * 20;
              const colors = ['#fbbf24', '#8b5cf6', '#3b82f6', '#10b981', '#ef4444', '#ec4899', '#f97316', '#06b6d4'];
              return (
                <circle 
                  key={i}
                  cx={150 + Math.cos(angle) * radius + mousePosition.x * 30} 
                  cy={150 + Math.sin(angle) * radius + mousePosition.y * 30} 
                  r={2 + Math.sin(Date.now() / 500 + i) * 1} 
                  fill={colors[i]} 
                  opacity={0.6 + Math.sin(Date.now() / 1000 + i * 0.5) * 0.3}
                  className="animate-pulse"
                  style={{ 
                    animationDelay: `${i * 0.15}s`,
                    filter: `blur(${i % 2}px)`,
                  }}
                />
              );
            })}
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
          ],
          textClassName
        )}
        style={{
          transform: isHovering && interactive ? 
            `perspective(600px) rotateY(${mousePosition.x * 5}deg) rotateX(${-mousePosition.y * 5}deg) translateZ(10px) scale(1.05)` : 
            'none',
          transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          position: 'relative',
          zIndex: 1,
          textShadow: isHovering && interactive ? 
            `${-mousePosition.x * 2}px ${-mousePosition.y * 2}px 10px rgba(139, 92, 246, 0.3),
             ${-mousePosition.x * 4}px ${-mousePosition.y * 4}px 20px rgba(59, 130, 246, 0.2),
             ${-mousePosition.x * 6}px ${-mousePosition.y * 6}px 30px rgba(16, 185, 129, 0.1)` : 
            'none',
          transformStyle: 'preserve-3d',
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
