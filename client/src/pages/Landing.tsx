import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Shield, Zap, Users, Lock, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="bg-green-500 p-4 rounded-full mb-6">
            <MessageCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Connect Instantly, Securely
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mb-8">
            A modern real-time messaging platform with end-to-end encryption, 
            voice & video calling, and advanced privacy features.
          </p>
          <div className="flex gap-4">
            <Button
              size="lg"
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={() => setLocation("/login")}
              data-testid="button-get-started"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/login")}
              data-testid="button-sign-in"
            >
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="p-6 hover-elevate">
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg w-fit mb-4">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">End-to-End Encryption</h3>
            <p className="text-muted-foreground">
              Your messages are secured with RSA-OAEP and AES-GCM encryption. 
              Only you and your recipient can read them.
            </p>
          </Card>

          <Card className="p-6 hover-elevate">
            <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg w-fit mb-4">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-Time Messaging</h3>
            <p className="text-muted-foreground">
              Send and receive messages instantly with WebSocket technology. 
              See when others are typing and online.
            </p>
          </Card>

          <Card className="p-6 hover-elevate">
            <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg w-fit mb-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Group Chats & Broadcasts</h3>
            <p className="text-muted-foreground">
              Create group conversations or broadcast channels to communicate 
              with multiple people at once.
            </p>
          </Card>
        </div>

        <Card className="p-8 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-200 dark:border-green-800">
          <h2 className="text-3xl font-bold mb-6 text-center">Powerful Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Voice & Video Calls</h4>
                <p className="text-sm text-muted-foreground">
                  High-quality WebRTC calls with screen sharing support
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Disappearing Messages</h4>
                <p className="text-sm text-muted-foreground">
                  Set messages to auto-delete after 24 hours, 7 days, or 90 days
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Message Forwarding</h4>
                <p className="text-sm text-muted-foreground">
                  Share messages across multiple conversations with attribution
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Read Receipts & Status</h4>
                <p className="text-sm text-muted-foreground">
                  Know when messages are delivered and read with status indicators
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">File Sharing</h4>
                <p className="text-sm text-muted-foreground">
                  Securely share images, videos, and documents with cloud storage
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Passwordless Login</h4>
                <p className="text-sm text-muted-foreground">
                  Sign in securely with email OTP - no passwords to remember
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="text-center mt-16">
          <div className="bg-gray-900 dark:bg-gray-800 p-3 rounded-lg w-fit mx-auto mb-4">
            <Lock className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Privacy First</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Your conversations are private and secure. We use industry-standard encryption 
            and don't store your private keys. Rate limiting and secure sessions protect 
            your account from unauthorized access.
          </p>
          <Button
            size="lg"
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={() => setLocation("/login")}
            data-testid="button-start-messaging"
          >
            Start Messaging Now
          </Button>
        </div>
      </div>
    </div>
  );
}
