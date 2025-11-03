interface TypingIndicatorProps {
  userNames: string[];
}

export function TypingIndicator({ userNames }: TypingIndicatorProps) {
  if (userNames.length === 0) return null;

  const text = userNames.length === 1
    ? `${userNames[0]} is typing`
    : userNames.length === 2
    ? `${userNames[0]} and ${userNames[1]} are typing`
    : `${userNames.length} people are typing`;

  return (
    <div className="px-4 py-2 text-sm text-muted-foreground animate-pulse" data-testid="typing-indicator">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span>{text}</span>
      </div>
    </div>
  );
}
