import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Shield, Eye, MapPin, Clock } from "lucide-react";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";

export default function PrivacySettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch current user data
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Local state for privacy settings
  const [profileVisibility, setProfileVisibility] = useState<string>("everyone");
  const [locationPrivacy, setLocationPrivacy] = useState<string>("city");
  const [lastSeenVisibility, setLastSeenVisibility] = useState<string>("everyone");
  const [onlineStatusVisibility, setOnlineStatusVisibility] = useState<boolean>(true);

  // Update local state when user data loads
  useEffect(() => {
    if (user) {
      setProfileVisibility(user.profileVisibility || "everyone");
      setLocationPrivacy(user.locationPrivacy || "city");
      setLastSeenVisibility(user.lastSeenVisibility || "everyone");
      setOnlineStatusVisibility(user.onlineStatusVisibility ?? true);
    }
  }, [user]);

  // Save privacy settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: {
      profileVisibility: string;
      locationPrivacy: string;
      lastSeenVisibility: string;
      onlineStatusVisibility: boolean;
    }) => {
      const response = await apiRequest("PUT", "/api/users/privacy", settings);
      if (!response.ok) {
        throw new Error("Failed to update privacy settings");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/auth/user'], data);
      toast({
        title: "Privacy settings updated",
        description: "Your privacy preferences have been saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update privacy settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate({
      profileVisibility,
      locationPrivacy,
      lastSeenVisibility,
      onlineStatusVisibility,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Privacy Settings</h1>
            <p className="text-sm text-muted-foreground">
              Control who can see your information
            </p>
          </div>
        </div>

        {/* Profile Visibility */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Profile Visibility
            </CardTitle>
            <CardDescription>
              Choose who can discover your profile in search and recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={profileVisibility}
              onValueChange={setProfileVisibility}
              data-testid="radio-profile-visibility"
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="everyone" id="visibility-everyone" />
                <Label htmlFor="visibility-everyone" className="flex-1 cursor-pointer">
                  <div className="font-medium">Show to Everyone</div>
                  <div className="text-sm text-muted-foreground">
                    Your profile is visible to all users in discovery
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="past_chats" id="visibility-past-chats" />
                <Label htmlFor="visibility-past-chats" className="flex-1 cursor-pointer">
                  <div className="font-medium">Only People I've Chatted With</div>
                  <div className="text-sm text-muted-foreground">
                    Only users you've messaged before can find you
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="hidden" id="visibility-hidden" />
                <Label htmlFor="visibility-hidden" className="flex-1 cursor-pointer">
                  <div className="font-medium">Hide from Everyone</div>
                  <div className="text-sm text-muted-foreground">
                    Your profile won't appear in any discovery features
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Location Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Privacy
            </CardTitle>
            <CardDescription>
              Control how much of your location is visible to others
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={locationPrivacy}
              onValueChange={setLocationPrivacy}
              data-testid="radio-location-privacy"
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="exact" id="location-exact" />
                <Label htmlFor="location-exact" className="flex-1 cursor-pointer">
                  <div className="font-medium">Exact Location</div>
                  <div className="text-sm text-muted-foreground">
                    Show your precise location to others
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="city" id="location-city" />
                <Label htmlFor="location-city" className="flex-1 cursor-pointer">
                  <div className="font-medium">City Only</div>
                  <div className="text-sm text-muted-foreground">
                    Show only your city, not exact location
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="country" id="location-country" />
                <Label htmlFor="location-country" className="flex-1 cursor-pointer">
                  <div className="font-medium">Country Only</div>
                  <div className="text-sm text-muted-foreground">
                    Show only your country
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="hidden" id="location-hidden" />
                <Label htmlFor="location-hidden" className="flex-1 cursor-pointer">
                  <div className="font-medium">Hidden</div>
                  <div className="text-sm text-muted-foreground">
                    Don't show your location to anyone
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Last Seen Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Last Seen Privacy
            </CardTitle>
            <CardDescription>
              Choose who can see when you were last active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={lastSeenVisibility}
              onValueChange={setLastSeenVisibility}
              data-testid="radio-last-seen"
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="everyone" id="last-seen-everyone" />
                <Label htmlFor="last-seen-everyone" className="flex-1 cursor-pointer">
                  <div className="font-medium">Everyone</div>
                  <div className="text-sm text-muted-foreground">
                    All users can see your last seen timestamp
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="connections" id="last-seen-connections" />
                <Label htmlFor="last-seen-connections" className="flex-1 cursor-pointer">
                  <div className="font-medium">Connections Only</div>
                  <div className="text-sm text-muted-foreground">
                    Only people you've chatted with can see
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                <RadioGroupItem value="hidden" id="last-seen-hidden" />
                <Label htmlFor="last-seen-hidden" className="flex-1 cursor-pointer">
                  <div className="font-medium">Nobody</div>
                  <div className="text-sm text-muted-foreground">
                    Don't show your last seen to anyone
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Online Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Online Status
            </CardTitle>
            <CardDescription>
              Show or hide your online status indicator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-lg hover-elevate">
              <div>
                <div className="font-medium">Show Online Status</div>
                <div className="text-sm text-muted-foreground">
                  Others can see when you're online
                </div>
              </div>
              <Switch
                checked={onlineStatusVisibility}
                onCheckedChange={setOnlineStatusVisibility}
                data-testid="switch-online-status"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saveSettingsMutation.isPending}
            className="flex-1"
            data-testid="button-save-privacy"
          >
            {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
