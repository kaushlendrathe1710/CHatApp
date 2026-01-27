import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { User, Check, X, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const profileSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric (no spaces or special characters)"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  mobileNumber: z.string().min(10, "Valid mobile number is required"),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function Profile() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string>("");
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      fullName: user?.fullName || "",
      mobileNumber: user?.mobileNumber || "",
    },
  });

  const username = form.watch("username");

  // Check username availability when user types
  useEffect(() => {
    const checkUsernameAvailability = async () => {
      // Skip check if username hasn't changed
      if (username === user?.username) {
        setUsernameAvailable(null);
        setUsernameMessage("");
        return;
      }

      if (!username || username.length < 3) {
        setUsernameAvailable(null);
        setUsernameMessage("");
        return;
      }

      // Validate format first
      const formatValid = /^[a-zA-Z0-9]+$/.test(username);
      if (!formatValid) {
        setUsernameAvailable(false);
        setUsernameMessage("Username must be alphanumeric");
        return;
      }

      setCheckingUsername(true);
      try {
        const response = await fetch(`/api/users/check-username/${username}`, {
          credentials: "include",
        });
        const data = await response.json();
        setUsernameAvailable(data.available);
        setUsernameMessage(data.message);
      } catch (error) {
        console.error("Error checking username:", error);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timer = setTimeout(checkUsernameAvailability, 500);
    return () => clearTimeout(timer);
  }, [username, user?.username]);

  const onSubmit = async (data: ProfileForm) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("PUT", "/api/users/profile", data);

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully!",
        });
        setLocation("/dashboard");
      } else {
        const error = await response.json();
        toast({
          title: "Update failed",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <CardTitle className="text-2xl">Profile Settings</CardTitle>
              <CardDescription>
                Manage your username and profile information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="johndoe"
                          {...field}
                          disabled={isLoading}
                          data-testid="input-username"
                        />
                        {checkingUsername && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" data-testid="icon-checking-username" />
                          </div>
                        )}
                        {!checkingUsername && usernameAvailable === true && username && username !== user?.username && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Check className="h-4 w-4 text-status-online" data-testid="icon-username-available" />
                          </div>
                        )}
                        {!checkingUsername && usernameAvailable === false && username && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-4 w-4 text-destructive" data-testid="icon-username-taken" />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    {usernameMessage && !checkingUsername && (
                      <FormDescription className={usernameAvailable ? "text-status-online" : "text-destructive"} data-testid="text-username-message">
                        {usernameMessage}
                      </FormDescription>
                    )}
                    <FormDescription>
                      Alphanumeric only, 3-20 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        {...field}
                        disabled={isLoading}
                        data-testid="input-fullname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mobileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+1234567890"
                        {...field}
                        disabled={isLoading}
                        data-testid="input-mobile"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/dashboard")}
                  disabled={isLoading}
                  data-testid="button-cancel"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || (usernameAvailable === false && username !== user?.username)}
                  data-testid="button-save"
                  className="flex-1"
                >
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
