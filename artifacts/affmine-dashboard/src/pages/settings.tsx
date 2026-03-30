import { useState } from "react";
import { useCredentials } from "@/hooks/use-credentials";
import { useHealthCheck, getCampaigns } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Key, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { affId, apiKey, saveCredentials } = useCredentials();
  const { toast } = useToast();
  
  const [formAffId, setFormAffId] = useState(affId);
  const [formApiKey, setFormApiKey] = useState(apiKey);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const { data: healthData, isError: isHealthError } = useHealthCheck();

  const handleSave = async () => {
    if (!formAffId || !formApiKey) {
      toast({
        title: "Missing fields",
        description: "Both Affiliate ID and API Key are required.",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);
    setStatus("idle");

    try {
      // Validate by calling campaigns endpoint directly (bypassing react-query cache for instant validation)
      await getCampaigns({
        aff_id: formAffId,
        api_key: formApiKey,
        limit_row: "1"
      });

      saveCredentials(formAffId, formApiKey);
      setStatus("success");
      toast({
        title: "Credentials verified and saved",
        description: "Your AffMine dashboard is now fully functional.",
      });
    } catch (error) {
      console.error(error);
      setStatus("error");
      toast({
        title: "Verification failed",
        description: "Invalid credentials or network error. Please check your inputs.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-mono">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your AffMine API access</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            API Credentials
          </CardTitle>
          <CardDescription>
            These credentials are stored locally in your browser and sent directly to the AffMine API via the proxy server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border text-sm">
            <div className={`h-2.5 w-2.5 rounded-full ${isHealthError ? 'bg-destructive' : 'bg-primary animate-pulse'}`} />
            <span className="text-muted-foreground">Proxy Server Status:</span>
            <span className={isHealthError ? 'text-destructive font-medium' : 'text-foreground font-medium'}>
              {isHealthError ? 'Unreachable' : healthData?.status || 'Checking...'}
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aff_id">Affiliate ID (aff_id)</Label>
              <Input 
                id="aff_id" 
                placeholder="e.g. 12345" 
                value={formAffId}
                onChange={(e) => setFormAffId(e.target.value)}
                className="bg-background font-mono"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key (api_key)</Label>
              <Input 
                id="api_key" 
                type="password"
                placeholder="Enter your API Key" 
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                className="bg-background font-mono"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-border pt-6">
          <div className="flex items-center">
            {status === "success" && (
              <span className="flex items-center text-sm text-primary font-medium">
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Validated
              </span>
            )}
            {status === "error" && (
              <span className="flex items-center text-sm text-destructive font-medium">
                <XCircle className="h-4 w-4 mr-1.5" /> Invalid
              </span>
            )}
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isVerifying || !formAffId || !formApiKey}
            data-testid="button-save-credentials"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Save & Verify"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
