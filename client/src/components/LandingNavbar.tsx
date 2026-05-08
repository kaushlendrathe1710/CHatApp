import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useLocation } from "wouter";

export function LandingNavbar() {
  const [, setLocation] = useLocation();

  return (
    <header className="sticky top-0 z-20 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 font-semibold"
          data-testid="button-landing-home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-white">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span>ChatApp</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setLocation("/login")}
            data-testid="button-landing-signin"
          >
            Sign In
          </Button>
          <Button
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={() => setLocation("/login")}
            data-testid="button-landing-get-started"
          >
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
}
