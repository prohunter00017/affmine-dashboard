import { Link, useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { useCredentials } from "@/hooks/use-credentials";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function CredentialsBanner() {
  const { hasCredentials } = useCredentials();
  const [location] = useLocation();

  if (hasCredentials || location === "/settings") {
    return null;
  }

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0 border-b bg-destructive/10 text-destructive-foreground">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Missing Credentials</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>You need to configure your AffMine API Key and Affiliate ID to use this dashboard.</span>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="bg-background text-foreground hover:bg-muted" data-testid="button-go-to-settings">
            Go to Settings
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}
