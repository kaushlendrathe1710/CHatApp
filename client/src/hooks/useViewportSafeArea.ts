import { useEffect } from 'react';

/**
 * Hook to set CSS variable for viewport offset to handle Android address bar
 * This complements iOS safe-area-inset by tracking visual viewport changes
 */
export function useViewportSafeArea() {
  useEffect(() => {
    const updateViewportOffset = () => {
      if (window.visualViewport) {
        const offsetTop = window.visualViewport.offsetTop;
        document.documentElement.style.setProperty('--viewport-safe-top', `${offsetTop}px`);
      } else {
        document.documentElement.style.setProperty('--viewport-safe-top', '0px');
      }
    };

    // Set initial value
    updateViewportOffset();

    // Update on viewport changes (address bar show/hide on Android)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportOffset);
      window.visualViewport.addEventListener('scroll', updateViewportOffset);
    }

    // Fallback for window resize
    window.addEventListener('resize', updateViewportOffset);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportOffset);
        window.visualViewport.removeEventListener('scroll', updateViewportOffset);
      }
      window.removeEventListener('resize', updateViewportOffset);
    };
  }, []);
}
