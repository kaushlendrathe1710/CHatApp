import { Timer, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Conversation } from "@shared/schema";

interface DisappearingMessagesSettingsProps {
  conversation: Conversation;
  onUpdateTimer: (timerMs: number) => void;
}

const TIMER_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "7 days", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "90 days", value: 90 * 24 * 60 * 60 * 1000 },
];

export function DisappearingMessagesSettings({
  conversation,
  onUpdateTimer,
}: DisappearingMessagesSettingsProps) {
  const currentTimer = conversation.disappearingMessagesTimer || 0;
  const isEnabled = currentTimer > 0;

  const getTimerLabel = (ms: number) => {
    const option = TIMER_OPTIONS.find((opt) => opt.value === ms);
    return option?.label || "Custom";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-disappearing-messages-settings"
          aria-label={
            isEnabled
              ? `Disappearing messages: ${getTimerLabel(currentTimer)}`
              : "Disappearing messages: Off"
          }
          title={
            isEnabled
              ? `Disappearing messages: ${getTimerLabel(currentTimer)}`
              : "Disappearing messages: Off"
          }
        >
          {isEnabled ? (
            <Timer className="h-5 w-5 text-primary" data-testid="icon-timer-enabled" />
          ) : (
            <TimerOff className="h-5 w-5" data-testid="icon-timer-disabled" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-sm font-semibold">
          Disappearing Messages
        </div>
        <DropdownMenuSeparator />
        {TIMER_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onUpdateTimer(option.value)}
            className={currentTimer === option.value ? "bg-accent" : ""}
            data-testid={`menu-timer-${option.value}`}
          >
            {option.label}
            {currentTimer === option.value && " ✓"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
