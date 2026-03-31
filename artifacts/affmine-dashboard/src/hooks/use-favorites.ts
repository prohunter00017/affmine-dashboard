/**
 * Favorites hook for AffMine campaigns.
 *
 * Persists starred campaign IDs to localStorage and exposes them reactively
 * via `useSyncExternalStore`.  All components that call `useFavorites()`
 * re-render immediately when the set changes, without a context provider.
 */

import { useCallback, useSyncExternalStore } from "react";

const FAVORITES_KEY = "affmine_favorites";

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
  return localStorage.getItem(FAVORITES_KEY) ?? "[]";
}

function parseFavorites(raw: string): Set<string> {
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function useFavorites() {
  const raw = useSyncExternalStore(subscribe, getRaw, () => "[]");
  const favorites = parseFavorites(raw);

  const toggleFavorite = useCallback((id: string) => {
    const current = parseFavorites(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(current)));
    emitChange();
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.has(id),
    [favorites],
  );

  return { favorites, toggleFavorite, isFavorite, count: favorites.size };
}
