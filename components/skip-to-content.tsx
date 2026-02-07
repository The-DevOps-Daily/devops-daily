'use client';

import { useCallback, useEffect, useState } from 'react';

export function SkipToContent() {
  const [isVisible, setIsVisible] = useState(false);

  const handleFocus = useCallback(() => {
    setIsVisible(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      main.removeAttribute('tabindex');
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const main = document.querySelector('main');
      if (main) {
        main.setAttribute('tabindex', '-1');
        main.focus();
        main.removeAttribute('tabindex');
      }
    }
  }, []);

  return (
    <a
      href="#main-content"
      className={`
        fixed top-0 left-1/2 -translate-x-1/2 z-[100]
        px-4 py-2 bg-primary text-primary-foreground
        rounded-b-lg font-medium text-sm
        transition-transform duration-200
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        ${isVisible ? 'translate-y-0' : '-translate-y-full'}
      `}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      Skip to main content
    </a>
  );
}
