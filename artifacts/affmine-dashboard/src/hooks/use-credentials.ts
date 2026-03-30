import { useState, useCallback } from "react";

export function useCredentials() {
  const [affId, setAffIdState] = useState(() => localStorage.getItem("affmine_aff_id") || "");
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem("affmine_api_key") || "");

  const saveCredentials = useCallback((newAffId: string, newApiKey: string) => {
    localStorage.setItem("affmine_aff_id", newAffId);
    localStorage.setItem("affmine_api_key", newApiKey);
    setAffIdState(newAffId);
    setApiKeyState(newApiKey);
  }, []);

  const hasCredentials = Boolean(affId && apiKey);

  return { affId, apiKey, saveCredentials, hasCredentials };
}
