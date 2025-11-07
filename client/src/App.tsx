import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import EmailLogin from "@/pages/EmailLogin";
import OTPVerification from "@/pages/OTPVerification";
import Registration from "@/pages/Registration";
import Home from "@/pages/Home";
import PrivacySettings from "@/pages/PrivacySettings";
import PhotoGallery from "@/pages/PhotoGallery";
import VideoGallery from "@/pages/VideoGallery";

function Router() {
  const { user, isLoading } = useAuth();
  const isAuthenticated = !!user;
  const needsRegistration = isAuthenticated && !user?.isRegistered;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Landing />}
      </Route>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <EmailLogin />}
      </Route>
      <Route path="/verify-otp">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <OTPVerification />}
      </Route>
      <Route path="/register">
        {!isAuthenticated ? <Redirect to="/login" /> : needsRegistration ? <Registration /> : <Redirect to="/dashboard" />}
      </Route>
      <Route path="/dashboard">
        {!isAuthenticated ? <Redirect to="/" /> : needsRegistration ? <Redirect to="/register" /> : <Home />}
      </Route>
      <Route path="/settings/privacy">
        {!isAuthenticated ? <Redirect to="/" /> : <PrivacySettings />}
      </Route>
      <Route path="/photos">
        {!isAuthenticated ? <Redirect to="/" /> : <PhotoGallery />}
      </Route>
      <Route path="/videos">
        {!isAuthenticated ? <Redirect to="/" /> : <VideoGallery />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
