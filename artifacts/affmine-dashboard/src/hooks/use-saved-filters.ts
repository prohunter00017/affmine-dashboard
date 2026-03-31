/**
 * Saved filter presets hook for AffMine campaign browser.
 *
 * Persists named filter snapshots to localStorage and exposes them reactively
 * via `useSyncExternalStore`.
 */

import { useCallback, useSyncExternalStore } from "react";

const SAVED_FILTERS_KEY = "affmine_saved_filters";

export interface FilterState {
  offer_status: string;
  platform: string;
  category: string;
  incentive: string;
  countries: string[];
}

export interface SavedFilter {
  name: string;
  filters: FilterState;
  savedAt: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getRaw(): string {
  return localStorage.getItem(SAVED_FILTERS_KEY) ?? "[]";
}

function parse(raw: string): SavedFilter[] {
  try {
    return JSON.parse(raw) as SavedFilter[];
  } catch {
    return [];
  }
}

export function useSavedFilters() {
  const raw = useSyncExternalStore(subscribe, getRaw, () => "[]");
  const savedFilters = parse(raw);

  const saveFilter = useCallback((name: string, filterState: FilterState) => {
    const current = parse(localStorage.getItem(SAVED_FILTERS_KEY) ?? "[]");
    const updated = current.filter((f) => f.name !== name);
    updated.unshift({ name, filters: filterState, savedAt: new Date().toISOString() });
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
    emitChange();
  }, []);

  const deleteSavedFilter = useCallback((name: string) => {
    const current = parse(localStorage.getItem(SAVED_FILTERS_KEY) ?? "[]");
    const updated = current.filter((f) => f.name !== name);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
    emitChange();
  }, []);

  return { savedFilters, saveFilter, deleteSavedFilter };
}
