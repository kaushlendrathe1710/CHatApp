import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";

export default function OTPVerification() {
  const [, setLocation] = useLocation();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (!emailParam) {
      setLocation("/login");
    } else {
      setEmail(emailParam);
    }
  }, [setLocation]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/verify-otp", { email, otp });

      const data = await response.json();

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        
        if (data.user.isRegistered) {
          toast({
            title: "Welcome back!",
            description: "Login successful",
          });
          setLocation("/");
        } else {
          toast({
            title: "Account created",
            description: "Please complete your profile",
          });
          setLocation("/register");
        }
      } else {
        toast({
          title: "Verification failed",
          description: data.message || "Invalid or expired code",
          variant: "destructive",
        });
        setOtp("");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/login")}
            className="w-fit mb-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              disabled={isLoading}
              data-testid="input-otp"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            onClick={handleVerify}
            className="w-full"
            disabled={isLoading || otp.length !== 6}
            data-testid="button-verify"
          >
            {isLoading ? "Verifying..." : "Verify & Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
