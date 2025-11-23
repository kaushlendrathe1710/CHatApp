import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns';

export function formatMessageTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(d)) {
    return format(d, 'HH:mm');
  } else if (isYesterday(d)) {
    return 'Yesterday';
  } else if (isThisWeek(d)) {
    return format(d, 'EEEE');
  } else if (isThisYear(d)) {
    return format(d, 'MMM d');
  } else {
    return format(d, 'MMM d, yyyy');
  }
}

export function formatChatListTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(d)) {
    return format(d, 'HH:mm');
  } else if (isYesterday(d)) {
    return 'Yesterday';
  } else if (isThisYear(d)) {
    return format(d, 'MMM d');
  } else {
    return format(d, 'MMM d, yyyy');
  }
}

export function formatDateSeparator(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(d)) {
    return 'Today';
  } else if (isYesterday(d)) {
    return 'Yesterday';
  } else if (isThisYear(d)) {
    return format(d, 'MMMM d');
  } else {
    return format(d, 'MMMM d, yyyy');
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatLastSeen(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return formatMessageTime(d);
}

export function getUserDisplayName(user: { username?: string | null; fullName?: string | null; email?: string | null }): string {
  // Prefer username, fallback to email
  if (user.username) {
    return user.username;
  }
  if (user.email) {
    return user.email.split('@')[0];
  }
  return 'Unknown User';
}
