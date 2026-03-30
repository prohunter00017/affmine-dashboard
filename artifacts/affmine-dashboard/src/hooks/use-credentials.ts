import { useCallback, useSyncExternalStore } from "react";

const AFF_ID_KEY = "affmine_aff_id";
const API_KEY_KEY = "affmine_api_key";

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getAffId() {
  return localStorage.getItem(AFF_ID_KEY) || "";
}

function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) || "";
}

export function useCredentials() {
  const affId = useSyncExternalStore(subscribe, getAffId, () => "");
  const apiKey = useSyncExternalStore(subscribe, getApiKey, () => "");

  const saveCredentials = useCallback((newAffId: string, newApiKey: string) => {
    localStorage.setItem(AFF_ID_KEY, newAffId);
    localStorage.setItem(API_KEY_KEY, newApiKey);
    emitChange();
  }, []);

  const hasCredentials = Boolean(affId && apiKey);

  return { affId, apiKey, saveCredentials, hasCredentials };
}
