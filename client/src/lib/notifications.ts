/**
 * Browser notification utilities for real-time messaging
 */

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  conversationId?: string;
  onClick?: () => void;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    console.log('[Notifications] Permission already granted');
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('[Notifications] Permission denied by user');
    return false;
  }

  try {
    console.log('[Notifications] Requesting permission...');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('[Notifications] Permission granted!');
    } else {
      console.warn('[Notifications] Permission not granted:', permission);
    }
    return permission === 'granted';
  } catch (error) {
    console.error('[Notifications] Failed to request permission:', error);
    return false;
  }
}

/**
 * Check if notifications are supported and permitted
 */
export function canShowNotifications(): boolean {
  return (
    'Notification' in window &&
    Notification.permission === 'granted'
  );
}

/**
 * Show a browser notification
 * Now shows notifications ALWAYS, even when app is open (mobile/laptop)
 */
export function showBrowserNotification(options: NotificationOptions): Notification | null {
  if (!canShowNotifications()) {
    console.log('[Notifications] Cannot show - permission not granted');
    return null;
  }

  try {
    console.log('[Notifications] Showing notification:', options.title);
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/icon-192x192.png',
      tag: options.tag,
      badge: '/icon-192x192.png',
      requireInteraction: false,
      silent: false,
    });

    // Handle notification click
    if (options.onClick) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  } catch (error) {
    console.error('Failed to show notification:', error);
    return null;
  }
}

/**
 * Get notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}
