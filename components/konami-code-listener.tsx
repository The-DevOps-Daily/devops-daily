'use client';

import { useEffect, useState } from 'react';

const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];

export function KonamiCodeListener() {
  const [keys, setKeys] = useState<string[]>([]);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only track arrow keys and B/A keys
      if (e.code.startsWith('Arrow') || e.code === 'KeyB' || e.code === 'KeyA') {
        setKeys((prevKeys) => {
          const newKeys = [...prevKeys, e.code].slice(-10); // Keep last 10 keys

          // Check if the Konami code was entered
          if (
            newKeys.length === KONAMI_CODE.length &&
            newKeys.every((key, index) => key === KONAMI_CODE[index])
          ) {
            // Konami code activated!
            setActivated(true);
            setKeys([]); // Reset

            // Show a fun notification
            const style = document.createElement('style');
            style.textContent = `
              @keyframes konami-flash {
                0%, 100% { opacity: 0; }
                50% { opacity: 1; }
              }
            `;
            document.head.appendChild(style);

            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 2rem 3rem;
              border-radius: 1rem;
              font-size: 2rem;
              font-weight: bold;
              z-index: 10000;
              box-shadow: 0 20px 60px rgba(0,0,0,0.5);
              animation: konami-flash 0.5s ease-in-out;
            `;
            notification.textContent = '🎮 KONAMI CODE ACTIVATED! 🎮';
            document.body.appendChild(notification);

            setTimeout(() => {
              notification.remove();
              style.remove();
            }, 2000);

            return [];
          }

          return newKeys;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset activated state when component unmounts or after use
  useEffect(() => {
    if (activated) {
      const timer = setTimeout(() => setActivated(false), 100);
      return () => clearTimeout(timer);
    }
  }, [activated]);

  // This component doesn't render anything visible, but triggers the terminal
  // You could also return null and handle this differently
  return null;
}
