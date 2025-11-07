import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Image, Lock, Zap, Globe } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">ChatApp</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/login">Log In</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Connect with friends and family
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience real-time messaging with group chats, media sharing, and a beautiful interface. 
            Simple, fast, and secure.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/login">Get Started</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need to stay connected</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-primary" />}
              title="Real-time Messaging"
              description="Instant message delivery with typing indicators and read receipts"
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-primary" />}
              title="Group Chats"
              description="Create groups to chat with multiple people at once"
            />
            <FeatureCard
              icon={<Image className="h-8 w-8 text-primary" />}
              title="Media Sharing"
              description="Share photos, videos, and files with ease"
            />
            <FeatureCard
              icon={<Lock className="h-8 w-8 text-primary" />}
              title="Secure & Private"
              description="Your messages are protected and private"
            />
            <FeatureCard
              icon={<Globe className="h-8 w-8 text-primary" />}
              title="Cross-Platform"
              description="Works seamlessly across all your devices"
            />
            <FeatureCard
              icon={<MessageCircle className="h-8 w-8 text-primary" />}
              title="User-Friendly"
              description="Clean, intuitive interface that's easy to use"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto bg-card border border-card-border rounded-2xl p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of users already chatting on ChatApp
          </p>
          <Button size="lg" asChild data-testid="button-join-now">
            <a href="/login">Join Now - It's Free</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 ChatApp. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card border border-card-border hover-elevate">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
