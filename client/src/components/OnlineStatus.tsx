import { cn } from "@/lib/utils";

interface OnlineStatusProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function OnlineStatus({ isOnline, size = 'md', className }: OnlineStatusProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={cn(
        "rounded-full border-2 border-background",
        isOnline ? "bg-status-online" : "bg-status-offline",
        sizeClasses[size],
        className
      )}
      data-testid={isOnline ? "status-online" : "status-offline"}
    />
  );
}
