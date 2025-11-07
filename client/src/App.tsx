import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import EmailLogin from "@/pages/EmailLogin";
import OTPVerification from "@/pages/OTPVerification";
import Registration from "@/pages/Registration";
import Home from "@/pages/Home";

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
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <EmailLogin />}
      </Route>
      <Route path="/verify-otp">
        {isAuthenticated ? <Redirect to="/" /> : <OTPVerification />}
      </Route>
      <Route path="/register">
        {!isAuthenticated ? <Redirect to="/login" /> : needsRegistration ? <Registration /> : <Redirect to="/" />}
      </Route>
      <Route path="/">
        {!isAuthenticated ? <Redirect to="/login" /> : needsRegistration ? <Redirect to="/register" /> : <Home />}
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
