import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MessageCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [username, setUsername] = useState("");
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/send-otp", { email });

      setIsOtpSent(true);
      toast({
        title: "OTP Sent",
        description: `A 6-digit code has been sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      const response = await apiRequest("POST", "/api/auth/verify-otp", { email, otp });
      const data = await response.json();

      if (data.needsRegistration) {
        setNeedsRegistration(true);
        toast({
          title: "Welcome!",
          description: "Please complete your profile to continue",
        });
      } else {
        window.location.href = "/";
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/register", {
        email,
        fullName,
        mobile,
        username,
      });

      toast({
        title: "Registration Complete",
        description: "Welcome to ChatApp!",
      });

      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Registration failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Welcome to ChatApp</h1>
          <p className="text-sm text-muted-foreground">
            {!isOtpSent
              ? "Enter your email to continue"
              : needsRegistration
              ? "Complete your profile"
              : "Enter the verification code"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {!isOtpSent ? "Sign In" : needsRegistration ? "Create Profile" : "Verify OTP"}
            </CardTitle>
            <CardDescription>
              {!isOtpSent
                ? "We'll send you a verification code"
                : needsRegistration
                ? "Tell us a bit about yourself"
                : `Code sent to ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isOtpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-send-otp">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Continue with Email"
                  )}
                </Button>
              </form>
            ) : needsRegistration ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    data-testid="input-fullname"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="+1234567890"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    data-testid="input-mobile"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-register">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Profile...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    required
                    data-testid="input-otp"
                    className="text-center text-2xl tracking-widest"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit code sent to your email
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isVerifying} data-testid="button-verify-otp">
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Continue"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setIsOtpSent(false);
                    setOtp("");
                  }}
                  data-testid="button-back"
                >
                  Use Different Email
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {isOtpSent && !needsRegistration && (
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={handleSendOtp}
              disabled={isLoading}
              className="text-sm"
              data-testid="button-resend-otp"
            >
              Didn't receive the code? Resend
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
