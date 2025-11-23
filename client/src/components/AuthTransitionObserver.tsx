import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { notificationSoundManager } from '@/lib/notificationSounds';
import type { User } from '@shared/schema';

/**
 * Global auth transition observer that watches for auth changes
 * and resets the notification sound manager accordingly.
 * Mounted at App level to ensure it runs regardless of route.
 */
export function AuthTransitionObserver() {
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  
  useEffect(() => {
    const currentUserId = user?.id || null;
    
    // Skip on initial mount (undefined → value)
    if (prevUserIdRef.current === undefined) {
      prevUserIdRef.current = currentUserId;
      return;
    }
    
    if (prevUserIdRef.current !== currentUserId) {
      // User changed (logout or login as different user) - GLOBAL RESET
      console.log('[AuthTransitionObserver] User changed, resetting notification sound manager');
      
      // Remove ALL notification-sound cache entries (including per-user variants) to prevent stale data
      queryClient.removeQueries({ 
        queryKey: ['/api/users/notification-sound'],
        exact: false // Remove all variants including ['/api/users/notification-sound', userId]
      });
      
      // Reset manager to neutral disabled state (gates SSE playback until hydrated)
      notificationSoundManager.reset();
      
      prevUserIdRef.current = currentUserId;
    }
  }, [user?.id]);
  
  // This component doesn't render anything
  return null;
}
