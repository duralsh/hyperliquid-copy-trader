import { useState, useCallback, useEffect, useRef } from "react";
import { lookupTraders } from "../services/api.js";
import type { TraderSummary } from "../../../shared/types.js";

const STORAGE_KEY = "hl-trader-favorites";

function loadFavorites(): Map<string, TraderSummary> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    // Handle old format: plain string array of addresses
    if (parsed.length > 0 && typeof parsed[0] === "string") {
      const m = new Map<string, TraderSummary>();
      for (const addr of parsed as string[]) {
        const key = addr.toLowerCase();
        m.set(key, {
          rank: 0, address: addr, accountValue: 0, displayName: null,
          pnl: { day: 0, week: 0, month: 0, allTime: 0 },
          roi: { day: 0, week: 0, month: 0, allTime: 0 },
          volume: { day: 0, week: 0, month: 0, allTime: 0 },
        });
      }
      return m;
    }
    // New format: array of [key, TraderSummary] entries
    return new Map(
      (parsed as [string, TraderSummary][]).map(([k, v]) => [k.toLowerCase(), v])
    );
  } catch {
    return new Map();
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Map<string, TraderSummary>>(loadFavorites);
  const didFetch = useRef(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites.entries()]));
  }, [favorites]);

  // Fetch fresh data for favorited addresses on mount
  useEffect(() => {
    if (didFetch.current || favorites.size === 0) return;
    didFetch.current = true;
    const addresses = [...favorites.keys()];
    lookupTraders(addresses)
      .then(({ traders }) => {
        if (traders.length > 0) refreshFavorites(traders);
      })
      .catch(() => {}); // stale data is fine as fallback
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFavorite = useCallback((address: string, trader?: TraderSummary) => {
    setFavorites((prev) => {
      const next = new Map(prev);
      const key = address.toLowerCase();
      if (next.has(key)) {
        next.delete(key);
      } else if (trader) {
        next.set(key, trader);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (address: string) => favorites.has(address.toLowerCase()),
    [favorites]
  );

  const refreshFavorites = useCallback((traders: TraderSummary[]) => {
    setFavorites((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const t of traders) {
        const key = t.address.toLowerCase();
        if (next.has(key)) {
          next.set(key, t);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const favoriteTraders = useCallback(
    () => [...favorites.values()],
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite, favoriteTraders, refreshFavorites };
}
