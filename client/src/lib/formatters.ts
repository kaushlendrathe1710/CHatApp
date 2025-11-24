import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";
import React from "react";

export function parseLinksInText(
  text: string
): (string | React.ReactElement)[] {
  // URL regex pattern - matches:
  // - http(s)://...
  // - www....
  // - ftp://...
  // - domain.extension (like google.com, example.org, etc.)
  const urlPattern =
    /(https?:\/\/[^\s]+|www\.[^\s]+|ftp:\/\/[^\s]+|(?<![@\w])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;

  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex lastIndex for global regex
  urlPattern.lastIndex = 0;

  while ((match = urlPattern.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    let url = match[0];

    // Add appropriate protocol if missing
    if (
      !url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("ftp://")
    ) {
      if (url.startsWith("www.")) {
        url = "https://" + url;
      } else {
        // For domain.com style URLs, add https://
        url = "https://" + url;
      }
    }

    // Create clickable link element
    parts.push(
      React.createElement(
        "a",
        {
          key: `link-${match.index}`,
          href: url,
          target: "_blank",
          rel: "noopener noreferrer",
          className: "text-blue-700 hover:text-blue-600 underline break-words",
          onClick: (e:React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation(),
        },
        match[0]
      )
    );

    lastIndex = urlPattern.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // Return the text if no links found
  return parts.length === 0 ? [text] : parts;
}

export function formatMessageTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) {
    return format(d, "HH:mm");
  } else if (isYesterday(d)) {
    return "Yesterday";
  } else if (isThisWeek(d)) {
    return format(d, "EEEE");
  } else if (isThisYear(d)) {
    return format(d, "MMM d");
  } else {
    return format(d, "MMM d, yyyy");
  }
}

export function formatChatListTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) {
    return format(d, "HH:mm");
  } else if (isYesterday(d)) {
    return "Yesterday";
  } else if (isThisYear(d)) {
    return format(d, "MMM d");
  } else {
    return format(d, "MMM d, yyyy");
  }
}

export function formatDateSeparator(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) {
    return "Today";
  } else if (isYesterday(d)) {
    return "Yesterday";
  } else if (isThisYear(d)) {
    return format(d, "MMMM d");
  } else {
    return format(d, "MMMM d, yyyy");
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function formatLastSeen(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return formatMessageTime(d);
}

export function getUserDisplayName(user: {
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
}): string {
  // Prefer username, fallback to email
  if (user.username) {
    return user.username;
  }
  if (user.email) {
    return user.email.split("@")[0];
  }
  return "Unknown User";
}
